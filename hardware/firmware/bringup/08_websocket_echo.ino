/*
 * Bring-up Stage 08: WebSocket Protocol Client & Token Auth Test
 * Hardware: ESP32-CAM
 *
 * Backend target: ws://<BACKEND_HOST>:8000/ws/device
 *
 * Verification goal:
 * 1. Open WebSocket connection to FastAPI backend endpoint.
 * 2. Send DEVICE_CONNECT announcement with device ID and token.
 * 3. Send STATUS report and receive acknowledge or ping/pong.
 */

#include <Arduino.h>
#include <WiFi.h>
#include <WebSocketsClient.h>
#include <ArduinoJson.h>

#if __has_include("wifi_secrets.h")
  #include "wifi_secrets.h"
#else
  #define WIFI_SSID "YOUR_WIFI_SSID"
  #define WIFI_PASS "YOUR_WIFI_PASSWORD"
  #define BACKEND_HOST "192.168.1.100"
  #define BACKEND_PORT 8000
  #define DEVICE_ID "DEVICE_001"
  #define DEVICE_TOKEN "dev_device_token_secret"
#endif

WebSocketsClient wsClient;

void webSocketEvent(WStype_t type, uint8_t * payload, size_t length) {
    switch(type) {
        case WStype_DISCONNECTED:
            Serial.println("[WS] Disconnected from server");
            break;
        case WStype_CONNECTED:
            Serial.printf("[WS] Connected to backend! Url: %s\n", payload);
            // Send DEVICE_CONNECT announcement
            {
                StaticJsonDocument<256> doc;
                doc["protocol_version"] = "1.0";
                doc["message_type"] = "DEVICE_CONNECT";
                doc["device_id"] = DEVICE_ID;
                doc["token"] = DEVICE_TOKEN;
                
                String out;
                serializeJson(doc, out);
                wsClient.sendTXT(out);
                Serial.printf("[WS SEND] Handshake: %s\n", out.c_str());
            }
            break;
        case WStype_TEXT:
            Serial.printf("[WS RECV] %s\n", payload);
            break;
        case WStype_BIN:
            Serial.printf("[WS BINARY] %u bytes\n", length);
            break;
        case WStype_ERROR:
            Serial.println("[WS ERROR]");
            break;
        default:
            break;
    }
}

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\nStage 08: WebSocket Protocol Client Test");

    WiFi.begin(WIFI_SSID, WIFI_PASS);
    while (WiFi.status() != WL_CONNECTED) {
        delay(500);
        Serial.print(".");
    }
    Serial.printf("\nWi-Fi connected. Local IP: %s\n", WiFi.localIP().toString().c_str());

    Serial.printf("Connecting to ws://%s:%d/ws/device...\n", BACKEND_HOST, BACKEND_PORT);
    wsClient.begin(BACKEND_HOST, BACKEND_PORT, "/ws/device");
    wsClient.onEvent(webSocketEvent);
    wsClient.setReconnectInterval(5000);
}

void loop() {
    wsClient.loop();

    static unsigned long last_ping = 0;
    if (millis() - last_ping > 10000) {
        last_ping = millis();
        if (wsClient.isConnected()) {
            StaticJsonDocument<256> doc;
            doc["protocol_version"] = "1.0";
            doc["message_type"] = "STATUS";
            doc["device_id"] = DEVICE_ID;
            doc["state"] = "READY";
            doc["display_state"] = "READY";
            doc["camera_state"] = "ok";
            doc["flash_state"] = "off";
            doc["button_state"] = "idle";

            String out;
            serializeJson(doc, out);
            wsClient.sendTXT(out);
            Serial.printf("[WS PING] Status update sent\n");
        }
    }
}
