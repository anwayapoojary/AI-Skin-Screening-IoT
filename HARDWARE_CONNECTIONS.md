# ESP32-CAM Hardware Connections & Wiring Guide

This is the all-in-one hardware connection reference for the **AI Skin Screening IoT Device**.

---

## 1. Quick Connection Reference Tables

### A. I2C 0.96" SSD1306 OLED Display
| OLED Pin | ESP32-CAM Pin | Purpose / Function | Important Note |
|:---------|:--------------|:-------------------|:---------------|
| **VCC**  | **3.3V** | Power supply | Connect to ESP32-CAM 3.3V rail |
| **GND**  | **GND** | Ground | Common system ground rail |
| **SDA**  | **GPIO 15** | I2C Data line | Strapping pin (keep floating/silent at boot); no MicroSD card |
| **SCL**  | **GPIO 14** | I2C Clock line | Shared with SD slot (do not insert SD card) |

---

### B. Hardware Trigger Button & LEDs
| Component Pin | ESP32-CAM Pin | Purpose / Function | Important Note |
|:--------------|:--------------|:-------------------|:---------------|
| **Button Leg 1** | **GPIO 13** | Capture Trigger | Wired with **10kΩ external pull-up to 3.3V** |
| **Button Leg 2** | **GND** | Ground contact | Pressing button momentarily shorts GPIO13 to GND |
| **Main Flash Strobe** | **GPIO 4** | Surface Illumination | Built-in high-power SMD white LED on the ESP32-CAM |
| **Optional Indicator LED** | **GPIO 12** (via 220Ω) | System Status | 3mm white LED: Anode → 220Ω → GPIO12; Cathode → GND. **Strapping pin: Must be LOW at boot!** |

---

### C. Power Architecture & Battery Topology
For standalone portable clinical usage, wire the power path strictly as follows:
```
LiPo Battery (3.7V) ──► TP4056 Charger ──► SPDT Power Switch ──► 5V Boost Converter ──► ESP32-CAM 5V
                                                                  (Preset to 5.0V)      │
                                                                                        └── [470µF / 16V Capacitor across 5V & GND]
```

#### Critical Power Safety Rules:
1. **Calibrate Boost First**: Measure boost converter output with a multimeter and adjust the trimmer to exactly **5.0V** *before* connecting the ESP32-CAM.
2. **Decoupling Capacitor**: Solder or insert a **470µF electrolytic capacitor** directly across ESP32-CAM `5V` and `GND` to buffer the ~350mA Wi-Fi and flash strobe current spikes and prevent brownout resets (`rst:0x10`).
3. **Never Dual-Power**: **NEVER** connect FTDI/FT232 5V and the 5V boost converter output at the same time! Doing so back-feeds the regulators and can destroy the USB port or battery module.
4. **Charging Protocol**: Always charge the LiPo battery via the TP4056 micro-USB port with the SPDT power switch in the **OFF** position.

---

### D. Flashing & Programming via FTDI / USB-UART Adapter
| FTDI Programmer Pin | ESP32-CAM Pin | Important Note |
|:--------------------|:--------------|:---------------|
| **TX** | **GPIO 3 (U0R)** | FTDI Transmit connects to ESP32 Receive |
| **RX** | **GPIO 1 (U0T)** | FTDI Receive connects to ESP32 Transmit |
| **GND** | **GND** | **Must share common ground with ESP32** |
| **VCC (5V)** | **5V Pin** | Set FTDI logic jumper to **3.3V logic level**, wire power to ESP32 **5V pin** |
| **GPIO 0** | **GND (Only when flashing)** | Jumper GPIO0 to GND during flash upload; remove jumper to run |

---

## 2. Complete Wiring Schematic

```
                                      +------------------------------------+
                                      |      FTDI USB-UART Adapter         |
                                      |  [TX]       [RX]     [GND]   [5V]  |
                                      +---|----------|---------|------|----+
                                          |          |         |      |
                               +----------+          |         |      +---> (5V pin when flashing without battery)
                               |      +--------------+         |
                               |      |                        |
                            (GPIO3) (GPIO1)                  (GND)
             +-------------------------------------------------------------+
             |                       ESP32-CAM BOARD                       |
             |                                                             |
             |   [5V]     [GND]   [GPIO15]  [GPIO14]  [GPIO13]  [GPIO12]   |
             +----|---------|--------|---------|---------|---------|-------+
                  |         |        |         |         |         |
 5V Boost Rail ───+         |        |         |         |         +──[220Ω]──(+) Indicator LED (-)──+
 (or FTDI 5V)     |         |        |         |         |                                           |
                  |         |        |         |         +───────[ 10kΩ Pull-Up ]─────── 3.3V Rail   |
                  |         |        |         |         |                                           |
            [470µF Buffer]  |        |         |         +───────[ Tactile Push Button ]─────────────+
                  |         |        |         |                 (Momentary to GND)                  |
 Common GND ──────+─────────+────────+─────────+─────────────────────────────────────────────────────+
                            |        |         |
                            |      (SDA)     (SCL)    (0.96" SSD1306 OLED, I2C: 0x3C)
                            |        |         |
                            |    +---|---------|---+
                            |    | [SDA]     [SCL] |
                            +────| [GND]           |
                                 | [VCC] ──────────+─── 3.3V Pin on ESP32-CAM
                                 +-----------------+
```

---

## 3. Step-by-Step Bring-Up Order

1. **Flash Mode**: With battery power OFF, place jumper wire from `GPIO 0` to `GND`.
2. **Connect FTDI**: Ensure FTDI jumper is set to 3.3V logic, plug FTDI into USB.
3. **Upload**: Run `pio run -t upload` or Arduino CLI.
4. **Run Mode**: Disconnect `GPIO 0` jumper from `GND`.
5. **Reboot**: Press the `RST` momentary button on the ESP32-CAM module.
6. **OLED Status**: Screen displays `"BOOTING..."` then `"WIFI CONNECTING"` or `"USB MODE"`.
