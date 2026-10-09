# AI-Powered Low-Cost Skin Screening IoT Device

An integrated IoT and computer vision screening prototype designed for preliminary, pre-clinical skin lesion triage. The architecture couples an **ESP32-CAM** optical capture device (with white LED flash strobe and 0.96" I2C OLED display) to a **FastAPI** backend and **React** clinical dashboard.

> [!IMPORTANT]
> **Clinical & Regulatory Disclaimer**:
> **Screening support only, not a diagnosis. Consult a doctor.**  
> This system is an **exploratory research prototype** designed to evaluate low-cost screening feasibility. It is **NOT** a certified medical device, does not provide medical diagnoses, and cannot replace a qualified dermatologist or medical practitioner. Medicine reminders are strictly entered by authorized clinical personnel and are **never** auto-prescribed from AI outputs.

---

## Architecture Overview

```mermaid
graph LR
    subgraph Hardware [Edge Device]
        ESP32[ESP32-CAM MCU] --> CAM[OV2640 Sensor]
        ESP32 --> LED[White Flash LED]
        ESP32 --> OLED[0.96" SSD1306 OLED]
        ESP32 --> BTN[Push Button]
    end

    subgraph Backend [FastAPI Server]
        HTTP[USB serial bridge on laptop] <--> ESP32
        HTTP[POST /api/v1/devices/{id}/capture] <-- localhost
        API[REST API /api/v1]
        QG[Optical Quality Gate]
        AI[AI Screening Engine]
        DB[(SQLite / Postgres)]
    end

    subgraph Frontend [React Clinical UI]
        DASH[1. Dashboard] <--> API
        PAT[2. Patients Directory] <--> API
        SCR[3. Guided Screening Flow] <--> API
        REC[4. Records: History, Reports, Reminders] <--> API
        GEAR[Gear Menu: Device, Status, Model Info, Settings, About] <--> API
    end
```

The system is strictly decoupled:
- **Firmware Layer**: The Arduino sketch in `hardware/esp32_cam_firmware/` sends heartbeats and CRC-checked image frames over USB serial. Physical ESP32-CAM operation is **hardware-untested**.
- **Simulator Layer**: Provides a fully functional `SimulatedDevice` that responds identically to protocol v1.0 commands for seamless local development.
- **Quality Gate**: Assesses focus (Laplacian variance), luminance (over/underexposure), and dimensions before inference. Rejects unsuitable images with explicit feedback instead of forcing unreliable predictions.
- **AI Inference Engine**: Supports both deterministic `mock` heuristics and real `TorchScript` EfficientNet-B0 inference on CPU. Configured via `MODEL_BACKEND=mock|real`.
- **Frontend Dashboard**: Streamlined 4-section clinical UI with header gear menu, light theme, accessible empty/loading/error states.

---

## Clinical Workflow & Simplified Navigation

1. **Dashboard** (`/`): Summary metrics cards (Patients, Screenings Today/Week, Pending Results, Reminders), Quick Actions (New Patient, Start Screening) with live Patient Search, Reminders Panel, and Safety/Notice alerts (Mock AI badge when active).
2. **Patients** (`/patients`): Search, enroll new patients, and inspect patient records with Overview, Screenings, and Reminders tabs.
3. **Screening** (`/screening/new`): Single unified guided workflow: Select Patient → Choose Capture Source (Upload / Device / Simulation) → AI Analysis → Inspection Findings (`/screening/:id`).
4. **Records** (`/records`): Comprehensive archives tabbed across **Screening History**, **Clinical Reports**, and **Prescription Reminders**.
5. **System Menu** (Header `⚙`): Direct access to Device Transport Settings (`/devices`), Live Telemetry (`/devices/live`), AI Model Information (`/model`), Settings (`/settings`), and System About (`/about`). Legacy routes automatically redirect to their canonical equivalents.

---

## Technology Stack

- **Firmware**: C++ (Arduino framework on Espressif32, PlatformIO), WebSocketsClient, ArduinoJson, Adafruit SSD1306.
- **Backend**: Python 3.11+, FastAPI, Uvicorn, SQLAlchemy, Pydantic v2, Pillow, WebSockets.
- **USB Bridge**: Python auto-detecting, reconnecting 115200-baud serial bridge (`pyserial`, `requests`).
- **Frontend**: React 18, TypeScript, Vite, React Router 6, Vitest, Testing Library.
- **Testing**: pytest and Vitest; run the commands below for current results.

---

## Hardware Specification & BOM

| Component | Role | Interface / Connection |
|-----------|------|------------------------|
| **ESP32-CAM** (AI-Thinker) | Central controller & image capture | Wi-Fi 802.11 b/g/n, 4MB PSRAM |
| **0.96" SSD1306 OLED** | Device status text display (no patient data) | I2C: SDA=GPIO15, SCL=GPIO14 |
| **Push Button** | Local screening trigger | GPIO13 to GND (with software debounce) |
| **White LED** | Capture illumination | External LED with 220 Ω from GPIO2 to GND; onboard GPIO4 flash LED unused |
| **Resistors** | Pull-up & current limiting | 10 kΩ (button), 220 Ω (LED series) |
| **Power Supply** | Main power delivery | FT232RL 5V output only; verify it can supply camera current peaks |
| **FT232RL Adapter** | Power, flashing, and data | 5V jumper; TX/RX crossed; 3.3V UART logic |

---

## Installation & Quick Start

### 1. Windows (PowerShell)

```powershell
# Clone repository
git clone <repo-url>
cd "AI-Skin-Screening-IoT"

# Set up Python backend virtual environment
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r backend/requirements.txt

# Configure environment
Copy-Item .env.example .env

# Seed synthetic demo data
$env:PYTHONPATH="."
python scripts/seed_demo.py

# Launch FastAPI backend server
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

In a separate terminal:
```powershell
# Set up and launch Frontend
cd frontend
npm install
npm run dev
```

### 2. Linux / macOS (Bash)

```bash
# Clone repository
git clone <repo-url>
cd "AI-Skin-Screening-IoT"

# Set up Python environment
python3 -m venv .venv
source .venv/bin/activate
pip install -r backend/requirements.txt

# Configure environment
cp .env.example .env

# Seed demo data
export PYTHONPATH=.
python scripts/seed_demo.py

# Launch backend
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```

- **Frontend Application**: `http://localhost:5173`
- **Interactive API Documentation (Swagger)**: `http://localhost:8000/docs`

### USB serial capture

For beginner Arduino IDE installation, wiring, and first flash instructions,
follow the [hardware setup guide](docs/hardware-setup.md). Flash
`hardware/esp32_cam_firmware/esp32_cam_firmware.ino` once. After that, connect
the FT232RL adapter and run the backend, bridge, and frontend as described in
the guide. The bridge automatically detects/reconnects to an FTDI port at
115200 baud:

```powershell
python -m pip install -r scripts\requirements-bridge.txt
python scripts\serial_bridge.py --patient-id 1
```

The patient ID must already exist in the backend. Use `--port COM5` to select a
specific port or `--backend-url` to change the local API address. Bridge
configuration can also be supplied through CLI flags or environment variables
(`SERIAL_PORT`, `SERIAL_BAUD`, `BACKEND_URL`, `PATIENT_ID`, `DEVICE_TOKEN`).
The line messages and JPEG frame layout are documented in
[the serial protocol guide](docs/serial-protocol.md). The real board, adapter,
power wiring, camera, button, LED, and OLED are **hardware-untested**.

---

## Environment Variables Configuration

Configured in `.env` (derived from `.env.example`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `APP_ENV` | `development` | Environment mode (`development`, `production`) |
| `DEVICE_MODE` | `simulation` | Device backend (`simulation` or `real`) |
| `DEVICE_TRANSPORT` | `simulated` | Reported/default upload transport (`simulated`, `wifi`, or `usb`) |
| `DEVICE_TOKEN` | empty in `.env.example` | Optional shared token for device connections/uploads |
| `MODEL_BACKEND` | `real` | Screening backend (`mock` or `real`) |
| `DATABASE_URL` | `sqlite:///./data/app.db` | SQLAlchemy database connection URI |
| `MAX_UPLOAD_BYTES` | `10485760` | Maximum file size allowed for image uploads (10 MB) |
Real model metadata is available at `GET /api/model/info`; see
[the skin-model documentation](docs/ai.md) for the supplied evaluation and
limitations. The model is screening support only, not a diagnosis.

`POST /api/device/upload` accepts multipart `patient_id`, `file`, `source`,
`device_id`, and optional `screening_id`. `source` is `wifi`, `usb`, or
`simulated`; images must be decodable JPEG/PNG no larger than 10 MiB.

---

## Running the Automated Test Suite

### Backend Test Suite (Pytest)
```bash
$env:PYTHONPATH="."
pytest tests -q
```
Latest verified result: **88 passed**.

### Frontend Test Suite (Vitest)
```bash
cd frontend
npm run test
```
Latest verified result: **13 passed**.

### Firmware Compilation Check (PlatformIO)
```bash
cd hardware/firmware
pio run -e esp32cam
```
Latest verified result: **build succeeded**. Compilation does not verify real
Wi-Fi, USB serial, camera, button, or OLED behavior.

---

## Documentation Index

- [Comprehensive Code Audit (Phase 0)](docs/AUDIT.md)
- [Project Status & Verification Matrix](docs/PROJECT_STATUS.md)
- [Manual Hardware & Clinical Testing Checklist](docs/MANUAL_TEST.md)
- [Hardware Connections & Wiring Reference](HARDWARE_CONNECTIONS.md)
- [Architecture Specification](docs/architecture.md)
- [REST & WebSocket API Reference](docs/api.md)
- [AI Engine & Custom Model Drop-in Guide](docs/ai.md)
- [Hardware BOM & Specification](docs/hardware.md)
- [Wiring & Interconnection Guide](docs/wiring.md)
- [Device Communication Protocol v1.0](docs/protocol.md)
- [Troubleshooting & Debugging Guide](docs/troubleshooting.md)
- [Clinical Image Capture Protocol Guide](docs/image-capture-guide.md)
- [Research Framework & Experiment Templates](docs/research.md)
- [Privacy & Security Governance](docs/privacy.md)

---

## Project Verification Status Summary

| Area | Status | Notes |
|------|--------|-------|
| Backend API & Logic | VERIFIED | 88 passing pytest tests |
| Simulator & Transport | VERIFIED | Protocol v1.0 contract verified |
| Frontend Application | VERIFIED | 13 passing Vitest tests + TypeScript check and production build verified |
| Firmware Code & Compilation | COMPILED | `pio run -e esp32cam` succeeds for `esp32cam` |
| Physical Hardware Capture | NOT TESTED | Requires board-level Wi-Fi and USB serial bring-up |
| Custom Model Weights | NOT TESTED | Requires user's training dataset |
| Docker Containerization | NOT TESTED | Host system lacks Docker engine |

---

## License

This project is released under the **MIT License**. Third-party datasets (e.g. HAM10000) are governed by their respective licenses (e.g. CC BY-NC 4.0).