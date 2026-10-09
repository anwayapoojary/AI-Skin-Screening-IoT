# System Architecture

```text
ESP32-CAM + OV2640 + OLED + button + white LED
        │  JSON lines + length/CRC32 JPEG frames, 115200 baud
        │  FT232RL USB-UART
        ▼
PYTHON SERIAL BRIDGE  (scripts/serial_bridge.py)
        │
        ▼
FASTAPI /api/v1/devices
        │  register + heartbeat + capture upload
        ▼
FASTAPI ── DATABASE (SQLite)
        └── AI ENGINE  (mock | TorchScript EfficientNet-B0)
        ▼
REACT FRONTEND
```

## Modes

| Mode | Hardware | AI |
|------|----------|-----|
| USB serial | `scripts/serial_bridge.py` with physical ESP32-CAM; Online is based on heartbeats within 10 seconds | `MODEL_BACKEND=mock` or `real` |
| `DEVICE_MODE=simulation` | Existing `SimulatedDevice` (virtual CAM, OLED states, button, flash) | `MODEL_BACKEND=mock` or `real` |
| Legacy Wi-Fi/WebSocket | Existing gateway and WebSocket code remain available for their existing clients | `MODEL_BACKEND=mock` or `real` |

Both device implementations satisfy the same `HealthScreeningDevice` interface,
so the API and frontend are identical across modes. MCU/GPIO code lives only in
`hardware/firmware`; the Python side never imports it.

## USB serial request path

On boot, firmware sends JSON `hello`, followed by a heartbeat every 2.5 seconds.
The bridge auto-detects FTDI hardware (or scans serial ports for the hello
handshake), registers the device and forwards heartbeats. `GET
/api/v1/devices/live` marks a device Online only while `last_seen` is within 10
seconds. A capture is framed with marker `A5 5A C3 3C`, big-endian JPEG length,
JPEG bytes, and IEEE CRC32; a corrupt frame triggers a resend request. The
bridge uploads validated images to `POST /api/v1/devices/{id}/capture`, which
uses the configured inference engine and returns the result to the OLED. The
dashboard may queue `capture_request`; the bridge polls for that command.

The older file/simulator workflow remains available. See `docs/api.md` for
device endpoints and [the serial protocol guide](serial-protocol.md) for exact
wire framing.

USB serial images are framed with marker `A5 5A C3 3C`, a 4-byte big-endian
JPEG length, the JPEG bytes, and a 4-byte big-endian IEEE CRC32. The bridge
retries transient HTTP/network failures. Firmware and USB transport still
require validation with a physical ESP32-CAM.

When real mode is selected, the TorchScript model is loaded on CPU at startup.
If it cannot load, the API remains available and reports the problem through
`GET /api/model/info`; analysis requests return a service error.

If the device has not connected over Wi-Fi, the API returns `503` with a clear
message rather than failing opaquely.

BOM and wiring: [beginner hardware setup](hardware-setup.md). Protocol:
[USB serial protocol](serial-protocol.md). The older PlatformIO firmware path is
documented separately at `hardware/firmware/README.md`. AI/training: `docs/ai.md`,
`docs/ml_training.md`.
