/*
 * Bring-up Stage 04: I2C Bus Scanner
 * Hardware:
 *   - 0.96 inch SSD1306 OLED display.
 *   - SDA -> GPIO14
 *   - SCL -> GPIO15
 *   - VCC -> 3.3V or 5V (depending on OLED breakout regulator)
 *   - GND -> GND
 *
 * Verification goal:
 * 1. Confirm Wire I2C pins GPIO14 and GPIO15 function.
 * 2. Discover connected I2C devices. SSD1306 should respond at 0x3C (or 0x3D).
 */

#include <Arduino.h>
#include <Wire.h>

#define I2C_SDA 14
#define I2C_SCL 15

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\nStage 04: I2C Bus Scanner");
    Serial.printf("Initializing Wire on SDA=GPIO%d, SCL=GPIO%d...\n", I2C_SDA, I2C_SCL);
    Wire.begin(I2C_SDA, I2C_SCL);
}

void loop() {
    byte error, address;
    int nDevices = 0;

    Serial.println("Scanning I2C bus (0x01 to 0x7E)...");

    for (address = 1; address < 127; address++) {
        Wire.beginTransmission(address);
        error = Wire.endTransmission();

        if (error == 0) {
            Serial.printf("  -> I2C device found at address 0x%02X", address);
            if (address == 0x3C || address == 0x3D) {
                Serial.print(" (Typical SSD1306 OLED!)");
            }
            Serial.println();
            nDevices++;
        } else if (error == 4) {
            Serial.printf("  -> Unknown error at address 0x%02X\n", address);
        }
    }

    if (nDevices == 0) {
        Serial.println("No I2C devices found. Check wiring (SDA=14, SCL=15, VCC, GND).");
    } else {
        Serial.printf("Scan complete. %d device(s) found.\n", nDevices);
    }

    delay(5000);
}
