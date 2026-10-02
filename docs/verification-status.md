# Verification & System Test Status

Last Audited: 2026-10-02

This document provides a strictly verified record of all tested, passing, and unverified components across the AI Skin Screening IoT project.

---

## 1. Verified Working (Passed Automated Test Suites)

| Component | Test Method | Outcome |
|-----------|-------------|---------|
| **Backend REST Endpoints** | pytest (`tests/test_comprehensive.py`, `tests/test_api_e2e.py`) | **52 passed** (Patient CRUD, search, screenings, uploads, reminders, report generation) |
| **Image Validation Pipeline** | Dedicated test suite (`TestImageValidation`) | Correctly accepts valid JPEG/PNG, enforces 10MB limit, rejects corrupted byte streams, uses cryptographic UUID filenames |
| **Device WebSocket Gateway** | Transport tests (`tests/test_transport.py`, `tests/test_protocol.py`) | Protocol v1.0 handshake, envelope serialization, status streaming, device command dispatch, timeout protection |
| **Simulated Hardware Device** | Simulator test suite (`tests/test_simulator.py`) | Virtual camera frame acquisition, state machine transitions, error simulation |
| **Device State Machine** | Protocol contract tests (`tests/test_state_machine.py`) | Verified allowed vs. illegal state transitions |
| **Mock AI Screening Model** | Model tests (`tests/test_ai.py`, `tests/test_comprehensive.py`) | Deterministic hashing, clearly labeled `DEMO / MOCK`, automatic abstention on empty/low-quality input |
| **Frontend Web Application** | Vitest + React Testing Library (`frontend/src/__tests__/app.test.tsx`) | **6 passed** (Navigation, dashboard states, patient search, result display with safety disclaimer, medicine reminders) |
| **Frontend Production Build** | Vite production compiler (`npx vite build`) | Generated production bundle: 50 modules transformed, zero TypeScript or build errors |
| **Database Migrations & Entities** | SQLite / SQLAlchemy engine | Patient auto-generated codes (`PAT-XXX`), screening histories, active reminder flags |

---

## 2. Failed and Fixed During Audit

1. **Patient Code Auto-Generation**:
   - *Issue*: E2E test previously attempted to pass manual `patient_code` in payload, conflicting with the new auto-generating sequential code API.
   - *Fix*: Standardized patient creation to accept `display_name` and `notes`, generating sequential IDs automatically. E2E tests updated and passing.
2. **Frontend Test Mock Discrepancies**:
   - *Issue*: Initial Vitest mock used outdated field names (`label`, `schedule_text`) instead of the actual entity properties (`medicine`, `dosage_text`, `reminder_time`).
   - *Fix*: Aligned mock data with `Reminder` interface; all tests green.
3. **Repository Secret Exclusion**:
   - *Issue*: `.gitignore` previously matched only `hardware/firmware/wifi_secrets.h` directly, leaving nested paths potentially vulnerable.
   - *Fix*: Changed rule to `**/wifi_secrets.h` to universally prevent accidental secret commits.
4. **Firmware State Machine Inclusion**:
   - *Issue*: State machine logic existed only in Python simulator; missing corresponding C/C++ firmware module.
   - *Fix*: Created `hardware/firmware/include/state_machine.h` and `hardware/firmware/state_machine/state_machine.cpp` and linked in `platformio.ini`.

---

## 3. NOT TESTED (Requires Hardware Board or User-Trained Model)

| Item | Reason for Unverified Status | Action Required on Hardware Day |
|------|------------------------------|---------------------------------|
| **Physical ESP32-CAM Capture** | Physical hardware board not connected during CI | Flash `06_camera_test.ino` followed by main firmware; test OV2640 sensor grab |
| **Physical OLED Display (I2C)** | Physical SSD1306 display not connected | Run `04_i2c_scanner.ino` to confirm address `0x3C`; verify text readability |
| **Physical Button & Flash LED** | Physical circuit on breadboard | Test GPIO13 push button debounce and GPIO4 white flash LED pulse |
| **Trained Deep Learning Weights** | Real weights (`RealScreeningModel`) require user's training data | Train or drop PyTorch checkpoint into `ai/weights/best_model.pt` |
| **Docker Build & Run** | Docker daemon not installed on Windows host | Mark as NOT TESTED or execute on a system with Docker engine |

---

## 4. Summary Metric Counts

- **Backend Pytest Tests**: 52 passed, 1 skipped (skip condition: optional torch dependency)
- **Frontend Vitest Tests**: 6 passed, 0 failed
- **Overall Software Automated Tests**: **58 passed**, 0 failing
