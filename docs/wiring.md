# Wiring & Interconnection Guide

Hardware: **AI-Thinker ESP32-CAM (OV2640)**, **0.96" SSD1306 OLED (I2C)**, **Push button**, **10kΩ pull-up resistor**, **Optional 3mm white indicator LED + 220Ω resistor**, **LiPo + TP4056 + SPDT Switch + 5V Boost + 470µF Capacitor**, and **FTDI programmer**.

---

## 1. Complete Pinout & Connections

| Component Pin | ESP32-CAM Pin | Purpose / Function | Critical Notes |
|---------------|---------------|--------------------|----------------|
| **OLED SDA** | `GPIO15` | I2C Data line | Shared with SD slot (do NOT insert SD card); keep quiet at boot |
| **OLED SCL** | `GPIO14` | I2C Clock line | Shared with SD slot |
| **OLED VCC** | `3.3V` | Power supply | Connect to ESP32-CAM 3.3V pin |
| **OLED GND** | `GND` | Common ground | Connected to common ground rail |
| **Button Leg 1** | `GPIO13` | Trigger input | Connected with external **10kΩ pull-up to 3.3V** |
| **Button Leg 2** | `GND` | Ground contact | When pressed, pulls GPIO13 to LOW |
| **Main Flash Strobe** | `GPIO4` | High-power illumination | Built-in SMD LED on module |
| **Optional Indicator LED** | `GPIO12` (via 220Ω) | Status LED | Anode -> 220Ω -> GPIO12; Cathode -> GND. **Strapping pin: Must be LOW at boot!** |
| **FTDI TX** | `GPIO3` (U0R) | ESP32 UART RX | FTDI TX sends commands/firmware to ESP32 RX |
| **FTDI RX** | `GPIO1` (U0T) | ESP32 UART TX | ESP32 TX sends logs/images to FTDI RX |
| **FTDI GND** | `GND` | Reference ground | **Must share common ground with ESP32** |
| **FTDI VCC** | `5V Pin` | Flashing power | Set FTDI jumper to **3.3V logic level**, connect power to **5V pin** |
| **ESP32 GPIO0** | `GND` (Flash mode) | Boot mode | Jumper to GND only when flashing; remove for normal operation |

---

## 2. Power Architecture & Battery Topology

```
LiPo Battery (3.7V) ──► TP4056 Charger ──► SPDT Power Switch ──► 5V Boost Converter ──► ESP32-CAM 5V
                                                                  (Preset to 5.0V)      │
                                                                                        └── [470µF Capacitor across 5V & GND]
```

### Power Rules:
1. **Calibrate Boost First**: Set potentiometer on the boost converter to exactly 5.0V output before wiring to the ESP32-CAM board.
2. **Buffer Wi-Fi / Flash Inrush**: A 470µF electrolytic capacitor across 5V and GND prevents brownout resets during transmission bursts.
3. **Never Dual-Power**: NEVER connect FTDI 5V and Boost Converter 5V simultaneously. Disconnect the battery boost switch when powering via FTDI.
4. **Charge Protocol**: Turn the SPDT switch to OFF when charging the battery via TP4056 micro-USB.

---

## 3. Flashing Sequence (FTDI)

1. Ensure the SPDT battery power switch is OFF.
2. Jumper `GPIO0` directly to `GND`.
3. Set FTDI jumper to **3.3V logic level**.
4. Connect FTDI TX -> GPIO3 (U0R), RX -> GPIO1 (U0T), GND -> GND, and 5V -> ESP32-CAM 5V pin.
5. Plug FTDI into computer USB.
6. Press the ESP32 `RST` button momentarily to enter UART bootloader mode.
7. Run PlatformIO / Arduino CLI flash command: `pio run -t upload`.
8. Once complete, unplug USB, disconnect `GPIO0` from `GND`, and reconnect to run.
