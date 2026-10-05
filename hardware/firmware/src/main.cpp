/* ESP32-CAM health-screening firmware — device protocol v1.0 over Wi-Fi.
 *
 * Boot -> connect Wi-Fi -> open WebSocket to the backend -> announce
 * DEVICE_CONNECT. The backend (web app) drives screening by sending an
 * IMAGE_CAPTURE command; the device captures a JPEG, flashes the LED, and
 * returns it as IMAGE_TRANSFER. Status/heartbeat keep the dashboard live.
 *
 * The OLED shows only short DISPLAY_STATES strings. Pins live in config/pins.h.
 */

#include <Arduino.h>

#include "button.h"
#include "camera.h"
#include "communication.h"
#include "device_config.h"
#include "display.h"
#include "flash_led.h"
#include "sensors.h"
#include "state_machine.h"

static bool s_camera_ok = false;
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

/* --- command handlers invoked from comm_poll() ------------------------------ */

static void handle_capture(const char *request_id)
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
    delay(120);  // let exposure settle with the flash on
    camera_fb_t *fb = camera_capture_frame();
    flash_set(0);

    if (!fb || fb->len == 0) {
        if (fb) camera_return_frame(fb);
        sm_transition(DEVICE_STATE_ERROR);
        comm_send_error("E_CAPTURE", "frame grab failed");
        s_display_state = sm_get_display_str();
        display_show(s_display_state);
        return;
    }

    sm_transition(DEVICE_STATE_TRANSFERRING);
    s_display_state = sm_get_display_str();
    display_show(s_display_state);
    comm_send_image_b64(request_id, fb->buf, fb->len, "image/jpeg");
    camera_return_frame(fb);
    sm_transition(DEVICE_STATE_READY);
}

static void handle_display(const char *display_state)
{
    if (display_state && display_state[0]) {
        s_display_state = "";  // shown value is transient; keep status simple
        display_show(display_state);
    }
}

static void handle_result(const char *prediction, int abstained)
{
    sm_transition(DEVICE_STATE_READY);
    s_display_state = "RESULT AVAILABLE";
    display_show(abstained ? "RECHECK" : "RESULT AVAILABLE");
    (void)prediction;  // full result stays in the web app, not the OLED
}

static void serial_poll()
{
    if (!Serial.available()) return;
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() == 0) return;

    if (line == "CMD:PING") {
        Serial.println("OK:PONG");
    } else if (line == "CMD:STATUS") {
        Serial.printf("{\"device_id\":\"%s\",\"state\":\"%s\",\"camera\":\"%s\"}\n",
                      DEVICE_ID, sm_get_state_str(), camera_status_str());
    } else if (line == "CMD:CAPTURE") {
        if (!s_camera_ok) {
            Serial.println("ERR:CAMERA_NOT_READY");
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
            Serial.println("ERR:CAPTURE_FAILED");
            display_show("ERROR");
            return;
        }

        sm_transition(DEVICE_STATE_TRANSFERRING);
        display_show("SENDING USB...");
        Serial.printf("IMG_BEGIN:%u\n", fb->len);
        Serial.write(fb->buf, fb->len);
        Serial.println("\nIMG_END");
        camera_return_frame(fb);

        sm_transition(DEVICE_STATE_READY);
        display_show("USB READY");
    } else if (line.startsWith("CMD:DISPLAY:")) {
        String text = line.substring(12);
        display_show(text.c_str());
        Serial.println("OK:DISPLAY");
    }
}

/* --- Arduino entry points --------------------------------------------------- */

void setup()
{
    Serial.begin(UART_BAUD);
    delay(200);
    Serial.println("\n[BOOT] AI health screening device (Dual Mode: Wi-Fi & USB Serial)");

    sm_init();
    sensors_init();

    if (display_init() != 0) {
        Serial.println("[BOOT] OLED not available (check PIN_OLED_* wiring)");
    }
    display_show("BOOTING...");

    button_init();
    flash_init();

    s_camera_ok = (camera_init() == 0);
    Serial.printf("[BOOT] camera %s\n", s_camera_ok ? "ready" : "FAILED");

    comm_set_handlers(handle_capture, handle_display, handle_result);

    sm_transition(DEVICE_STATE_CONNECTING);
    if (comm_wifi_connect() == 0) {
        comm_ws_begin();
        sm_transition(DEVICE_STATE_READY);
        display_show("WIFI READY");
    } else {
        // Wi-Fi not available: Fallback to Direct USB Serial Plug-In mode
        Serial.println("[BOOT] Wi-Fi not connected. Operating in Direct USB Serial mode.");
        sm_transition(DEVICE_STATE_READY);
        display_show("USB READY");
    }

    s_display_state = sm_get_display_str();
}

void loop()
{
    serial_poll();
    comm_poll();

    if (button_pressed()) {
        // Local trigger: report the press so the operator/UI can start a screen.
        push_status("pressed");
    }

    unsigned long now = millis();
    if (comm_is_connected() && (now - s_last_status) > STATUS_INTERVAL_MS) {
        s_last_status = now;
        push_status("idle");
    }
}
