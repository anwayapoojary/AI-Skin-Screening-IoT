# Hardware Specification Inventory

Hardware listed by the project team (components **on the way**, not yet received or electrically verified in this repository).

| Component | Model | Interface | Voltage | Purpose | Status |
|-----------|-------|-----------|---------|---------|--------|
| Controller | ESP32-CAM (exact board variant TBD) | Wi-Fi 802.11; UART via FTDI for programming | Module typically 5 V on `5V` pin; onboard 3.3 V rail | Control, camera, comms | **Family confirmed** — exact PCB variant (e.g. AI-Thinker) **REQUIRES CONFIRMATION** |
| Camera | On-module camera (commonly OV2640 on ESP32-CAM) | DVP (board-routed) | On-module | Screening image capture | **Present on ESP32-CAM** — sensor IC **REQUIRES CONFIRMATION** from the received module |
| Display | 0.96 inch OLED | UNKNOWN (0.96" parts are often I2C SSD1306/SH1106) | Often 3.3 V (confirm module) | Short device-side status text | Size **confirmed**; driver IC, I2C address, SDA/SCL pins **UNKNOWN — REQUIRES CONFIRMATION** |
| User input | Push button | GPIO digital input | 3.3 V logic; 10 kΩ listed (typical pull-up/down) | Trigger capture / UI | **Confirmed in BOM**; GPIO number **UNKNOWN — DO NOT INVENT** |
| Illumination | White LED (flash) | GPIO + 220 Ω listed (typical current limit) | Confirm LED Vf and whether this is discrete vs onboard flash LED | Capture illumination | **Confirmed in BOM**; pin **UNKNOWN** (AI-Thinker onboard flash is often GPIO4 **if that exact board** — **REQUIRES CONFIRMATION**) |
| Resistors | 10 kΩ, 220 Ω | Passive | n/a | Pull-up/down; LED current limit (typical roles) | Values **confirmed**; net assignment **REQUIRES SCHEMATIC CONFIRMATION** |
| Interconnect | Jumper wires, breadboard | Dupont / breadboard | n/a | Prototype wiring | Confirmed as construction method |
| Power | 5 V supply | Barrel/USB/bench — connector UNKNOWN | **5 V confirmed** | Device power | Current budget **UNKNOWN — REQUIRES MEASUREMENT** (ESP32-CAM + flash LED can brown out weak USB ports) |
| Programmer | FTDI USB-UART | UART: TX/RX/GND; often 3.3 V IO; GPIO0 boot strapping | FTDI VCC often 3.3 V or 5 V jumper — **REQUIRES CONFIRMATION** | Flash firmware, serial log | **Confirmed**; baud rate **TODO** (commonly 115200) |
| Dedicated health/env sensors | None in BOM | n/a | n/a | n/a | **Not in BOM** — software sensor interfaces remain `unavailable` |
| Battery / fuel gauge | None in BOM | n/a | n/a | n/a | **Do not display battery %** |

## GPIO / camera pin map

**UNKNOWN — DO NOT INVENT a full pin table until the exact ESP32-CAM variant and OLED/button wiring are photographed or measured.**

Firmware keeps pin numbers in `hardware/firmware/config/pins.h` as `PIN_UNASSIGNED` until confirmed. Camera pins for a **named** module (e.g. AI-Thinker) must be copied from that module’s datasheet after you identify the board, not guessed.

## Communication (selected from confirmed capabilities)

| Transport | Role | Status |
|-----------|------|--------|
| **Wi-Fi (HTTP + WebSocket, protocol v1.0 JSON)** | Primary field link ESP32-CAM ↔ device gateway | **Selected** — ESP32-CAM has Wi-Fi; SSID/password via env, not committed |
| UART via FTDI | Programming + debug logs | **Confirmed** — not the clinical/data plane for the web app |
| BLE | Unused | Not in BOM as a required radio mode |
| USB gadget | Not applicable | ESP32-CAM has no native USB device port; FTDI is external |

## Device display policy (0.96 inch)

Short strings only, matching firmware `DISPLAY_STATES`:

`READY` · `PLACE/CAPTURE IMAGE` · `CAPTURING...` · `PROCESSING...` · `ANALYZING...` · `RESULT AVAILABLE` · `ERROR`

No full reports or patient identifiers on the OLED.

## Dashboard fields allowed

Connected/state, camera logical status, firmware version, protocol version, last seen, OLED display state. **No** invented sensor graphs. **No** battery. Sensors: omitted or `unavailable`.

## TODO when hardware arrives

- [ ] Identify ESP32-CAM PCB variant and camera sensor marking
- [ ] Confirm OLED driver (SSD1306 vs SH1106), I2C address, SDA/SCL GPIOs (avoid camera strapping pins)
- [ ] Confirm button GPIO and 10 kΩ wiring (pull-up vs pull-down)
- [ ] Confirm flash LED: onboard vs discrete + 220 Ω GPIO
- [ ] Confirm FTDI 3.3 V vs 5 V VCC jumper; never apply 5 V to ESP32 RX
- [ ] Measure 5 V supply current with Wi-Fi + LED
- [ ] Photograph wiring; update `pins.h` and this table
