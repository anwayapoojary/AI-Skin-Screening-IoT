# Hardware Specification & Bill of Materials

This document defines hardware for the USB serial build. For the exact wiring
and beginner flashing instructions, see [hardware-setup.md](hardware-setup.md).
The USB build is powered by the FT232RL's 5V output only; do not connect a second
power source.

---

## 1. Final Bill of Materials (BOM)

| Component | Quantity | Purpose | Pin Connection / Notes |
|-----------|----------|---------|------------------------|
| **ESP32-CAM** (AI-Thinker module) | 1 | Microcontroller + OV2640 optical sensor | Core MCU board; Wi-Fi is not used by this USB serial setup |
| **0.96" SSD1306 OLED Display** | 1 | Real-time status display (No patient data) | I2C: SDA -> GPIO15, SCL -> GPIO14, VCC -> 3.3V, GND -> GND (0x3C) |
| **Push Button** | 1 | Manual screening trigger | GPIO13 -> Button -> GND with 10kΩ external pull-up to 3.3V |
| **External white LED** | 1 | Capture illumination | GPIO2 through 220Ω to LED anode; cathode to GND |
| **220Ω Resistor** | 1 | LED current limiting | In series between GPIO2 and external LED |
| **10kΩ Resistor** | 1 | Pull-up resistor for push button | Between GPIO13 and 3.3V rail |
| **FT232RL USB-UART adapter** | 1 | Power, firmware programming, and serial data | Jumper at 5V; TX -> U0R, RX -> U0T, GND -> GND; UART signals must be 3.3V logic |

*Note: No other auxiliary sensors (e.g. DHT11, ultrasonic, PIR) are included in this design. MicroSD card slot is NOT used.*

---

## 2. Power Architecture & Critical Guidelines

The FT232RL adapter's 5V output powers the ESP32-CAM. Confirm the adapter and
USB port can support camera current peaks; brownout resets indicate the power
path may be insufficient.

```
Laptop USB ──► FT232RL (5V power jumper) ──► ESP32-CAM 5V
                    └── crossed 3.3V UART TX/RX ──► ESP32 U0R/U0T
```

### Safety & Operational Guidelines:
1. **5V power only:** set the adapter jumper to 5V and connect it to the ESP32-CAM 5V pin.
2. **UART logic is not 5V:** use 3.3V TX/RX signals; the adapter's 5V pin is for board power only.
3. **Never dual-power:** do not connect another supply while the FT232RL 5V output is connected.
4. **Pin conflict:** GPIO4 is the onboard flash-LED net and is unused. The external capture LED uses GPIO2, which must not be pulled high during reset.

---

## 3. Pin Allocations (`config/pins.h`)

| Peripheral | Net / Pin | Direction | Function |
|------------|-----------|-----------|----------|
| **OLED SDA** | `GPIO15` | I/O | I2C Serial Data (strapping pin: keep silent/floating at boot) |
| **OLED SCL** | `GPIO14` | Output | I2C Serial Clock |
| **Push Button** | `GPIO13` | Input | Active-LOW capture trigger with 10kΩ external pull-up to 3.3V |
| **Onboard flash LED** | `GPIO4` | Unused | Not driven in this wiring |
| **External white LED** | `GPIO2` | Output | Capture illumination through 220Ω to GND; keep low during boot |
| **Serial RX** | `GPIO3` (U0R) | Input | FTDI TX -> ESP32 RX |
| **Serial TX** | `GPIO1` (U0T) | Output | ESP32 TX -> FTDI RX |
| **Boot Mode** | `GPIO0` | Input | Jumper to GND during boot to enter flashing mode |

---

## 4. Optical Considerations

The OV2640 camera module features an adjustable lens ring.
- Standard focal distance: ~15–30 cm.
- For skin screening macro capture, the lens ring can be carefully rotated counter-clockwise by ~0.5 turns to set focus for close-up inspection (5–10 cm).
- Synchronized white LED flash eliminates ambient shadow artifacts across varying room conditions.
