# Wiring & Interconnection Guide

Hardware: **AI-Thinker ESP32-CAM (OV2640)**, **0.96" SSD1306 OLED (I2C)**, **Push button**, **White LED + 220Ω resistor**, **10kΩ pull-up resistor**, **5V 2A DC supply**, and **FTDI programmer**.

---

## 1. Complete Pinout & Breadboard Connections

| Component Pin | ESP32-CAM Pin | Purpose / Function | Critical Notes |
|---------------|---------------|--------------------|----------------|
| **OLED SDA** | `GPIO14` | I2C Data line | Shared with SD slot (do not insert SD card) |
| **OLED SCL** | `GPIO15` | I2C Clock line | Shared with SD slot |
| **OLED VCC** | `3.3V` (or 5V) | Power supply | Verify OLED board regulator rating |
| **OLED GND** | `GND` | Common ground | Connected to common ground rail |
| **Button Leg 1** | `GPIO13` | Trigger input | Internal pull-up active; or wire 10kΩ to 3.3V |
| **Button Leg 2** | `GND` | Ground contact | When pressed, pulls GPIO13 to LOW |
| **External White LED** (Optional) | `GPIO4` via 220Ω | Auxiliary strobe | Anode -> 220Ω -> GPIO4; Cathode -> GND |
| **FTDI TX** | `GPIO3` (U0R) | ESP32 UART RX | FTDI TX sends data to ESP32 RX |
| **FTDI RX** | `GPIO1` (U0T) | ESP32 UART TX | ESP32 TX sends logs to FTDI RX |
| **FTDI GND** | `GND` | Reference ground | **Must share common ground with ESP32** |
| **FTDI VCC** | *DO NOT CONNECT* | Power | Power ESP32 from dedicated 5V supply |
| **ESP32 5V** | External +5V | DC Power | Connect to external 5V 2A power supply rail |
| **ESP32 GND** | External GND | DC Ground | Connect to external 5V power ground rail |
| **ESP32 GPIO0** | `GND` (Flash mode) | Boot mode | Connect to GND to flash; disconnect to run |

---

## 2. Wiring Diagram

```
                 +-------------------+
                 |    FTDI USB-UART  |
                 |  [TX]  [RX]  [GND]|
                 +---|------|-----|--+
                     |      |     |
            +--------+      |     |
            |   +-----------+     |
            |   |                 |
     (U0R) (U0T)                (GND)
    +----------------------------------+
    |           ESP32-CAM              |
    |                                  |
    | [5V]  [GND]   [14]  [15]   [13]  |
    +---|-----|------|-----|------|----+
        |     |      |     |      |
 +5V ---+     |      |     |      +-----+ [Push Button] -----+
              |      |     |            |                    |
 GND ---------+------+-----+------------+                    |
              |      |     |            |                    |
              |     (SDA) (SCL)         +---[ 10k Resistor]--+ (To 3.3V)
              |      |     |
              |   +--|-----|--------+
              |   | [SDA] [SCL]     |
              +---| [GND]           |
                  | [VCC] (3.3V)    |
                  | SSD1306 0.96"   |
                  +-----------------+
```

---

## 3. Flashing Sequence (FTDI)

1. Disconnect 5V power.
2. Jumper `GPIO0` directly to `GND`.
3. Set FTDI jumper switch to **3.3V logic level** (prevent 5V damage to GPIO1/GPIO3).
4. Connect FTDI USB to computer.
5. Apply 5V power to the external power rail.
6. Press the ESP32 `RST` button momentarily to latch into UART bootloader mode.
7. Run PlatformIO flash: `pio run -t upload`.
8. Once finished, disconnect `GPIO0` from `GND`.
9. Press `RST` once more to boot into normal operating mode.
