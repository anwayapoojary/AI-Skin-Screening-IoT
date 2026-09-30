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

/* Onboard white flash LED on AI-Thinker ESP32-CAM. */
#define PIN_FLASH_LED    4
/* Onboard red status LED (active-low) — optional. */
#define PIN_STATUS_LED  33

/* --- Peripherals YOU wire (these are the only truly free GPIOs) ------------
 * GPIO 12/13/14/15 are the practical free pins on this board and are SHARED
 * with the microSD slot. Do NOT use the microSD card if you use these for the
 * OLED/button. Confirm against your wiring; reassign here if needed.
 */
#define PIN_OLED_SDA    14   /* I2C SDA for the 0.96" SSD1306 OLED (confirm) */
#define PIN_OLED_SCL    15   /* I2C SCL (confirm) */
#define PIN_BUTTON      13   /* push button to GND, uses internal pull-up (confirm) */

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
