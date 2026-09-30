#ifndef CAMERA_H
#define CAMERA_H

#include "esp_camera.h"

#ifdef __cplusplus
extern "C" {
#endif

/* Initialise the OV2640/OV3660 using pins from config/pins.h.
 * Returns 0 on success, -1 if pins are unassigned or init fails. */
int camera_init(void);

/* Capture one JPEG frame. Returns a framebuffer that MUST be released with
 * camera_return_frame(), or NULL on failure. */
camera_fb_t *camera_capture_frame(void);

/* Return a framebuffer to the driver. */
void camera_return_frame(camera_fb_t *fb);

/* 1 if the camera initialised successfully, else 0. */
int camera_ready(void);

#ifdef __cplusplus
}
#endif

#endif
