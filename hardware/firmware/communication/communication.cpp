/* Wi-Fi + WebSocket JSON client implementing device protocol v1.0.
 *
 * The ESP32-CAM is the WebSocket CLIENT: it connects out to the FastAPI backend
 * at ws://GATEWAY_HOST:GATEWAY_PORT/GATEWAY_WS_PATH, announces itself with
 * DEVICE_CONNECT, then streams HEARTBEAT/DEVICE_STATUS and answers commands.
 *
 * Libraries (see platformio.ini lib_deps):
 *   - links2004/WebSockets   (WebSocketsClient)
 *   - bblanchon/ArduinoJson  (envelope build/parse)
 * Base64 uses mbedtls (bundled in the ESP32 core).
 */

#include "communication.h"
#include "device_config.h"

#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>
#include "mbedtls/base64.h"

static WebSocketsClient s_ws;
static bool s_ws_connected = false;   // socket open
static bool s_acked = false;          // DEVICE_CONNECT acknowledged
static unsigned long s_last_hb = 0;
static unsigned long s_last_status = 0;

static comm_capture_cb s_on_capture = nullptr;
static comm_display_cb s_on_display = nullptr;
static comm_result_cb s_on_result = nullptr;

void comm_set_handlers(comm_capture_cb on_capture, comm_display_cb on_display, comm_result_cb on_result)
{
    s_on_capture = on_capture;
    s_on_display = on_display;
    s_on_result = on_result;
}

int comm_wifi_connect(void)
{
    if (WIFI_SSID[0] == '\0') {
        Serial.println("[WIFI] no SSID configured (set WIFI_SSID in wifi_secrets.h)");
        return -1;
    }
    Serial.printf("[WIFI] connecting to %s\n", WIFI_SSID);
    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
    unsigned long start = millis();
    while (WiFi.status() != WL_CONNECTED && (millis() - start) < 20000) {
        delay(250);
        Serial.print('.');
    }
    Serial.println();
    if (WiFi.status() != WL_CONNECTED) {
        Serial.println("[WIFI] connect failed");
        return -1;
    }
    Serial.print("[WIFI] connected, IP=");
    Serial.println(WiFi.localIP());
    return 0;
}

/* Build the standard envelope header into a JSON document. */
static void fill_envelope(JsonDocument &doc, const char *message_type)
{
    doc["protocol_version"] = PROTOCOL_VERSION;
    doc["device_id"] = DEVICE_ID;
    doc["message_type"] = message_type;
    doc["timestamp"] = (uint32_t)millis();  // uptime ms; server stamps its own time
}

static int send_doc(JsonDocument &doc)
{
    if (!s_ws_connected) {
        return -1;
    }
    String out;
    serializeJson(doc, out);
    return s_ws.sendTXT(out) ? 0 : -1;
}

static void send_device_connect(void)
{
    StaticJsonDocument<256> doc;
    fill_envelope(doc, "DEVICE_CONNECT");
    JsonObject p = doc.createNestedObject("payload");
    p["firmware_version"] = FIRMWARE_VERSION;
    p["protocol_version"] = PROTOCOL_VERSION;
    send_doc(doc);
}

int comm_send_status(const char *state, const char *display_state,
                     const char *camera_status, const char *flash, const char *button)
{
    StaticJsonDocument<384> doc;
    fill_envelope(doc, "DEVICE_STATUS");
    JsonObject p = doc.createNestedObject("payload");
    p["state"] = state ? state : "READY";
    p["display_state"] = display_state ? display_state : "READY";
    p["camera_status"] = camera_status ? camera_status : "unknown";
    p["sensor_status"] = "unavailable";
    p["communication_status"] = "ok";
    p["firmware_version"] = FIRMWARE_VERSION;
    p["protocol_version"] = PROTOCOL_VERSION;
    if (flash) p["flash"] = flash;
    if (button) p["button"] = button;
    return send_doc(doc);
}

static int send_heartbeat(void)
{
    StaticJsonDocument<192> doc;
    fill_envelope(doc, "HEARTBEAT");
    doc.createNestedObject("payload");
    return send_doc(doc);
}

int comm_send_error(const char *code, const char *message)
{
    StaticJsonDocument<256> doc;
    fill_envelope(doc, "ERROR");
    JsonObject p = doc.createNestedObject("payload");
    p["code"] = code ? code : "E_INVALID_CMD";
    p["message"] = message ? message : "";
    return send_doc(doc);
}

