# Hardware Specification & Bill of Materials

This document defines the final, minimal hardware specification for the **AI Skin Screening IoT Device**.

---

## 1. Final Bill of Materials (BOM)

| Component | Quantity | Purpose | Pin Connection / Notes |
|-----------|----------|---------|------------------------|
| **ESP32-CAM** (AI-Thinker module) | 1 | Microcontroller + OV2640 Optical Sensor + Wi-Fi | Core MCU board with 4MB PSRAM |
| **0.96" SSD1306 OLED Display** | 1 | Real-time status display (No patient data) | I2C: SDA -> GPIO14, SCL -> GPIO15 (0x3C) |
| **Push Button** | 1 | Manual screening trigger | GPIO13 -> Button -> GND (Pull-up configured) |
| **White LED (Flash/Illumination)** | 1 | Lesion surface illumination | Onboard GPIO4 or external on breadboard |
| **220Ω Resistor** | 1 | Current limiting for white LED | In series with LED anode |
| **10kΩ Resistor** | 1 | Pull-up resistor for push button | Between GPIO13 and 3.3V (if external pullup used) |
| **FTDI USB-to-UART Adapter** | 1 | Firmware programming & Serial debugging | TX -> U0R, RX -> U0T, GND -> GND (3.3V logic) |
| **5V Power Supply (2A min)** | 1 | Clean, decoupled power source | Connected to 5V pin and GND on ESP32-CAM |
| **Solderless Breadboard & Jumpers** | 1 set | Prototyping interconnects | Ground bus shared between FTDI, MCU, OLED, Button |

*Note: No other sensors (e.g. DHT11, ultrasonic, PIR) are included in this design.*

---

## 2. Power Architecture & Critical Guidelines

The ESP32-CAM draws up to **310mA** during Wi-Fi transmission bursts and **an additional 150-250mA** when activating the high-brightness white flash LED.

> [!CAUTION]
> **Power Supply Brownouts**:
> **Never** attempt to power the ESP32-CAM solely from the 3.3V rail of an FTDI serial programmer. The FTDI's internal regulator will sag, triggering continuous brownout reset loops (`rst:0x10 (RTCWDT_RTC_RESET)`).
> Always power the board via a dedicated **5V 2A DC supply** connected to the 5V pin. Ensure common ground with the programmer.

---

## 3. Pin Allocations (`config/pins.h`)

| Peripheral | Net / Pin | Direction | Function |
|------------|-----------|-----------|----------|
| **OLED SDA** | `GPIO14` | I/O | I2C Serial Data |
| **OLED SCL** | `GPIO15` | Output | I2C Serial Clock |
| **Push Button** | `GPIO13` | Input | Active-LOW capture trigger (with debounce) |
| **Flash LED** | `GPIO4` | Output | High-power illumination strobe |
| **Serial RX** | `GPIO3` (U0R) | Input | FTDI TX -> ESP32 RX |
| **Serial TX** | `GPIO1` (U0T) | Output | ESP32 TX -> FTDI RX |
| **Boot Mode** | `GPIO0` | Input | Ground during boot to enter flashing mode |

*Note on GPIO12–15: These pins are shared with the microSD slot. MicroSD storage is not utilized in this design.*

---

## 4. Optical Considerations

The OV2640 camera module features a fixed-focus lens.
- Standard focal distance: ~15–30 cm.
- For skin screening macro capture, the lens ring can be carefully rotated counter-clockwise by ~0.5 turns to set focus for close-up inspection (5–10 cm).
- Synchronized white LED flash eliminates ambient shadow artifacts across varying room conditions.
