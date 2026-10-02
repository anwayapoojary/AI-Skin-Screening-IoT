/*
 * Bring-up Stage 02: Flash LED & External Indicator Test
 * Hardware:
 *   - Onboard high-power white flash LED on GPIO4.
 *   - Optional external white LED with 220R resistor to GND from GPIO4 or indicator on GPIO33.
 *
 * Verification goal:
 * 1. Confirm GPIO4 output capability.
 * 2. Verify flash LED turns on without causing supply voltage drop/brownout.
 *    (Use 5V 2A supply, never power high-power flash LED solely from FTDI 3.3V pin).
 */

#include <Arduino.h>

#define PIN_FLASH_LED 4
#define PIN_ONBOARD_RED 33  // Active LOW on many AI-Thinker boards

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\nStage 02: Flash LED Test");
    Serial.println("Testing GPIO4 Flash LED pulse (500ms ON / 2000ms OFF)...");
    
    pinMode(PIN_FLASH_LED, OUTPUT);
    digitalWrite(PIN_FLASH_LED, LOW);

    pinMode(PIN_ONBOARD_RED, OUTPUT);
    digitalWrite(PIN_ONBOARD_RED, HIGH); // Off
}

void loop() {
    Serial.println("LED ON (Flash pulsing)...");
    digitalWrite(PIN_FLASH_LED, HIGH);
    digitalWrite(PIN_ONBOARD_RED, LOW);
    delay(500);

    Serial.println("LED OFF...");
    digitalWrite(PIN_FLASH_LED, LOW);
    digitalWrite(PIN_ONBOARD_RED, HIGH);
    delay(2000);
}
