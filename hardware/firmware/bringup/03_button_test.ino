/*
 * Bring-up Stage 03: Push Button Input & Debounce Test
 * Hardware:
 *   - Push button connected to GPIO13 and GND.
 *   - Optional 10k external pullup resistor between GPIO13 and 3.3V (or internal INPUT_PULLUP).
 *
 * Verification goal:
 * 1. Verify push button triggers transitions accurately without noise.
 * 2. Verify debouncing logic (50ms debounce threshold).
 * 3. Count presses to confirm clean contact actuation.
 */

#include <Arduino.h>

#define PIN_BUTTON 13
#define DEBOUNCE_DELAY_MS 50

static int s_press_count = 0;
static int s_last_raw_state = HIGH;
static int s_stable_state = HIGH;
static unsigned long s_last_debounce_time = 0;

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\nStage 03: Button Debounce Test");
    Serial.printf("Configuring GPIO%d with INPUT_PULLUP...\n", PIN_BUTTON);
    pinMode(PIN_BUTTON, INPUT_PULLUP);
    Serial.println("Press the button to test. Press count will be logged.");
}

void loop() {
    int reading = digitalRead(PIN_BUTTON);

    if (reading != s_last_raw_state) {
        s_last_debounce_time = millis();
    }

    if ((millis() - s_last_debounce_time) > DEBOUNCE_DELAY_MS) {
        if (reading != s_stable_state) {
            s_stable_state = reading;
            if (s_stable_state == LOW) {
                s_press_count++;
                Serial.printf("[BUTTON EVENT] Pressed! Total count = %d\n", s_press_count);
            } else {
                Serial.println("[BUTTON EVENT] Released.");
            }
        }
    }

    s_last_raw_state = reading;
}
