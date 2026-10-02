/*
 * Bring-up Stage 07: Wi-Fi Connectivity & Signal Test
 * Hardware: ESP32-CAM onboard Wi-Fi (2.4GHz b/g/n)
 *
 * Configuration:
 *   Credentials read from wifi_secrets.h (or fallback to prompt).
 *
 * Verification goal:
 * 1. Establish connection to local 2.4GHz access point.
 * 2. Obtain DHCP IP address, gateway, subnet mask, DNS.
 * 3. Measure Wi-Fi RSSI (signal strength) to verify antenna suitability.
 */

#include <Arduino.h>
#include <WiFi.h>

#if __has_include("wifi_secrets.h")
  #include "wifi_secrets.h"
#else
  #define WIFI_SSID "YOUR_WIFI_SSID"
  #define WIFI_PASS "YOUR_WIFI_PASSWORD"
#endif

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\nStage 07: Wi-Fi Connectivity Test");
    Serial.printf("Connecting to Wi-Fi SSID: %s\n", WIFI_SSID);

    WiFi.mode(WIFI_STA);
    WiFi.begin(WIFI_SSID, WIFI_PASS);

    int attempts = 0;
    while (WiFi.status() != WL_CONNECTED && attempts < 40) {
        delay(500);
        Serial.print(".");
        attempts++;
    }
    Serial.println();

    if (WiFi.status() == WL_CONNECTED) {
        Serial.println("Wi-Fi connected successfully!");
        Serial.printf("IP Address: %s\n", WiFi.localIP().toString().c_str());
        Serial.printf("Gateway IP: %s\n", WiFi.gatewayIP().toString().c_str());
        Serial.printf("Subnet Mask: %s\n", WiFi.subnetMask().toString().c_str());
        Serial.printf("DNS Server: %s\n", WiFi.dnsIP().toString().c_str());
        Serial.printf("RSSI: %d dBm (Signal: %s)\n", 
                      WiFi.RSSI(), 
                      WiFi.RSSI() > -60 ? "EXCELLENT" : (WiFi.RSSI() > -75 ? "GOOD" : "WEAK"));
    } else {
        Serial.println("[ERROR] Failed to connect to Wi-Fi. Check SSID/Password and 2.4GHz AP band.");
    }
}

void loop() {
    if (WiFi.status() == WL_CONNECTED) {
        Serial.printf("Heartbeat: Wi-Fi connected, RSSI = %d dBm\n", WiFi.RSSI());
    } else {
        Serial.println("[WARNING] Wi-Fi disconnected!");
    }
    delay(5000);
}
