#ifndef PINS_H
#define PINS_H

/* ---------------------------------------------------------------------------
 * ESP32-CAM pin map.
 *
 * Board selected by the user: generic "ESP32 Camera Development Board" with
 * OV2640/OV3660 — this uses the well-documented AI-Thinker ESP32-CAM pinout,
 * which is the reference wiring for this PCB family. The camera + flash pins
 * below are that documented map (NOT invented). Still verify against the
 * silkscreen of the exact module you received before flashing.
 *
 * Only the OLED and button nets are yours to wire — they are marked clearly.
 * ------------------------------------------------------------------------- */

/* Choose the board profile. Define exactly one. */
#define BOARD_ESP32CAM_AITHINKER 1
/* #define BOARD_OTHER 1  // keep camera pins UNASSIGNED and fill from datasheet */

#define PIN_UNASSIGNED (-1)

#if defined(BOARD_ESP32CAM_AITHINKER)

/* --- OV2640/OV3660 DVP camera (AI-Thinker ESP32-CAM reference pinout) --- */
#define PWDN_GPIO_NUM   32
#define RESET_GPIO_NUM  -1   /* not routed on this board */
#define XCLK_GPIO_NUM    0
#define SIOD_GPIO_NUM   26   /* SCCB SDA */
#define SIOC_GPIO_NUM   27   /* SCCB SCL */
#define Y9_GPIO_NUM     35
#define Y8_GPIO_NUM     34
#define Y7_GPIO_NUM     39
#define Y6_GPIO_NUM     36
#define Y5_GPIO_NUM     21
#define Y4_GPIO_NUM     19
#define Y3_GPIO_NUM     18
#define Y2_GPIO_NUM      5
#define VSYNC_GPIO_NUM  25
#define HREF_GPIO_NUM   23
#define PCLK_GPIO_NUM   22

/* Onboard high-power white strobe/flash LED on AI-Thinker ESP32-CAM. */
#define PIN_FLASH_LED        4
/* Optional external white status indicator LED via 220Ω resistor to GND.
 * NOTE: GPIO12 is a strapping pin (MTDI/voltage select at boot). Must be LOW at boot! */
#define PIN_INDICATOR_LED   12
/* Onboard red status LED (active-low) — optional. */
#define PIN_STATUS_LED      33

/* --- Peripherals YOU wire (no microSD card allowed) ------------------------
 * Pins 12, 13, 14, 15 are shared with the microSD slot. Do NOT insert or use
 * an SD card!
 *
 * Strapping pin cautions:
 * - GPIO12: boot voltage select; keep LOW or pulled down during reset.
 * - GPIO15: debug log output control; keep HIGH/silent at boot.
 * - GPIO0: flash mode select only; jumper to GND during flashing, remove after.
 *
 * Wire assignments:
 * - Button: GPIO13 with 10kΩ external pull-up to 3.3V, momentary switch to GND.
 * - OLED I2C: SDA to GPIO15, SCL to GPIO14, VCC to 3.3V, GND to GND.
 * - Main strobe: onboard flash LED GPIO4.
 * - Indicator LED: GPIO12 via 220Ω resistor to GND.
 */
#define PIN_OLED_SDA        15   /* I2C SDA for the 0.96" SSD1306 OLED (VCC: 3.3V) */
#define PIN_OLED_SCL        14   /* I2C SCL for the 0.96" SSD1306 OLED */
#define PIN_BUTTON          13   /* Tactile push button (10kΩ pull-up to 3.3V, switch to GND) */

#else  /* BOARD_OTHER — do not guess; copy from your module's datasheet. */

#define PWDN_GPIO_NUM   PIN_UNASSIGNED
#define RESET_GPIO_NUM  PIN_UNASSIGNED
#define XCLK_GPIO_NUM   PIN_UNASSIGNED
#define SIOD_GPIO_NUM   PIN_UNASSIGNED
#define SIOC_GPIO_NUM   PIN_UNASSIGNED
#define Y9_GPIO_NUM     PIN_UNASSIGNED
#define Y8_GPIO_NUM     PIN_UNASSIGNED
#define Y7_GPIO_NUM     PIN_UNASSIGNED
#define Y6_GPIO_NUM     PIN_UNASSIGNED
#define Y5_GPIO_NUM     PIN_UNASSIGNED
#define Y4_GPIO_NUM     PIN_UNASSIGNED
#define Y3_GPIO_NUM     PIN_UNASSIGNED
#define Y2_GPIO_NUM     PIN_UNASSIGNED
#define VSYNC_GPIO_NUM  PIN_UNASSIGNED
#define HREF_GPIO_NUM   PIN_UNASSIGNED
#define PCLK_GPIO_NUM   PIN_UNASSIGNED
#define PIN_FLASH_LED   PIN_UNASSIGNED
#define PIN_STATUS_LED  PIN_UNASSIGNED
#define PIN_OLED_SDA    PIN_UNASSIGNED
#define PIN_OLED_SCL    PIN_UNASSIGNED
#define PIN_BUTTON      PIN_UNASSIGNED

#endif

/* I2C address for the 0.96" SSD1306 (0x3C typical; some modules 0x3D). */
#ifndef OLED_I2C_ADDR
#define OLED_I2C_ADDR 0x3C
#endif

#endif  /* PINS_H */
