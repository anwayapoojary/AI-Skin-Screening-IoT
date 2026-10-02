/*
 * Bring-up Stage 06: OV2640 / OV3660 Camera Capture Test
 * Hardware:
 *   - AI-Thinker ESP32-CAM onboard camera module.
 *   - PSRAM enabled.
 *
 * Verification goal:
 * 1. Initialize esp_camera with AI-Thinker camera pin mapping.
 * 2. Configure SVGA JPEG capture.
 * 3. Capture a test frame, measure frame size and duration, return buffer.
 */

#include <Arduino.h>
#include "esp_camera.h"

// AI-Thinker ESP32-CAM pin configuration
#define PWDN_GPIO_NUM     32
#define RESET_GPIO_NUM    -1
#define XCLK_GPIO_NUM      0
#define SIOD_GPIO_NUM     26
#define SIOC_GPIO_NUM     27
#define Y9_GPIO_NUM       35
#define Y8_GPIO_NUM       34
#define Y7_GPIO_NUM       39
#define Y6_GPIO_NUM       36
#define Y5_GPIO_NUM       21
#define Y4_GPIO_NUM       19
#define Y3_GPIO_NUM       18
#define Y2_GPIO_NUM        5
#define VSYNC_GPIO_NUM    25
#define HREF_GPIO_NUM     23
#define PCLK_GPIO_NUM     22

void setup() {
    Serial.begin(115200);
    delay(1000);
    Serial.println("\nStage 06: Camera Initialization & Capture Test");

    camera_config_t config;
    config.ledc_channel = LEDC_CHANNEL_0;
    config.ledc_timer = LEDC_TIMER_0;
    config.pin_d0 = Y2_GPIO_NUM;
    config.pin_d1 = Y3_GPIO_NUM;
    config.pin_d2 = Y4_GPIO_NUM;
    config.pin_d3 = Y5_GPIO_NUM;
    config.pin_d4 = Y6_GPIO_NUM;
    config.pin_d5 = Y7_GPIO_NUM;
    config.pin_d6 = Y8_GPIO_NUM;
    config.pin_d7 = Y9_GPIO_NUM;
    config.pin_xclk = XCLK_GPIO_NUM;
    config.pin_pclk = PCLK_GPIO_NUM;
    config.pin_vsync = VSYNC_GPIO_NUM;
    config.pin_href = HREF_GPIO_NUM;
    config.pin_sscb_sda = SIOD_GPIO_NUM;
    config.pin_sscb_scl = SIOC_GPIO_NUM;
    config.pin_pwdn = PWDN_GPIO_NUM;
    config.pin_reset = RESET_GPIO_NUM;
    config.xclk_freq_hz = 20000000;
    config.pixel_format = PIXFORMAT_JPEG;

    if (psramFound()) {
        config.frame_size = FRAMESIZE_SVGA; // 800x600
        config.jpeg_quality = 12;
        config.fb_count = 2;
        Serial.println("PSRAM found. Using SVGA (800x600) with double buffering.");
    } else {
        config.frame_size = FRAMESIZE_VGA;
        config.jpeg_quality = 14;
        config.fb_count = 1;
        Serial.println("PSRAM not found. Falling back to VGA (640x480).");
    }

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        Serial.printf("[ERROR] Camera init failed with error 0x%x\n", err);
        while (1) delay(100);
    }
    Serial.println("Camera initialized successfully!");
}

void loop() {
    Serial.println("Capturing frame...");
    unsigned long start_time = millis();
    camera_fb_t *fb = esp_camera_fb_get();
    unsigned long duration = millis() - start_time;

    if (!fb) {
        Serial.println("[ERROR] Frame capture failed!");
    } else {
        Serial.printf("Frame captured: %u bytes in %lu ms (W: %d, H: %d, Format: %d)\n", 
                      fb->len, duration, fb->width, fb->height, fb->format);
        esp_camera_fb_return(fb);
    }

    delay(3000);
}
