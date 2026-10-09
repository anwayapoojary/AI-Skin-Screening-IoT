/* ESP32-CAM screening firmware with Wi-Fi-first, USB serial fallback. */

#include <Arduino.h>
#include <HTTPClient.h>
#include <WiFiClient.h>

#include "button.h"
#include "camera.h"
#include "communication.h"
#include "device_config.h"
#include "display.h"
#include "flash_led.h"
#include "sensors.h"
#include "state_machine.h"

static const uint8_t FRAME_MARKER[] = {0xA5, 0x5A, 0xC3, 0x3C};
static bool s_camera_ok = false;
static bool s_usb_mode = false;
static unsigned long s_wifi_deadline = 0;
static unsigned long s_last_status = 0;
static const char *s_display_state = "READY";

static const char *camera_status_str()
{
    return s_camera_ok ? "ok" : "error";
}

static void push_status(const char *button_state)
{
    comm_send_status(sm_get_state_str(), s_display_state, camera_status_str(),
                     "off", button_state ? button_state : "idle");
}

static uint32_t crc32_ieee(const uint8_t *data, size_t length)
{
    uint32_t crc = 0xFFFFFFFF;
    for (size_t i = 0; i < length; ++i) {
        crc ^= data[i];
        for (uint8_t bit = 0; bit < 8; ++bit) {
            crc = (crc & 1U) ? (crc >> 1) ^ 0xEDB88320U : crc >> 1;
        }
    }
    return crc ^ 0xFFFFFFFFU;
}

static void send_usb_frame(const uint8_t *image, size_t length)
{
    const uint32_t size = static_cast<uint32_t>(length);
    const uint32_t crc = crc32_ieee(image, length);
    Serial.write(FRAME_MARKER, sizeof(FRAME_MARKER));
    Serial.write(static_cast<uint8_t>((size >> 24) & 0xFF));
    Serial.write(static_cast<uint8_t>((size >> 16) & 0xFF));
    Serial.write(static_cast<uint8_t>((size >> 8) & 0xFF));
    Serial.write(static_cast<uint8_t>(size & 0xFF));
    Serial.write(image, length);
    Serial.write(static_cast<uint8_t>((crc >> 24) & 0xFF));
    Serial.write(static_cast<uint8_t>((crc >> 16) & 0xFF));
    Serial.write(static_cast<uint8_t>((crc >> 8) & 0xFF));
    Serial.write(static_cast<uint8_t>(crc & 0xFF));
    Serial.flush();
}

static void capture_over_usb()
{
    if (!s_camera_ok) {
        sm_transition(DEVICE_STATE_ERROR);
        display_show("CAMERA ERROR");
        sm_transition(DEVICE_STATE_READY);
        display_show("USB MODE");
        return;
    }
    sm_transition(DEVICE_STATE_CAPTURING);
    display_show("CAPTURING...");
    flash_set(1);
    delay(120);
    camera_fb_t *fb = camera_capture_frame();
    flash_set(0);
    if (!fb || fb->len == 0) {
        if (fb) camera_return_frame(fb);
        sm_transition(DEVICE_STATE_ERROR);
        display_show("CAPTURE ERROR");
        sm_transition(DEVICE_STATE_READY);
        display_show("USB MODE");
        return;
    }

    sm_transition(DEVICE_STATE_TRANSFERRING);
    display_show("USB SENDING");
    send_usb_frame(fb->buf, fb->len);
    camera_return_frame(fb);
    sm_transition(DEVICE_STATE_READY);
    display_show("USB MODE");
}

static bool upload_wifi_image(
    const camera_fb_t *fb,
    int patient_id,
    int screening_id
)
{
    const String boundary = "----ESP32CAM" + String(millis());
    const String prefix =
        "--" + boundary + "\r\n"
        "Content-Disposition: form-data; name=\"patient_id\"\r\n\r\n" +
        String(patient_id) + "\r\n--" + boundary + "\r\n"
        "Content-Disposition: form-data; name=\"screening_id\"\r\n\r\n" +
        String(screening_id) + "\r\n--" + boundary + "\r\n"
        "Content-Disposition: form-data; name=\"source\"\r\n\r\n"
        "wifi\r\n--" + boundary + "\r\n"
        "Content-Disposition: form-data; name=\"device_id\"\r\n\r\n" +
        String(DEVICE_ID) + "\r\n--" + boundary + "\r\n"
        "Content-Disposition: form-data; name=\"file\"; filename=\"capture.jpg\"\r\n"
        "Content-Type: image/jpeg\r\n\r\n";
    const String suffix = "\r\n--" + boundary + "--\r\n";
    const size_t prefix_len = prefix.length();
    const size_t suffix_len = suffix.length();
    const size_t body_len = prefix_len + fb->len + suffix_len;
    uint8_t *body = static_cast<uint8_t *>(
        psramFound() ? ps_malloc(body_len) : malloc(body_len)
    );
    if (!body) return false;
    memcpy(body, prefix.c_str(), prefix_len);
    memcpy(body + prefix_len, fb->buf, fb->len);
    memcpy(body + prefix_len + fb->len, suffix.c_str(), suffix_len);

    WiFiClient client;
    HTTPClient http;
    const String endpoint =
        "http://" + String(GATEWAY_HOST) + ":" + String(GATEWAY_PORT) +
        "/api/device/upload";
    http.setTimeout(60000);
    bool uploaded = false;
    if (http.begin(client, endpoint)) {
        http.addHeader("Content-Type", "multipart/form-data; boundary=" + boundary);
        if (DEVICE_TOKEN[0] != '\0') {
            http.addHeader("Authorization", "Bearer " + String(DEVICE_TOKEN));
        }
        const int response = http.POST(body, body_len);
        uploaded = response >= 200 && response < 300;
        http.end();
    }
    free(body);
    return uploaded;
}

