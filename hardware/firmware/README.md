# ESP32-CAM firmware

> **USB serial setup:** the supported beginner USB-only Arduino sketch is
> [`hardware/esp32_cam_firmware/esp32_cam_firmware.ino`](../esp32_cam_firmware/esp32_cam_firmware.ino).
> Use [`docs/hardware-setup.md`](../../docs/hardware-setup.md) and
> [`docs/serial-protocol.md`](../../docs/serial-protocol.md) for wiring,
> flashing, and bridge instructions. The PlatformIO Wi-Fi/WebSocket firmware
> described below is a separate existing path; it is not the sketch to flash
> for the no-Wi-Fi USB serial workflow.

Controller: **ESP32-CAM** (AI-Thinker-class board, OV2640/OV3660). Programmer:
**FTDI USB-UART**. Display: **0.96" SSD1306 OLED** (I2C). Input: **push button**.
Illumination: **onboard white flash LED** (GPIO4).

Wi-Fi mode uses device protocol v1.0 over WebSocket. The firmware first tries
Wi-Fi and falls back to USB serial if Wi-Fi or the backend is unavailable. A
long button press switches modes; a short press captures and sends a framed
JPEG in USB mode. Serial debug output is disabled while USB image data is sent.
The USB bridge uploads frames through `POST /api/device/upload`.

The firmware and serial bridge have not been verified on a physical ESP32-CAM.

## Modules

| File | Role |
|------|------|
| `src/main.cpp` | Boot, Wi-Fi fallback, mode switching and USB frame output |
| `camera/camera.cpp` | OV2640/OV3660 via esp32-camera (JPEG capture) |
| `display/display.cpp` | SSD1306 OLED — short DISPLAY_STATES text only |
| `button/button.cpp` | Debounced push button (INPUT_PULLUP) |
| `flash/flash_led.cpp` | White flash LED on GPIO4 |
| `communication/communication.cpp` | Wi-Fi + WebSocket JSON protocol client |
| `sensors/sensors.cpp` | No-op (no sensors in BOM) |
| `config/pins.h` | Board pin map (AI-Thinker camera/flash; OLED+button you wire) |
| `config/device_config.h` | Versions, timings, camera settings, Wi-Fi include |

The `.c` files are superseded stubs, excluded from the build in `platformio.ini`.

## Pins

Camera and flash pins are the documented **AI-Thinker ESP32-CAM** reference map
(not guessed) — still verify against your module's silkscreen. The only nets
**you** wire are the OLED and button, defaulted in `pins.h` to:

- OLED: `SDA=GPIO15`, `SCL=GPIO14`, I2C addr `0x3C`
- Button: `GPIO13` to GND (internal pull-up)

GPIO 12–15 are the practical free pins and are **shared with the microSD slot** —
don't use the SD card if you use these. Reassign in `pins.h` if your wiring differs.
For a non-AI-Thinker board, switch the profile to `BOARD_OTHER` and copy camera
pins from that module's datasheet.

## Build & flash

1. Install [PlatformIO](https://platformio.org/) (VS Code extension or `pio` CLI).
2. `cp config/wifi_secrets.h.example config/wifi_secrets.h` and fill in your
   Wi-Fi SSID/password, the backend PC's LAN IP, and `DEVICE_ID`. If backend
   auth is enabled, configure the same device token with firmware `DEVICE_TOKEN`.
3. Start the backend so `ws://<PC-IP>:8000/ws/device` is reachable:
   `uvicorn backend.app.main:app --host 0.0.0.0 --port 8000` (set `DEVICE_MODE=real`).
4. Wire FTDI: TX/RX crossed, GND common, **3.3 V logic**; hold GPIO0 to GND while
   powering on to enter flash mode. Use a 5 V supply with enough current headroom
   for Wi-Fi + flash LED.
5. Build with `pio run -e esp32cam`. For Wi-Fi logs, monitor at 921600 baud.
   In USB capture mode, run:
   ```powershell
   python scripts/usb_bridge.py --port COM5 --patient-id <id> --device-id DEVICE_001
   ```
   against a running backend. If API authentication is enabled, provide
   `--token` or set the `DEVICE_TOKEN` environment variable.

On boot, Wi-Fi is attempted first. If unavailable, USB mode is selected.
Long-press the button to toggle modes. In USB mode, short-press to capture;
the bridge needs a valid patient ID and uploads the result through the shared
device upload endpoint. A Wi-Fi screening capture is requested through the
WebSocket; the firmware posts the JPEG to the same upload endpoint with the
screening and patient IDs, then acknowledges the request. The OLED shows short
status strings — never patient data.

## Notes

- Wi-Fi screening images use multipart HTTP upload; diagnostic captures
  without screening context use base64 inside an `IMAGE_TRANSFER` envelope.
  USB frames use marker `A5 5A C3 3C`, a 4-byte big-endian JPEG length, JPEG
  bytes, and a 4-byte big-endian IEEE CRC32. The bridge discards invalid CRCs.
- USB uses 921600 baud by default. Change `--baud` on the bridge and
  `UART_BAUD` in firmware together if needed.
- SVGA JPEG is a good balance; lower `CAM_FRAMESIZE` in `device_config.h` if
  you hit memory limits.
- Secrets come from `wifi_secrets.h` (gitignored) or PlatformIO `build_flags`.
  Never hard-code credentials in committed files.
