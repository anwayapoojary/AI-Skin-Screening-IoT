# AI-Powered Low-Cost Skin Screening IoT Device

An integrated IoT and computer vision screening prototype designed for preliminary, pre-clinical skin lesion triage. The architecture couples an **ESP32-CAM** optical capture device (with white LED flash strobe and 0.96" I2C OLED display) to a **FastAPI** backend and **React** clinical dashboard.

> [!IMPORTANT]
> **Clinical & Regulatory Disclaimer**:
> This system is an **exploratory research prototype** designed to evaluate low-cost screening feasibility. It is **NOT** a certified medical device, does not provide medical diagnoses, and cannot replace a qualified dermatologist or medical practitioner. Medicine reminders are strictly entered by authorized personnel and are **never** auto-prescribed from AI outputs.

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
        WS[WebSocket /ws/device] <--> ESP32
        API[REST API /api/v1]
        QG[Optical Quality Gate]
        AI[AI Screening Engine]
        DB[(SQLite / Postgres)]
    end

    subgraph Frontend [React Clinical UI]
        DASH[Clinical Dashboard] <--> API
        CAP[Capture / Upload] <--> API
        REP[Printable Reports] <--> API
    end
```

The system is strictly decoupled:
- **Firmware Layer**: Compiles with PlatformIO (`pio run -e esp32cam` verified). Implements device protocol v1.0 over WebSocket client transport. *(Firmware execution on physical hardware = NOT TESTED pending kit arrival)*.
- **Simulator Layer**: Provides a fully functional `SimulatedDevice` that responds identically to protocol v1.0 commands for seamless local development.
- **Quality Gate**: Assesses focus (Laplacian variance), luminance (over/underexposure), and dimensions before inference. Rejects unsuitable images with explicit feedback instead of forcing unreliable predictions.
- **AI Inference Engine**: Supports deterministic `MockScreeningModel` (default, tagged `DEMO / MOCK`) and `RealScreeningModel` with safe abstention fallback when weights are absent.
- **Frontend Dashboard**: Responsive, accessible (WCAG AA) light-theme interface with zero hardcoded colors, built from CSS custom properties.

---

## Features

- **Patient Management**: Register patients, auto-generate sequential identifiers (`PAT-001`), search by name/code, inspect screening history.
- **Dual Capture Pipeline**: Trigger physical/virtual ESP32-CAM hardware capture or upload external JPEG/PNG image files.
- **Optical Quality Verification**: Automatic rejection of blurry, underexposed, or high-glare captures.
- **Transparent AI Findings**: Class prediction, confidence score gauge, model version tracking, and mandatory disclaimers.
- **Longitudinal History & Compare**: Side-by-side screening comparison to evaluate lesion progression over time.
- **Printable Clinical Reports**: Structured "AI Health Screening Report" layout with dedicated CSS print styles.
- **Supervised Medicine Reminders**: Schedule and track prescriptions with Active and Deactivated states.
- **Real-Time Device Telemetry**: Live heartbeat, camera status, flash state, and OLED display synchronization.

---

## Technology Stack

- **Firmware**: C++ (Arduino framework on Espressif32, PlatformIO), WebSocketsClient, ArduinoJson, Adafruit SSD1306.
- **Backend**: Python 3.11+, FastAPI, Uvicorn, SQLAlchemy, Pydantic v2, Pillow, WebSockets.
- **Frontend**: React 18, TypeScript, Vite, React Router 6, Vitest, Testing Library.
- **Testing**: pytest (52 passed), vitest (6 passed).

---

## Hardware Specification & BOM

| Component | Role | Interface / Connection |
|-----------|------|------------------------|
| **ESP32-CAM** (AI-Thinker) | Central controller & image capture | Wi-Fi 802.11 b/g/n, 4MB PSRAM |
| **0.96" SSD1306 OLED** | Device status text display (no patient data) | I2C: SDA=GPIO14, SCL=GPIO15 |
| **Push Button** | Local screening trigger | GPIO13 to GND (with software debounce) |
| **White LED** | Lesion illumination strobe | GPIO4 (onboard flash or discrete) |
| **Resistors** | Pull-up & current limiting | 10 kΩ (button), 220 Ω (LED series) |
| **Power Supply** | Main power delivery | 5V 2A DC supply (avoids brownouts) |
| **FTDI Adapter** | Serial flashing & debugging | TX/RX crossed, 3.3V logic level |

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

---

## Environment Variables Configuration

Configured in `.env` (derived from `.env.example`):

| Variable | Default | Purpose |
|----------|---------|---------|
| `APP_ENV` | `development` | Environment mode (`development`, `production`) |
| `DEVICE_MODE` | `virtual` | Device backend (`virtual` for simulator, `real` for hardware) |
| `DEVICE_TOKEN` | `dev_device_token_secret` | Shared secret token for WebSocket authentication |
| `AI_MODE` | `mock` | Screening engine mode (`mock` or `real`) |
| `SCREENING_ABSTAIN_THRESHOLD`| `0.70` | Confidence cutoff below which model abstains |
| `SCREENING_MODEL_PATH` | `ai/weights/best_model.pt` | Path to PyTorch model checkpoint |
| `DATABASE_URL` | `sqlite:///./data/app.db` | SQLAlchemy database connection URI |
| `MAX_UPLOAD_BYTES` | `10485760` | Maximum file size allowed for image uploads (10 MB) |

---

## Running the Automated Test Suite

### Backend Test Suite (Pytest)
```bash
$env:PYTHONPATH="."
pytest tests -v
```
*Current result: 52 passed, 1 skipped.*

### Frontend Test Suite (Vitest)
```bash
cd frontend
npm test
```
*Current result: 6 passed, 0 failed.*

### Firmware Compilation Check (PlatformIO)
```bash
cd hardware/firmware
pio run -e esp32cam
```
*Current result: SUCCESS (firmware.bin created, RAM 9.7%, Flash 21.3%).*

---

## Documentation Index

- [Architecture Specification](docs/architecture.md)
- [REST & WebSocket API Reference](docs/api.md)
- [AI Engine & Custom Model Drop-in Guide](docs/ai.md)
- [Hardware BOM & Specification](docs/hardware.md)
- [Staged Hardware Bring-up Guide (Sketches 01–08)](docs/hardware-bringup.md)
- [Wiring & Schematic Guide](docs/wiring.md)
- [Device Communication Protocol v1.0](docs/protocol.md)
- [Troubleshooting & Debugging Guide](docs/troubleshooting.md)
- [Clinical Image Capture Protocol Guide](docs/image-capture-guide.md)
- [Research Framework & Experiment Templates](docs/research.md)
- [Audited Verification Status](docs/verification-status.md)
- [Privacy & Security Governance](docs/privacy.md)

---

## Project Verification Status Summary

| Area | Status | Notes |
|------|--------|-------|
| Backend API & Logic | VERIFIED | 52 passing pytest tests |
| Simulator & Transport | VERIFIED | Protocol v1.0 contract verified |
| Frontend Application | VERIFIED | 6 passing Vitest tests + production build verified |
| Firmware Code & Compilation | COMPILED | `pio run -e esp32cam` succeeds |
| Physical Hardware Capture | NOT TESTED | Pending physical ESP32-CAM delivery |
| Custom Model Weights | NOT TESTED | Requires user's training dataset |
| Docker Containerization | NOT TESTED | Host system lacks Docker engine |

---

## License

This project is released under the **MIT License**. Third-party datasets (e.g. HAM10000) are governed by their respective licenses (e.g. CC BY-NC 4.0).