# Manual Hardware & Clinical Verification Checklist

This manual verification protocol is for human operators, clinical researchers, and hardware engineers validating the physical ESP32-CAM device and end-to-end software pipeline.

> **Safety Notice:**  
> **Screening support only, not a diagnosis. Consult a doctor.**  
> Never use this engineering prototype as a sole diagnostic instrument.

---

## 1. Bench Power & Electrical Verification

- [ ] **Step 1: Boost Voltage Verification (Multimeter Check)**
  - Before connecting the ESP32-CAM, turn ON the SPDT switch from the LiPo/TP4056.
  - Measure the output of the 5V boost converter with a digital multimeter.
  - Confirm the voltage is trimmed to **exactly 5.00V ± 0.05V**.
- [ ] **Step 2: Buffer Capacitor Inspection**
  - Verify a **470µF electrolytic capacitor** (16V rated) is installed across `5V` and `GND` of the ESP32-CAM module with correct polarity.
- [ ] **Step 3: Power Isolation Rule**
  - Verify the FTDI programmer 5V pin is **never** connected at the same time as the battery 5V boost rail.
- [ ] **Step 4: Charging Protocol**
  - Turn the SPDT slide switch to **OFF** when connecting a micro-USB charger to the TP4056 module. Verify red charging LED and blue full-charge LED.

---

## 2. Firmware Flashing & Boot Verification

- [ ] **Step 5: Strapping Pin Safety**
  - Verify `GPIO12` is pulled LOW through the 220Ω resistor and indicator LED at boot.
  - Verify `GPIO15` (OLED SDA) is not forcibly pulled LOW during boot reset.
- [ ] **Step 6: Flashing Sequence**
  - Insert jumper from `GPIO0` to `GND`.
  - Connect FTDI programmer (logic jumper set to **3.3V**; VCC connected to ESP32 **5V**).
  - Press `RST` button on ESP32-CAM to enter bootloader.
  - Flash firmware via `pio run -t upload` or Arduino IDE.
- [ ] **Step 7: Boot to Run Mode**
  - Disconnect `GPIO0` from `GND`.
  - Press `RST` once.
  - Verify SSD1306 OLED displays `"BOOTING..."` followed by `"WIFI CONNECTING"` or `"USB MODE"`.

---

## 3. Optical Sensor & Macro Focus Setup

- [ ] **Step 8: Macro Lens Calibration**
  - By default, the OV2640 module is fixed-focused for landscapes/portraits (~1 meter).
  - Break the small lens glue seal gently and rotate the lens ring counter-clockwise by ~0.5 to 1 full turn.
  - Test capture of a fine-print paper text at **5–10 cm distance** to ensure sharp dermatological focus.
- [ ] **Step 9: Illumination Flash Check**
  - Verify that the high-power onboard white LED (GPIO4) pulses for ~120ms during image acquisition without causing a brownout reset (`rst:0x10`).

---

## 4. Device Transport Verification

### A. Wi-Fi Transport Mode
- [ ] **Step 10: Wi-Fi Setup**
  - Configure device Wi-Fi credentials via `wifi_secrets.h` or captive WiFiManager portal.
  - Verify OLED displays `"WIFI CONNECTED"` and shows device IP.
  - Verify backend receives periodic status telemetry on `GET /api/device/commands` or WebSocket.
- [ ] **Step 11: Wi-Fi Image Upload**
  - Press the tactile button (GPIO13).
  - Verify OLED shows `"CAPTURING..."` then `"UPLOADING..."`.
  - Verify backend receives image on `POST /api/device/upload` with Bearer token authentication.

### B. USB Serial Bridge Transport Mode
- [ ] **Step 12: USB Serial Mode Initiation**
  - Long-press the tactile button (GPIO13) for >2 seconds or start firmware without Wi-Fi to enter USB mode.
  - Verify OLED displays `"USB MODE"`.
  - On the host workstation, launch the USB serial bridge:
    ```bash
    python scripts/usb_bridge.py --port COM3 --baud 921600 --api-url http://localhost:8000
    ```
- [ ] **Step 13: Serial Binary Framing & CRC32**
  - Press the trigger button.
  - Confirm the bridge receives the 4-byte header (`0xA5 0x5A 0xC3 0x3C`), 4-byte length, JPEG payload, and 4-byte IEEE CRC32.
  - Confirm image forwards to backend and returns HTTP 200.

---

## 5. Clinical Workflow & Safety Rules in Web UI

- [ ] **Step 14: Patient Enrollment**
  - Navigate to **Patients** (`/patients`), click **New Patient**, enroll a test subject (e.g., `PAT-TEST-01`).
- [ ] **Step 15: Guided Screening Flow**
  - Click **Start Screening** (`/screening/new`).
  - Select the patient.
  - Choose capture source:
    - Test **Upload Image** with a real clinical skin photo.
    - Test **Device Capture** with connected hardware or simulator.
  - Confirm upload of an invalid file (e.g. text file or corrupt file) yields an immediate, readable error message.
  - Confirm upload of a file >10MB is rejected.
- [ ] **Step 16: Result Evaluation & Uncertainty Checks**
  - Verify Result page (`/screening/:id`) displays:
    - Primary prediction label and clinical condition name.
    - Top 3 probability distribution bars.
    - If top confidence < 50%, verify it prominently displays **"Uncertain, needs review"**.
    - If `MODEL_BACKEND=mock`, verify the **Mock AI** warning badge is rendered.
    - Verify the mandatory disclaimer is rendered on every page:
      > *"Screening support only, not a diagnosis. Consult a doctor."*
- [ ] **Step 17: Records & Clinical Report Generation**
  - Navigate to **Records** (`/records`).
  - Verify the screening appears in the **History** tab.
  - Click **Open Report** (`/reports/:id`) and verify complete case summary with telemetry, model version, and legal disclaimer.
- [ ] **Step 18: Medication Reminders**
  - In Records, open the **Reminders** tab and create an application schedule (e.g., ointment twice daily).
  - Verify marking the reminder as done persists the completion state.
