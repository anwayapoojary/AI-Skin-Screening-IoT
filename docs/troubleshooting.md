# Troubleshooting & Debugging Guide

This guide covers common issues encountered during hardware bring-up, firmware flashing, and software operation.

---

## 1. Hardware & Flashing Issues

### `A fatal error occurred: Failed to connect to ESP32: Timed out waiting for packet header`
- **Cause**: ESP32 did not enter UART download mode.
- **Fix**:
  1. Ensure `GPIO0` is connected to `GND`.
  2. Press the onboard `RST` button momentarily while GPIO0 is grounded.
  3. Verify FTDI TX is connected to ESP32 `U0R` (RX) and FTDI RX to ESP32 `U0T` (TX).
  4. Ensure FTDI jumper is set to **3.3V logic** (5V logic can damage GPIO pins).

### Brownout Reset: `rst:0x10 (RTCWDT_RTC_RESET)` or constant reboot loop
- **Cause**: Severe voltage drop during Wi-Fi calibration or camera flash pulse.
- **Fix**:
  1. Do not power the module from FTDI 3.3V pin.
  2. Use a dedicated 5V 2A DC supply to the `5V` and `GND` pins.
  3. Add a 100µF – 470µF electrolytic capacitor across the 5V and GND rail near the ESP32.

### `[ERROR] Camera init failed with error 0x20001` or `0x20002`
- **Cause**: OV2640 ribbon cable not seated properly or pinout mismatch.
- **Fix**:
  1. Gently lift the camera connector clamp, re-seat the flex cable square, and snap the clamp down.
  2. Verify that `CAMERA_MODEL_AI_THINKER` is selected in `config/pins.h`.

### OLED screen is blank (No response on I2C)
- **Cause**: I2C bus wiring incorrect or wrong I2C address.
- **Fix**:
  1. Flash `bringup/04_i2c_scanner.ino` to scan for device addresses.
  2. Verify connections: `SDA -> GPIO14`, `SCL -> GPIO15`.
  3. Verify OLED VCC is receiving 3.3V (or 5V if the module has an onboard regulator).

---

## 2. Connectivity & Protocol Issues

### Wi-Fi fails to connect
- **Cause**: ESP32 only supports **2.4 GHz 802.11 b/g/n**. It cannot connect to 5 GHz-only SSIDs.
- **Fix**:
  1. Check router settings to ensure 2.4 GHz band is enabled.
  2. Check credentials in `config/wifi_secrets.h`.
  3. Verify RSSI using `bringup/07_wifi_connection.ino`.

### WebSocket disconnects or receives 403 Forbidden
- **Cause**: Device token mismatch.
- **Fix**:
  1. Ensure `DEVICE_TOKEN` in `.env` matches the token configured in `wifi_secrets.h`.
  2. Confirm backend is listening on `0.0.0.0` if connecting from another device on the LAN.

---

## 3. Image Quality Gate Rejections

### Screening returns `abstained=true` with "insufficient quality"
- **Cause**: The captured image failed the automated focus, luminance, or resolution checks.
- **Possible triggers**:
  - **Blur (Focus)**: Lesion is out of focal range. Adjust distance to ~10–15 cm or adjust lens focus.
  - **Glare / Overexposure**: White LED flash reflected directly off oily skin or reflective surface. Angle device at ~15° off-perpendicular.
  - **Underexposure**: Ambient light too low and flash disabled.
- **Resolution**: Use the web dashboard to inspect the quality verdict and recapture under uniform diffuse lighting.