int comm_send_image_b64(const char *request_id, const uint8_t *data, size_t len, const char *mime)
{
    if (!s_ws_connected || !data || len == 0) {
        return -1;
    }
    /* Base64-encode the JPEG. */
    size_t b64_cap = 4 * ((len + 2) / 3) + 1;
    uint8_t *b64 = (uint8_t *)(psramFound() ? ps_malloc(b64_cap) : malloc(b64_cap));
    if (!b64) {
        comm_send_error("E_IMAGE", "oom encoding image");
        return -1;
    }
    size_t olen = 0;
    if (mbedtls_base64_encode(b64, b64_cap, &olen, data, len) != 0) {
        free(b64);
        comm_send_error("E_IMAGE", "base64 encode failed");
        return -1;
    }

    /* Assemble the envelope manually to avoid a second large copy in ArduinoJson. */
    char header[256];
    int hlen = snprintf(header, sizeof(header),
        "{\"protocol_version\":\"%s\",\"device_id\":\"%s\",\"message_type\":\"IMAGE_TRANSFER\","
        "\"timestamp\":%u,\"payload\":{\"request_id\":\"%s\",\"mime\":\"%s\",\"bytes\":%u,"
        "\"image_b64\":\"",
        PROTOCOL_VERSION, DEVICE_ID, (unsigned)millis(),
        request_id ? request_id : "", mime ? mime : "image/jpeg", (unsigned)len);
    const char *footer = "\"}}";

    size_t total = hlen + olen + strlen(footer);
    char *msg = (char *)(psramFound() ? ps_malloc(total + 1) : malloc(total + 1));
    if (!msg) {
        free(b64);
        comm_send_error("E_IMAGE", "oom framing image");
        return -1;
    }
    memcpy(msg, header, hlen);
    memcpy(msg + hlen, b64, olen);
    memcpy(msg + hlen + olen, footer, strlen(footer));
    msg[total] = '\0';
    free(b64);

    bool ok = s_ws.sendTXT((uint8_t *)msg, total);
    free(msg);
    return ok ? 0 : -1;
}

/* Route a decoded command envelope from the server. */
static void handle_command(const char *mtype, JsonObjectConst payload)
{
    if (strcmp(mtype, "IMAGE_CAPTURE") == 0) {
        const char *req = payload["request_id"] | "";
        if (s_on_capture) s_on_capture(req);
    } else if (strcmp(mtype, "SET_DISPLAY") == 0) {
        const char *ds = payload["display_state"] | "";
        if (s_on_display) s_on_display(ds);
    } else if (strcmp(mtype, "SCREENING_RESULT") == 0) {
        const char *pred = payload["prediction"] | "";
        int abst = (payload["abstained"] | false) ? 1 : 0;
        if (s_on_result) s_on_result(pred, abst);
    } else if (strcmp(mtype, "SCREENING_START") == 0) {
        if (s_on_display) s_on_display("ANALYZING...");
    } else if (strcmp(mtype, "ACK") == 0) {
        s_acked = true;
    }
}

static void on_ws_text(uint8_t *payload, size_t length)
{
    StaticJsonDocument<1024> doc;
    DeserializationError err = deserializeJson(doc, payload, length);
    if (err) {
        comm_send_error("E_INVALID_CMD", "malformed JSON");
        return;
    }
    const char *mtype = doc["message_type"] | "";
    JsonObjectConst p = doc["payload"].as<JsonObjectConst>();
    handle_command(mtype, p);
}

static void ws_event(WStype_t type, uint8_t *payload, size_t length)
{
    switch (type) {
        case WStype_CONNECTED:
            s_ws_connected = true;
            s_acked = false;
            Serial.println("[WS] connected");
            send_device_connect();
            break;
        case WStype_DISCONNECTED:
            s_ws_connected = false;
            s_acked = false;
            Serial.println("[WS] disconnected");
            break;
        case WStype_TEXT:
            on_ws_text(payload, length);
            break;
        default:
            break;
    }
}

void comm_ws_begin(void)
{
    s_ws.begin(GATEWAY_HOST, GATEWAY_PORT, GATEWAY_WS_PATH);
    s_ws.onEvent(ws_event);
    s_ws.setReconnectInterval(WS_RECONNECT_MS);
    s_ws.enableHeartbeat(15000, 3000, 2);  // ping/pong keepalive at the socket layer
}

void comm_poll(void)
{
    s_ws.loop();
    unsigned long now = millis();
    if (s_ws_connected && (now - s_last_hb) > HEARTBEAT_INTERVAL_MS) {
        s_last_hb = now;
        send_heartbeat();
    }
}

int comm_is_connected(void)
{
    return (s_ws_connected && s_acked) ? 1 : 0;
}
