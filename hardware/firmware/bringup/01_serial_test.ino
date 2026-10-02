/*
 * Bring-up Stage 01: Serial & FTDI Loopback Test
 * Hardware: ESP32-CAM connected via FTDI USB-to-UART adapter.
 * Baud: 115200
 *
 * Verification goal:
 * 1. Confirm FTDI TX/RX wiring is correct (FTDI TX -> ESP32 U0R, FTDI RX -> ESP32 U0T).
 * 2. Confirm power delivery (5V supply, stable 3.3V logic level).
 * 3. Print ESP32 chip info, core revision, SDK version, and echo input.
 */

#include <Arduino.h>

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\n========================================");
    Serial.println("Stage 01: Serial & FTDI Bring-up Test");
    Serial.println("========================================");
    Serial.printf("Chip Model: %s (Rev %d)\n", ESP.getChipModel(), ESP.getChipRevision());
    Serial.printf("Cores: %d, CPU Freq: %d MHz\n", ESP.getChipCores(), ESP.getCpuFreqMHz());
    Serial.printf("Flash Size: %d KB\n", ESP.getFlashChipSize() / 1024);
    Serial.printf("Free Heap: %d bytes\n", ESP.getFreeHeap());
    Serial.printf("PSRAM Found: %s (%d bytes free)\n", 
                  psramFound() ? "YES" : "NO", 
                  psramFound() ? ESP.getFreePsram() : 0);
    Serial.println("Type characters in terminal to test echo:");
}

void loop() {
    if (Serial.available()) {
        char c = Serial.read();
        Serial.printf("[ECHO] Received: '%c' (0x%02X)\n", c, (unsigned char)c);
    }
}
