/*
 * Bring-up Stage 05: OLED SSD1306 Graphic & Text Test
 * Hardware:
 *   - 0.96 inch 128x64 SSD1306 OLED (I2C)
 *   - SDA=14, SCL=15, Addr=0x3C
 *
 * Verification goal:
 * 1. Initialize Adafruit_SSD1306 driver.
 * 2. Display short status messages per protocol (BOOTING..., READY, CAPTURING...).
 * 3. Confirm display clears and redraws without corruption.
 */

#include <Arduino.h>
#include <Wire.h>
#include <Adafruit_GFX.h>
#include <Adafruit_SSD1306.h>

#define SCREEN_WIDTH 128
#define SCREEN_HEIGHT 64
#define OLED_RESET -1
#define OLED_ADDR 0x3C
#define PIN_SDA 14
#define PIN_SCL 15

Adafruit_SSD1306 display(SCREEN_WIDTH, SCREEN_HEIGHT, &Wire, OLED_RESET);

static const char* s_demo_states[] = {
    "BOOTING...",
    "READY",
    "CAPTURING...",
    "PROCESSING...",
    "RESULT READY",
    "ERROR"
};

void show_card(const char* header, const char* body) {
    display.clearDisplay();
    display.setTextSize(1);
    display.setTextColor(SSD1306_WHITE);
    display.setCursor(0, 4);
    display.println("AI SKIN SCREEN");
    display.drawLine(0, 16, SCREEN_WIDTH - 1, 16, SSD1306_WHITE);
    
    display.setTextSize(1);
    display.setCursor(0, 24);
    display.println(header);

    display.setTextSize(2);
    display.setCursor(0, 40);
    display.println(body);
    display.display();
}

void setup() {
    Serial.begin(115200);
    delay(500);
    Serial.println("\nStage 05: OLED Display Test");

    Wire.begin(PIN_SDA, PIN_SCL);
    if (!display.begin(SSD1306_SWITCHCAPVCC, OLED_ADDR)) {
        Serial.println("[ERROR] SSD1306 allocation failed. Check wiring and address!");
        while (1) delay(100);
    }
    Serial.println("SSD1306 OLED initialized successfully.");
}

void loop() {
    for (int i = 0; i < 6; i++) {
        Serial.printf("Displaying: %s\n", s_demo_states[i]);
        show_card("DEVICE STATE:", s_demo_states[i]);
        delay(2000);
    }
}
