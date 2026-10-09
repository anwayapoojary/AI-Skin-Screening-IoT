/* Push button on PIN_BUTTON, wired to GND with the internal pull-up enabled.
 * button_pressed() returns 1 once per debounced press (falling edge). */

#include "button.h"
#include "pins.h"
#include "device_config.h"

#include <Arduino.h>

static bool s_ready = false;
static int s_stable_level = HIGH;
static int s_candidate_level = HIGH;
static unsigned long s_candidate_since = 0;
static unsigned long s_pressed_at = 0;
static bool s_long_sent = false;
static bool s_short_pending = false;
static bool s_long_pending = false;

static void button_update()
{
    if (!s_ready) return;

    const unsigned long now = millis();
    const int level = digitalRead(PIN_BUTTON);
    if (level != s_candidate_level) {
        s_candidate_level = level;
        s_candidate_since = now;
    }

    if (s_candidate_level != s_stable_level &&
        (now - s_candidate_since) >= BUTTON_DEBOUNCE_MS) {
        const int previous = s_stable_level;
        s_stable_level = s_candidate_level;
        if (s_stable_level == LOW) {
            s_pressed_at = now;
            s_long_sent = false;
        } else if (previous == LOW && !s_long_sent) {
            s_short_pending = true;
        }
    }

    if (s_stable_level == LOW && !s_long_sent &&
        (now - s_pressed_at) >= BUTTON_LONG_PRESS_MS) {
        s_long_sent = true;
        s_long_pending = true;
    }
}

int button_init(void)
{
    if (PIN_BUTTON < 0) {
        return -1;
    }
    pinMode(PIN_BUTTON, INPUT_PULLUP);
    s_stable_level = digitalRead(PIN_BUTTON);
    s_candidate_level = s_stable_level;
    s_candidate_since = millis();
    if (s_stable_level == LOW) s_pressed_at = millis();
    s_ready = true;
    return 0;
}

int button_pressed(void)
{
    button_update();
    const bool pending = s_short_pending;
    s_short_pending = false;
    return pending ? 1 : 0;
}

int button_long_pressed(void)
{
    button_update();
    const bool pending = s_long_pending;
    s_long_pending = false;
    return pending ? 1 : 0;
}
