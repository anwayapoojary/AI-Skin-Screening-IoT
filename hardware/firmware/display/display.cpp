/* 0.96" SSD1306 OLED over I2C (Adafruit driver). Short status lines only —
 * never patient identifiers or full reports (see docs/hardware_specification.md).
 * If your module is an SH1106, swap the library; the interface here is the same. */

#include "display.h"
#include "pins.h"

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define OLED_WIDTH 128
#define OLED_HEIGHT 64

static Adafruit_SSD1306 s_oled(OLED_WIDTH, OLED_HEIGHT, &Wire, -1);
static bool s_ready = false;

int display_init(void)
{
    if (PIN_OLED_SDA < 0 || PIN_OLED_SCL < 0) {
        return -1; /* OLED wiring unconfirmed */
    }
    Wire.begin(PIN_OLED_SDA, PIN_OLED_SCL);
    if (!s_oled.begin(SSD1306_SWITCHCAPVCC, OLED_I2C_ADDR)) {
        s_ready = false;
        return -1;
    }
    s_ready = true;
    s_oled.clearDisplay();
    s_oled.setTextColor(SSD1306_WHITE);
    s_oled.setTextSize(1);
    s_oled.setCursor(0, 0);
    s_oled.println("BOOTING...");
    s_oled.display();
    return 0;
}

void display_show(const char *state_line)
{
    /* Always mirror to serial so debugging works even without the OLED. */
    if (state_line) {
        Serial.print("[OLED] ");
        Serial.println(state_line);
    }
    if (!s_ready || !state_line) {
        return;
    }
    s_oled.clearDisplay();
    s_oled.setCursor(0, 0);
    s_oled.setTextSize(1);
    s_oled.println("Health Screening");
    s_oled.drawFastHLine(0, 12, OLED_WIDTH, SSD1306_WHITE);
    s_oled.setCursor(0, 22);
    s_oled.setTextSize(2);
    s_oled.println(state_line);
    s_oled.display();
}
