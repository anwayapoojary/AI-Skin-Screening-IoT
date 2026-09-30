# System Architecture

```text
ESP32-CAM + 0.96" SSD1306 OLED + button + white flash LED (GPIO4)
        │  Device Protocol v1.0 (JSON)
        │  Transport: Wi-Fi WebSocket  (UART/FTDI = programming only)
        │  device connects out to ws://<backend>:8000/ws/device
        ▼
WEBSOCKET ENDPOINT  (backend/app/api/ws.py)
        │
        ▼
CONNECTION MANAGER  (hardware/device_gateway/connection_manager.py)
        │  registry of live devices + request/response correlation
        ▼
DEVICE GATEWAY ── RealHardwareDevice (real)  |  SimulatedDevice (simulation)
        ▼
FASTAPI ── DATABASE (SQLite)
        └── AI ENGINE  (MockScreeningModel | RealScreeningModel)
        ▼
REACT FRONTEND
```

## Modes

| Mode | Hardware | AI |
|------|----------|-----|
| `DEVICE_MODE=simulation` | `SimulatedDevice` (virtual CAM, OLED states, button, flash) | `AI_MODE=mock` |
| `DEVICE_MODE=real` | `RealHardwareDevice` bridging the WebSocket-connected ESP32-CAM | `AI_MODE=mock` or `real` |

Both device implementations satisfy the same `HealthScreeningDevice` interface,
so the API and frontend are identical across modes. MCU/GPIO code lives only in
`hardware/firmware`; the Python side never imports it.

## Real-mode request path

`POST /api/v1/screenings` → gateway → `RealHardwareDevice.capture_image()` →
ConnectionManager sends `IMAGE_CAPTURE` over the device's socket → awaits
`IMAGE_TRANSFER` → image runs through the AI model → stored → `SCREENING_RESULT`
pushed back to the OLED.

If the device has not connected over Wi-Fi, the API returns `503` with a clear
message rather than failing opaquely.

BOM and unknowns: `docs/hardware_specification.md`. Protocol: `docs/protocol.md`.
Firmware: `hardware/firmware/README.md`. AI/training: `docs/ai.md`, `docs/ml_training.md`.
