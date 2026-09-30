#ifndef COMMUNICATION_H
#define COMMUNICATION_H

#include <stddef.h>
#include <stdint.h>

#ifdef __cplusplus
extern "C" {
#endif

/* Command handlers invoked from comm_poll() when the server sends a command.
 * The communication layer owns all JSON parsing; main.cpp just reacts. */
typedef void (*comm_capture_cb)(const char *request_id);
typedef void (*comm_display_cb)(const char *display_state);
typedef void (*comm_result_cb)(const char *prediction, int abstained);

void comm_set_handlers(comm_capture_cb on_capture,
                       comm_display_cb on_display,
                       comm_result_cb on_result);

/* Connect to Wi-Fi. Returns 0 on success, -1 if no SSID / connect failed. */
int comm_wifi_connect(void);

/* Begin the WebSocket client to GATEWAY_HOST:GATEWAY_PORT/GATEWAY_WS_PATH. */
void comm_ws_begin(void);

/* Service the socket + periodic heartbeat/status. Call every loop(). */
void comm_poll(void);

/* 1 when the WebSocket is connected and DEVICE_CONNECT was acknowledged. */
int comm_is_connected(void);

/* Outbound protocol messages (device -> server). Return 0 on success. */
int comm_send_status(const char *state, const char *display_state,
                     const char *camera_status, const char *flash, const char *button);
int comm_send_image_b64(const char *request_id, const uint8_t *data, size_t len, const char *mime);
int comm_send_error(const char *code, const char *message);

#ifdef __cplusplus
}
#endif

#endif
