/* White flash LED on PIN_FLASH_LED (onboard GPIO4 on AI-Thinker ESP32-CAM).
 * Active-high: HIGH turns the LED on. */

#include "flash_led.h"
#include "pins.h"

#include <Arduino.h>

static bool s_ready = false;

int flash_init(void)
{
    if (PIN_FLASH_LED < 0) {
        return -1;
    }
    pinMode(PIN_FLASH_LED, OUTPUT);
    digitalWrite(PIN_FLASH_LED, LOW);
    s_ready = true;
    return 0;
}

void flash_set(int on)
{
    if (!s_ready) {
        return;
    }
    digitalWrite(PIN_FLASH_LED, on ? HIGH : LOW);
}
