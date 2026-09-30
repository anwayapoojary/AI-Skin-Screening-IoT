# Device Protocol v1.0

JSON envelopes over **Wi-Fi (WebSocket)**. UART/FTDI is for flashing and logs only.

See `hardware/protocols/schema.py` and `hardware/protocols/constants.py` for the
source of truth.

## Transport

The ESP32-CAM is the WebSocket **client**. It connects out to the backend at
`ws://<backend-host>:8000/ws/device`, so no inbound firewall rule on the device
is needed. The backend keeps a registry of connected devices
(`hardware/device_gateway/connection_manager.py`) and correlates commands with
responses by `request_id`.

## Envelope

```json
{
  "protocol_version": "1.0",
  "device_id": "DEVICE_001",
  "message_type": "DEVICE_STATUS",
  "timestamp": "<iso8601 or device uptime ms>",
  "payload": { }
}
```

## Message types

| Type | Direction | Purpose |
|------|-----------|---------|
| `DEVICE_CONNECT` | device → server | First frame; announces device_id + firmware |
| `ACK` | server → device | Acknowledges DEVICE_CONNECT / a command |
| `DEVICE_STATUS` | device → server | state, camera_status, display_state, flash, button |
| `HEARTBEAT` | device → server | Keepalive (every ~10 s) |
| `IMAGE_CAPTURE` | server → device | Command: capture one image (carries `request_id`) |
| `IMAGE_TRANSFER` | device → server | Captured JPEG as base64 (`image_b64`, `mime`, `bytes`, `request_id`) |
| `SET_DISPLAY` | server → device | Show a short DISPLAY_STATES string on the OLED |
| `SCREENING_START` | server → device | Begin screening flow (OLED → ANALYZING…) |
| `SCREENING_RESULT` | server → device | Short non-diagnostic summary for the OLED |
| `SENSOR_DATA` | device → server | Empty — no sensors in BOM |
| `ERROR` | either | `code` (see ERROR_CODES) + `message` |

## Screening flow (real device)

1. Web app calls `POST /api/v1/screenings` → gateway resolves the real device.
2. Backend sends `SET_DISPLAY: PLACE/CAPTURE IMAGE`, then `IMAGE_CAPTURE {request_id}`.
3. Device flashes the LED, captures a JPEG, replies `IMAGE_TRANSFER {request_id, image_b64}`.
4. Backend validates + runs the AI model, stores the screening, and sends
   `SCREENING_RESULT` for the OLED.

Image payloads are base64 inside a single `IMAGE_TRANSFER` frame. (Chunked
transfer is a possible future addition for very large frames.)

## ESP32-CAM status payload extras

```json
"payload": { "button": "idle|pressed", "flash": "off|on", "display_state": "READY" }
```
