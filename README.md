# AI-Powered Low-Cost Health Screening Device

Integrated **ESP32-CAM** prototype (kit in transit) + FastAPI + mock AI + React. Development uses a **hardware simulator** that shares the same device interface and JSON protocol as future firmware.

## Hardware (confirmed BOM — not yet received)

| Item | Role |
|------|------|
| ESP32-CAM | Controller + camera |
| 0.96" OLED | Short status text |
| Push button | Capture / UI |
| White LED | Flash |
| 10 kΩ, 220 Ω | Typical pull / LED limit — nets TBD |
| Jumpers, breadboard | Prototype wiring |
| 5 V supply | Power |
| FTDI programmer | UART flash + logs |

Pins, OLED driver IC, and whether the flash LED is onboard vs discrete are **not guessed**. See `docs/hardware_specification.md` and `hardware/firmware/config/pins.h`.

**Field link:** Wi-Fi JSON protocol v1.0. **FTDI:** programming only.

No health sensors in the BOM — sensor APIs report `unavailable`.

## Disclaimer

Screening indications only. **Not** a diagnosis, certificate, or medical device clearance. Reminders are never auto-prescribed from AI.

## Quick start (simulation)

```bash
python -m venv .venv
.venv\Scripts\activate
pip install -r backend/requirements.txt
copy .env.example .env
set PYTHONPATH=.
python scripts/seed_demo.py
uvicorn backend.app.main:app --reload --host 127.0.0.1 --port 8000
```

```bash
cd frontend
npm install
npm run dev
```

UI: `http://localhost:5173` · API docs: `http://127.0.0.1:8000/docs`

```bash
set PYTHONPATH=.
pytest tests -q
```

```bash
docker compose up --build
```

## Real hardware mode

The firmware and backend transport are complete. To run against the physical
ESP32-CAM:

1. Flash the firmware — see `hardware/firmware/README.md` (PlatformIO, set
   Wi-Fi + backend IP in `config/wifi_secrets.h`).
2. Start the API on your LAN: `uvicorn backend.app.main:app --host 0.0.0.0 --port 8000`.
3. Set `DEVICE_MODE=real` in `.env`. The board connects out to
   `ws://<pc-ip>:8000/ws/device`; screenings then drive the real camera.

Protocol: `docs/protocol.md`. Wiring: `docs/wiring.md`. Architecture: `docs/architecture.md`.

## AI model

- `AI_MODE=mock` (default): deterministic dev model, no ML deps.
- `AI_MODE=real`: transfer-learning **skin-lesion** classifier. Install
  `backend/requirements-ml.txt`, obtain a dataset (e.g. HAM10000), train with
  `scripts/train_skin_model.py`, and point `SCREENING_MODEL_PATH` at the result.
  Full guide: `docs/ml_training.md`. Without a checkpoint the API stays up and
  every screening returns an explained `abstain`.

Screening indications only — **not** a diagnosis or medical device.
