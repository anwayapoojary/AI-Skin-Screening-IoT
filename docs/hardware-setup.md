# Beginner setup: AI Thinker ESP32-CAM over USB serial

This setup uses an ESP32-CAM, an FT232RL USB-UART adapter, and a laptop running
the FastAPI backend, serial bridge, and React dashboard. The USB-UART adapter is
the board's only power source; **do not connect another power supply at the same
time**. The system provides screening support only, not a diagnosis.

## 1. Install Arduino IDE and board support

1. Install Arduino IDE 2 from [arduino.cc/en/software](https://www.arduino.cc/en/software).
2. Open **File → Preferences** and add this URL under **Additional boards manager URLs**:
   `https://espressif.github.io/arduino-esp32/package_esp32_index.json`
3. Open **Tools → Board → Boards Manager**, search for **esp32 by Espressif Systems**, and install it.
4. In **Tools → Manage Libraries**, install:
   - **Adafruit SSD1306**
   - **Adafruit GFX Library**
   - **ArduinoJson**
5. Open `hardware\esp32_cam_firmware\esp32_cam_firmware.ino`. The sketch is
   self-contained; this is the only file to flash.

## 2. Install the FT232RL driver and find its COM port

1. Install the FTDI **VCP (Virtual COM Port)** driver from
   [ftdichip.com/drivers/vcp-drivers](https://ftdichip.com/drivers/vcp-drivers/),
   unless Windows has already installed it.
2. Connect the FT232RL to the laptop. Open **Device Manager → Ports (COM & LPT)**
   and note its `USB Serial Port (COMx)` name.
3. Set the adapter's power jumper to **5V**. Confirm the adapter's UART signals
   are **3.3V logic**. The 5V setting is for the board's 5V power pin; never put
   a 5V UART signal on ESP32 RX.
4. Keep the ESP32-CAM disconnected while wiring. Do not connect 5V and 3.3V
   power outputs to the board together.

## 3. Wire the adapter, OLED, button, and LED

With everything unpowered, wire:

| FT232RL / part | ESP32-CAM connection |
|---|---|
| TXD (3.3V UART logic) | U0R / GPIO3 (RX) |
| RXD (3.3V UART logic) | U0T / GPIO1 (TX) |
| GND | GND |
| 5V (jumper set to 5V) | 5V |
| OLED VCC | 3V3 |
| OLED GND | GND |
| OLED SDA | GPIO15 |
| OLED SCL | GPIO14 |
| Button signal | GPIO13 |
| Button other terminal | GND |
| 10 kΩ pull-up resistor | GPIO13 to 3V3 |
| External white LED anode | GPIO2 through a 220 Ω series resistor |
| External white LED cathode | GND |

The 0.96-inch OLED should use I2C address `0x3C` and 3.3V logic. This sketch
uses GPIO15 for SDA (not GPIO4) because GPIO4 is the AI Thinker board's onboard
flash-LED net. The built-in flash LED is left unused; the separate white LED is
on GPIO2. GPIO2 is a boot-strapping pin: keep the LED wiring as shown (LED and
resistor to ground, with no pull-up to 3.3V) and do not hold the button/LED
signal high while resetting. GPIO15 is also a boot-strap pin; keep any OLED
pull-ups at 3.3V (never 5V). The SD-card slot is not used.

The adapter's 5V output must be able to supply ESP32-CAM current peaks. If the
board resets when the camera starts, the adapter/USB port may be current
limited; see troubleshooting below. Do not add a second supply while USB power
is connected.

## 4. Flash the firmware (first time only)

1. Verify the TX/RX cross-over, common ground, 5V jumper, and 3.3V UART logic.
2. Connect GPIO0 to GND with a temporary jumper.
3. Plug the FT232RL into the laptop.
4. In Arduino IDE select **Tools → Board → esp32 → AI Thinker ESP32-CAM**.
5. Under **Tools → Port**, select the COM port from Device Manager. Select
   **115200** upload speed if the IDE offers that setting.
6. Click **Upload**. If it stays at `Connecting...`, tap the board's **RST**
   button once while GPIO0 is still grounded.
7. When upload reports success, unplug USB, remove the GPIO0-to-GND jumper,
   reconnect USB, and tap **RST**. GPIO0 must not remain grounded for normal
   operation.

The firmware file to flash is exactly
[`esp32_cam_firmware.ino`](../hardware/esp32_cam_firmware/esp32_cam_firmware.ino).
No Python file or other firmware folder is flashed.

## 5. Run the application

Use three PowerShell terminals from the repository root. Install the bridge
dependencies once:

```powershell
python -m pip install -r scripts\requirements-bridge.txt
```

On a fresh local database, create the synthetic demo patients once before the
first backend start:

```powershell
$env:PYTHONPATH = "."
python scripts\seed_demo.py
```

The bridge defaults to patient ID `1`, so this creates a usable demo record for
the first capture. These are synthetic development records, not real patients.
For an existing installation, confirm that patient ID `1` exists or pass a
different existing ID with `--patient-id`.

Start the backend (Terminal 1):

```powershell
$env:PYTHONPATH = "."
uvicorn backend.app.main:app --host 127.0.0.1 --port 8000
```

Start the serial bridge (Terminal 2):

```powershell
python scripts\serial_bridge.py
```

By default, the bridge scans for an FT232/FTDI serial adapter at **115200 baud**,
retries after unplug/replug (including COM port changes), uses patient ID `1`,
and connects to `http://127.0.0.1:8000`. For a different patient or explicit
COM port, run `python scripts\serial_bridge.py --patient-id 1 --port COM5`.
Ensure that patient ID exists in the backend. The optional
[`start_serial_bridge.bat`](../scripts/start_serial_bridge.bat) starts the same
bridge; a shortcut to it can be placed in the Windows Startup folder after the
backend has been configured.

Start the frontend (Terminal 3):

```powershell
cd frontend
npm run dev
```

Open the Vite URL printed in Terminal 3 (normally `http://localhost:5173`) and
open **Device Status** from the existing gear menu. The Arduino Serial Monitor
must be closed before starting the bridge because only one program can own the
COM port. On the board, press the button to capture. The dashboard's **Capture
now** button can also ask the bridge to request a capture.

## Troubleshooting

- **`Failed to connect` while flashing:** keep GPIO0 connected to GND; tap RST
  as upload starts; check crossed TX/RX and common GND; close Serial Monitor;
  verify the selected COM port.
- **Brownout / repeated resets:** check the 5V jumper and short, secure power
  wires; remove other loads; verify the FT232RL and laptop USB port can supply
  camera current peaks. Do not connect a second power source at the same time.
- **No COM port:** reconnect the adapter, inspect Device Manager, install the
  FTDI VCP driver, try another USB cable/port, and make sure it is a data cable.
- **Garbled serial:** use 115200 baud; verify 3.3V UART logic and crossed TX/RX;
  ensure Arduino Serial Monitor is closed. The bridge does not accept debug
  prints mixed into binary frames.
- **Device not on the dashboard:** start the backend first, then the bridge;
  verify the bridge identifies the FT232RL and logs `Device hello` and
  `Registered device`; check the backend URL, existing patient ID, and any
  `DEVICE_TOKEN`; confirm the heartbeat is arriving within the 10-second online
  timeout.
- **Camera init/capture error:** check that the camera ribbon is seated, the
  board profile is AI Thinker ESP32-CAM, and power is stable.
- **OLED is blank:** check 3V3/GND, SDA on GPIO15, SCL on GPIO14, and the
  display's I2C address (`0x3C`). GPIO4 must not be connected as OLED SDA for
  this wiring.

## Verification status

The software protocol can be tested using `scripts\fake_esp_serial.py`; this
does not test camera focus/exposure, the FT232RL current capacity, wiring,
physical button/LED/OLED behavior, or the real board. Those checks remain
**hardware-untested** until performed on the actual assembled device.