static void enter_usb_mode()
{
    comm_ws_stop();
    s_usb_mode = true;
    comm_set_transport_mode("usb");
    comm_set_serial_debug(0);
    display_set_serial_debug(0);
    sm_transition(DEVICE_STATE_READY);
    s_display_state = "USB MODE";
    display_show(s_display_state);
}

static bool enter_wifi_mode()
{
    comm_set_serial_debug(0);
    display_set_serial_debug(0);
    if (comm_wifi_connect() != 0) return false;

    s_usb_mode = false;
    s_wifi_deadline = millis() + 20000;
    comm_set_transport_mode("wifi");
    comm_ws_begin();
    display_set_serial_debug(1);
    s_display_state = "WIFI CONNECTING";
    display_show(s_display_state);
    return true;
}

/* --- command handlers invoked from comm_poll() ------------------------------ */

static void handle_capture(
    const char *request_id,
    int patient_id,
    int screening_id
)
{
    if (!s_camera_ok) {
        sm_transition(DEVICE_STATE_ERROR);
        comm_send_error("E_CAMERA", "camera not initialised");
        return;
    }
    sm_transition(DEVICE_STATE_CAPTURING);
    s_display_state = sm_get_display_str();
    display_show(s_display_state);
    flash_set(1);
    delay(120);
    camera_fb_t *fb = camera_capture_frame();
    flash_set(0);

    if (!fb || fb->len == 0) {
        if (fb) camera_return_frame(fb);
        sm_transition(DEVICE_STATE_ERROR);
        comm_send_error("E_CAPTURE", "frame grab failed");
        return;
    }

    sm_transition(DEVICE_STATE_TRANSFERRING);
    s_display_state = sm_get_display_str();
    display_show(s_display_state);
    if (patient_id > 0 && screening_id > 0) {
        if (upload_wifi_image(fb, patient_id, screening_id)) {
            comm_send_capture_ack(request_id);
        } else {
            comm_send_error("E_UPLOAD", "device image upload failed");
        }
    } else {
        comm_send_image_b64(request_id, fb->buf, fb->len, "image/jpeg");
    }
    camera_return_frame(fb);
    sm_transition(DEVICE_STATE_READY);
}

static void handle_display(const char *display_state)
{
    if (display_state && display_state[0]) {
        s_display_state = "";
        display_show(display_state);
    }
}

static void handle_result(const char *prediction, int abstained)
{
    sm_transition(DEVICE_STATE_READY);
    s_display_state = "RESULT AVAILABLE";
    display_show(abstained ? "RECHECK" : "RESULT AVAILABLE");
    (void)prediction;
}

void setup()
{
    Serial.begin(UART_BAUD);
    delay(200);
    Serial.println("\n[BOOT] AI health screening device (Wi-Fi + USB serial)");

    sm_init();
    sensors_init();

    if (display_init() != 0) {
        Serial.println("[BOOT] OLED not available");
    }
    display_show("BOOTING...");

    button_init();
    flash_init();
    s_camera_ok = (camera_init() == 0);
    Serial.printf("[BOOT] camera %s\n", s_camera_ok ? "ready" : "FAILED");
    comm_set_handlers(handle_capture, handle_display, handle_result);

    sm_transition(DEVICE_STATE_CONNECTING);
    if (comm_wifi_connect() == 0) {
        s_usb_mode = false;
        s_wifi_deadline = millis() + 20000;
        comm_set_transport_mode("wifi");
        comm_ws_begin();
        s_display_state = "WIFI CONNECTING";
        display_show(s_display_state);
    } else {
        Serial.println("[BOOT] Wi-Fi unavailable; falling back to USB serial.");
        enter_usb_mode();
    }
}

void loop()
{
    if (button_long_pressed()) {
        if (s_usb_mode) {
            if (!enter_wifi_mode()) {
                comm_ws_stop();
                enter_usb_mode();
            }
        } else {
            enter_usb_mode();
        }
    } else if (button_pressed()) {
        if (s_usb_mode) capture_over_usb();
        else push_status("pressed");
    }

    if (s_usb_mode) return;

    comm_poll();
    if (comm_is_connected()) {
        const unsigned long now = millis();
        s_wifi_deadline = now + 20000;
        if ((now - s_last_status) > STATUS_INTERVAL_MS) {
            s_last_status = now;
            push_status("idle");
        }
    } else if (static_cast<long>(millis() - s_wifi_deadline) >= 0) {
        Serial.println("[BOOT] Wi-Fi backend unavailable; falling back to USB serial.");
        enter_usb_mode();
    }
}
