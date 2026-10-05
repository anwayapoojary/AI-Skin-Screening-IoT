# ESP32-CAM Hardware Connections & Wiring Guide

This is the all-in-one hardware connection reference for the **AI Skin Screening IoT Device**.

---

## 1. Quick Connection Reference Tables

### A. I2C 0.96" SSD1306 OLED Display
| OLED Pin | ESP32-CAM Pin | Purpose / Function | Important Note |
|:---------|:--------------|:-------------------|:---------------|
| **VCC**  | **3.3V** (or 5V) | Power supply | Connect to ESP32 3.3V pin |
| **GND**  | **GND** | Ground | Common ground rail |
| **SDA**  | **GPIO 14** | I2C Data line | Do not insert MicroSD card (shares pin) |
| **SCL**  | **GPIO 15** | I2C Clock line | Shared with SD slot |

---

### B. Hardware Trigger Button & External Flash LED
| Component Pin | ESP32-CAM Pin | Purpose / Function | Important Note |
|:--------------|:--------------|:-------------------|:---------------|
| **Button Leg 1** | **GPIO 13** | Capture Trigger | Internal pull-up enabled in firmware |
| **Button Leg 2** | **GND** | Ground contact | Pressing button shorts GPIO13 to GND |
| **White LED Anode (+)** | **GPIO 4** (via 220Ω) | Strobe Flash | Internal high-power LED is already on GPIO4 |
| **White LED Cathode (-)** | **GND** | Ground | Ground contact |

---

### C. Method 1: Direct USB Plug-In with ESP32-CAM-MB Shield (Recommended)
If your ESP32-CAM comes with the bottom **ESP32-CAM-MB** micro-USB adapter board:
- **No manual UART/FTDI wiring is needed!**
- Simply seat the ESP32-CAM on top of the MB shield and plug a standard Micro-USB cable from your computer to the MB shield.
- The computer supplies 5V power, and the on-board CH340 chip handles all Serial TX/RX and automated flashing!

---

### D. Method 2: Direct USB Plug-In via FTDI Programmer (Without MB Shield)
| FTDI Programmer Pin | ESP32-CAM Pin | Important Note |
|:--------------------|:--------------|:---------------|
| **TX** | **GPIO 3 (U0R)** | FTDI Transmit connects to ESP32 Receive |
| **RX** | **GPIO 1 (U0T)** | FTDI Receive connects to ESP32 Transmit |
| **GND** | **GND** | **Must share common ground with ESP32 & power supply** |
| **VCC (5V)** | **5V Pin** | Set FTDI jumper to **3.3V logic level**; power from stable 5V 2A |
| **GPIO 0** | **GND (Only when flashing)** | Connect GPIO0 to GND to flash; disconnect to run |

---

## 2. Complete Breadboard Wiring Schematic

```
                          +-------------------------------+
                          |    FTDI / USB-Serial Adapter  |
                          |     [TX]     [RX]     [GND]   |
                          +------|--------|---------|-----+
                                 |        |         |
                      +----------+        |         |
                      |      +------------+         |
                      |      |                      |
                   (GPIO3) (GPIO1)                (GND)
             +---------------------------------------------+
             |               ESP32-CAM BOARD               |
             |                                             |
             |  [5V]   [GND]   [GPIO14]  [GPIO15]  [GPIO13]|
             +---|-------|--------|---------|---------|----+
                 |       |        |         |         |
  +5V DC --------+       |        |         |         +-----[ Push Button ]-----+
  (Power supply)         |        |         |               (Trigger)           |
                         |        |         |                                   |
  GND -------------------+--------+---------+-----------------------------------+
                         |        |         |                                   |
                         |      (SDA)     (SCL)                                 |
                         |        |         |                                   |
                         |    +---|---------|---+                               |
                         |    | [SDA]     [SCL] |                               |
                         +----| [GND]           |                               |
                              | [VCC] (3.3V)    |                               |
                              |  SSD1306 OLED   |                               |
                              +-----------------+                               |
                                                                                |
             Optional External Flash LED:                                       |
             GPIO 4 ----[ 220Ω Resistor ]----(+) LED (-)------------------------+
```

---

## 3. Step-by-Step Bring-Up Order

1. **Flash Mode**: Connect `GPIO 0` to `GND`, plug in USB, and press the `RST` button on ESP32.
2. **Upload**: Run PlatformIO upload (`pio run -t upload`) or Arduino IDE upload.
3. **Run Mode**: Disconnect `GPIO 0` from `GND`, then press `RST` once to run.
4. **Direct Plug-In Check**: The OLED will display `"READY"` or `"USB READY"`, and Windows will show a Silicon Labs / CH340 / FTDI COM port in Device Manager.
