/* Push button on PIN_BUTTON, wired to GND with the internal pull-up enabled.
 * button_pressed() returns 1 once per debounced press (falling edge). */

#include "button.h"
#include "pins.h"
#include "device_config.h"

#include <Arduino.h>

static bool s_ready = false;
static int s_last_level = HIGH;
static unsigned long s_last_change = 0;

int button_init(void)
{
    if (PIN_BUTTON < 0) {
        return -1;
    }
    pinMode(PIN_BUTTON, INPUT_PULLUP);
    s_last_level = digitalRead(PIN_BUTTON);
    s_ready = true;
    return 0;
}

int button_pressed(void)
{
    if (!s_ready) {
        return 0;
    }
    int level = digitalRead(PIN_BUTTON);
    unsigned long now = millis();
    if (level != s_last_level && (now - s_last_change) > BUTTON_DEBOUNCE_MS) {
        s_last_change = now;
        s_last_level = level;
        if (level == LOW) {
            return 1; /* pressed (pull-up -> LOW when button closes to GND) */
        }
    }
    return 0;
}
