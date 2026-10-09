#ifndef DEVICE_CONFIG_H
#define DEVICE_CONFIG_H

#define FIRMWARE_VERSION "0.2.0-dev"
#define PROTOCOL_VERSION "1.0"

/* Device identity — must match DEVICE_ID the backend expects (default DEVICE_001). */
#ifndef DEVICE_ID
#define DEVICE_ID "DEVICE_001"
#endif

/* Wi-Fi + gateway settings.
 * Provide secrets via PlatformIO build_flags or a gitignored config/wifi_secrets.h.
 * Never commit real credentials.
 */
#if __has_include("wifi_secrets.h")
#include "wifi_secrets.h"
#endif

#ifndef WIFI_SSID
#define WIFI_SSID ""
#endif
#ifndef WIFI_PASSWORD
#define WIFI_PASSWORD ""
#endif

/* Backend host running FastAPI (uvicorn). Point these at your PC's LAN IP. */
#ifndef GATEWAY_HOST
#define GATEWAY_HOST "192.168.1.10"
#endif
#ifndef GATEWAY_PORT
#define GATEWAY_PORT 8000
#endif
#ifndef GATEWAY_WS_PATH
#define GATEWAY_WS_PATH "/ws/device"
#endif
#ifndef DEVICE_TOKEN
#define DEVICE_TOKEN ""
#endif

/* Timing (milliseconds). */
#define HEARTBEAT_INTERVAL_MS 10000
#define STATUS_INTERVAL_MS    5000
#define WS_RECONNECT_MS       5000
#define BUTTON_DEBOUNCE_MS    40
#define BUTTON_LONG_PRESS_MS  2000

/* Camera capture settings. SVGA (800x600) JPEG is a good size/quality balance
 * for the screening pipeline and fits in PSRAM. Lower if you hit memory limits.
 */
#define CAM_FRAMESIZE FRAMESIZE_SVGA
#define CAM_JPEG_QUALITY 12   /* 10-15 typical; lower number = higher quality/larger */

#define UART_BAUD 921600      /* USB image-frame transport baud */

#endif  /* DEVICE_CONFIG_H */
