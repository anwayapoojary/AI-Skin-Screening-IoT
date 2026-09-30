# ESP32-CAM firmware

Controller: **ESP32-CAM** (AI-Thinker-class board, OV2640/OV3660). Programmer:
**FTDI USB-UART**. Display: **0.96" SSD1306 OLED** (I2C). Input: **push button**.
Illumination: **onboard white flash LED** (GPIO4).

This firmware implements device protocol v1.0 over Wi-Fi: the board is a
WebSocket client that connects to the backend, announces itself, streams
status/heartbeats, and answers `IMAGE_CAPTURE` commands with a JPEG.

## Modules

| File | Role |
|------|------|
| `src/main.cpp` | Boot + loop; wires commands to camera/display/flash |
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

- OLED: `SDA=GPIO14`, `SCL=GPIO15`, I2C addr `0x3C`
- Button: `GPIO13` to GND (internal pull-up)

GPIO 12–15 are the practical free pins and are **shared with the microSD slot** —
don't use the SD card if you use these. Reassign in `pins.h` if your wiring differs.
For a non-AI-Thinker board, switch the profile to `BOARD_OTHER` and copy camera
pins from that module's datasheet.

## Build & flash

1. Install [PlatformIO](https://platformio.org/) (VS Code extension or `pio` CLI).
2. `cp config/wifi_secrets.h.example config/wifi_secrets.h` and fill in your
   Wi-Fi SSID/password, the backend PC's LAN IP, and `DEVICE_ID`.
3. Start the backend so `ws://<PC-IP>:8000/ws/device` is reachable:
   `uvicorn backend.app.main:app --host 0.0.0.0 --port 8000` (set `DEVICE_MODE=real`).
4. Wire FTDI: TX/RX crossed, GND common, **3.3 V logic**; hold GPIO0 to GND while
   powering on to enter flash mode. Use a 5 V supply with enough current headroom
   for Wi-Fi + flash LED.
5. `pio run -t upload` then `pio device monitor` (115200 baud).

On boot the OLED shows `BOOTING…` → `READY`. Trigger a screening from the web
app; the device flashes, captures, and uploads the image, and the result appears
in the dashboard. The OLED shows only short status strings — never patient data.

## Notes

- Images are sent as base64 inside an `IMAGE_TRANSFER` envelope. SVGA JPEG is a
  good balance; lower `CAM_FRAMESIZE` in `device_config.h` if you hit memory limits.
- Secrets come from `wifi_secrets.h` (gitignored) or PlatformIO `build_flags`.
  Never hard-code credentials in committed files.
