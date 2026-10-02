#include <Arduino.h>
#include "camera.h"
#include "pins.h"
#include "device_config.h"

static bool s_ready = false;

int camera_init(void)
{
    if (XCLK_GPIO_NUM < 0 || Y2_GPIO_NUM < 0) {
        return -1; /* camera pins unassigned (BOARD_OTHER) — cannot init */
    }

    camera_config_t config = {};
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
    config.pin_sscb_sda = SIOD_GPIO_NUM;  /* esp32-camera (arduino-esp32 2.0.x) field name */
    config.pin_sscb_scl = SIOC_GPIO_NUM;
    config.pin_pwdn = PWDN_GPIO_NUM;
    config.pin_reset = RESET_GPIO_NUM;
    config.xclk_freq_hz = 20000000;
    config.pixel_format = PIXFORMAT_JPEG;

    /* Use PSRAM for larger frames if present. */
    if (psramFound()) {
        config.frame_size = CAM_FRAMESIZE;
        config.jpeg_quality = CAM_JPEG_QUALITY;
        config.fb_count = 2;
        config.fb_location = CAMERA_FB_IN_PSRAM;
        config.grab_mode = CAMERA_GRAB_LATEST;
    } else {
        /* Fall back to a smaller frame that fits in internal RAM. */
        config.frame_size = FRAMESIZE_VGA;
        config.jpeg_quality = 15;
        config.fb_count = 1;
        config.fb_location = CAMERA_FB_IN_DRAM;
    }

    esp_err_t err = esp_camera_init(&config);
    if (err != ESP_OK) {
        s_ready = false;
        return -1;
    }

    /* OV3660 sensors benefit from a couple of tweaks. */
    sensor_t *s = esp_camera_sensor_get();
    if (s) {
        if (s->id.PID == OV3660_PID) {
            s->set_vflip(s, 1);
            s->set_brightness(s, 1);
            s->set_saturation(s, -2);
        }
    }

    s_ready = true;
    return 0;
}

camera_fb_t *camera_capture_frame(void)
{
    if (!s_ready) {
        return NULL;
    }
    return esp_camera_fb_get();
}

void camera_return_frame(camera_fb_t *fb)
{
    if (fb) {
        esp_camera_fb_return(fb);
    }
}

int camera_ready(void)
{
    return s_ready ? 1 : 0;
}
