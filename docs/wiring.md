# Wiring notes

Board: generic **ESP32-CAM (AI-Thinker-class, OV2640/OV3660)**. The camera and
onboard flash pins are the documented AI-Thinker reference map (in
`hardware/firmware/config/pins.h`). Verify against your module's silkscreen
before flashing — if it differs, switch the profile to `BOARD_OTHER` and copy
camera pins from the datasheet.

## Power & programming

- ESP32-CAM `5V` / `GND` from a 5 V supply with headroom for Wi-Fi + flash LED
  (weak USB ports brown out — this causes camera init failures).
- FTDI: TX↔RX crossed, GND common, **3.3 V logic**. Hold `GPIO0` → `GND` while
  powering on to enter flash mode; remove and reset to run.

## Camera / flash (fixed on this board — do not rewire)

Handled on-PCB. Onboard white flash LED = **GPIO4** (driven by firmware during capture).

## Peripherals you wire

These are the only free GPIOs on the AI-Thinker ESP32-CAM. **GPIO 12–15 are
shared with the microSD slot** — do not use a microSD card if you use them here.

| Signal | Default GPIO | Notes |
|--------|-------------|-------|
| OLED SDA (SSD1306, I2C) | GPIO14 | 0.96" OLED, 3.3 V, addr `0x3C` (some modules `0x3D`) |
| OLED SCL | GPIO15 | |
| Push button | GPIO13 | Other side to GND; firmware uses internal pull-up (no external 10 kΩ needed) |

If you prefer the listed 10 kΩ as an external pull-up, wire it button→3.3 V and
change `pinMode` to `INPUT` in `button/button.cpp`. Reassign any pin in `pins.h`.

## After wiring

1. `cp hardware/firmware/config/wifi_secrets.h.example hardware/firmware/config/wifi_secrets.h`
   and fill in Wi-Fi + backend IP.
2. Confirm the OLED address with an I2C scan if `BOOTING…` never appears.
3. Flash (`pio run -t upload`) and watch `pio device monitor` at 115200.
