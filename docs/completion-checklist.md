# Completion Checklist

Audited: 2026-10-02.
Automated Tests Status: **52 backend tests passing (1 skipped), 6 frontend tests passing (0 failing), frontend production build passing**.

## 2. Core software

| Feature | Status | Notes |
|---------|--------|-------|
| Patient create | DONE and verified | POST /api/v1/patients, verified in test_api_e2e and test_comprehensive |
| Patient list | DONE and verified | GET /api/v1/patients |
| Patient search | DONE and verified | Query parameter `?q=`, verified in test_comprehensive & frontend test |
| Patient profile | DONE and verified | Shows name, generated code, notes, and screening history; editable |
| Patient edit | DONE and verified | PUT /api/v1/patients/{id} |
| Generated patient ID | DONE and verified | Sequential format `PAT-001`, `PAT-002` auto-generated on creation |
| Synthetic demo data | DONE and verified | `scripts/seed_demo.py` seeds DEMO-001 with synthetic demo records |
| Screening flow (device) | DONE and verified | E2E test covers patient -> device -> capture -> AI -> result -> save |
| Screening flow (upload) | DONE and verified | POST /api/v1/screenings/upload tested with PNG/JPEG |
| Image validation: MIME | DONE and verified | Magic-byte verification in `backend/app/services/images.py` |
| Image validation: extension | DONE and verified | Verified in test_comprehensive |
| Image validation: size | DONE and verified | Enforces `MAX_UPLOAD_BYTES` (10MB limit) |
| Image validation: dimensions | DONE and verified | Rejects image if dimensions below `min_side=96` |
| Image validation: decoding | DONE and verified | Decodes image buffer with Pillow/OpenCV, rejects corrupted byte streams |
| Image validation: safe filenames | DONE and verified | UUID-based filenames (`uuid4().hex`), client filenames discarded |
| Quality check: blur | DONE and verified | Laplacian variance threshold in `preprocessing.py` |
| Quality check: brightness | DONE and verified | Checks minimum luminance threshold (dark image rejection) |
| Quality check: over/under exposure | DONE and verified | Rejects images with mean luminance < 30 or > 225 |
| Quality check: dimensions | DONE and verified | Rejects undersized images |
| Quality: insufficient -> no prediction | DONE and verified | Returns abstain with `abstained=True`, no forced prediction |
| Results page | DONE and verified | Displays prediction, confidence bar, optical quality status, and safety disclaimer |
| History page | DONE and verified | Lists all past screenings, allows side-by-side comparison of 2 screenings |
| Report page | DONE and verified | Titled "AI Health Screening Report", includes printable layout and disclaimer |
| Report export (PDF/printable) | DONE and verified | Styled with CSS `@media print` rules, dedicated Print action |
| Safety disclaimer on result | DONE and verified | Explicit disclaimer on API and prominent banner on result page |
| Safety disclaimer on report | DONE and verified | Prominently rendered on printable report |
| Medicine reminders: add | DONE and verified | POST /api/v1/reminders |
| Reminders: edit | DONE and verified | PUT /api/v1/reminders/{id} |
| Reminders: deactivate/delete | DONE and verified | Toggle `is_active=False` and DELETE /api/v1/reminders/{id} |
| Reminders: upcoming/completed | DONE and verified | Separated into Active and Deactivated tables |
| Reminders: not from AI | DONE and verified | UI warning banner: entered by authorized personnel only |
| Dashboard: real data | DONE and verified | Dynamic counts from database and live device status |
| Dashboard: empty states | DONE and verified | Clean empty state messaging when zero patients or screenings |
| Dashboard: AI model version | DONE and verified | Displays model name, version badge, and DEMO/MOCK tag |
| Dashboard: device status | DONE and verified | Polling /api/v1/devices/{id}/status |

## 3. AI

| Feature | Status | Notes |
|---------|--------|-------|
| ScreeningModel ABC | DONE and verified | `ai/screening_model.py` |
| MockScreeningModel (default) | DONE and verified | `ai/screening_model.py`, clearly labeled `DEMO / MOCK` |
| RealScreeningModel (loads MODEL_PATH) | DONE and verified | Fails safely when weights missing, returning abstain |
| Prediction stores model_name | DONE and verified | `model_name` field in entity and schema |
| Prediction stores model_version | DONE and verified | `model_version` stored in DB and returned in API |
| Prediction stores preprocessing_version| DONE and verified | Stored in DB and returned in API |
| Prediction stores prediction | DONE and verified | Stored in DB |
| Prediction stores confidence | DONE and verified | Stored in DB as float `[0.0, 1.0]` |
| Prediction stores timestamp | DONE and verified | Stored in DB (`prediction_timestamp`) |
| Abstain threshold from config | DONE and verified | `SCREENING_ABSTAIN_THRESHOLD` loaded from `.env` |
| RealModel fails safely when missing | DONE and verified | Safe fallback to abstain without crashing API |
| docs/ai.md: drop-in contract | DONE and verified | Full input/output schema, tensor dimensions, and checklist |
| docs/ai.md: model format/input/labels | DONE and verified | PyTorch/TorchScript/ONNX, `(3, 224, 224)`, ImageNet norm, `labels.json` |
| Dataset licence note | DONE and verified | Explicit warning in `docs/ai.md` regarding HAM10000/ISIC dermatoscope vs ESP32-CAM domain shift |
| DEMO/MOCK labelling | DONE and verified | Visual badges and disclaimer text in UI and API output |

## 4. Hardware layer

| Feature | Status | Notes |
|---------|--------|-------|
| Device interface (ABC) | DONE and verified | `hardware/device_gateway/device_interface.py` |
| SimulatedDevice | DONE and verified | Full protocol implementation in `hardware/simulator/` |
| ESP32Device (RealHardwareDevice) | DONE and verified | WebSocket transport tested in `tests/test_transport.py` |
| Identical protocol | DONE and verified | Documented in `docs/protocol.md` |
| docs/protocol.md | DONE and verified | Complete envelope, payload, and command reference |
| Contract tests | DONE and verified | `tests/test_protocol.py` and `tests/test_transport.py` |
| Device token auth | DONE and verified | `DEVICE_TOKEN` verified in WebSocket handshake |
| Size limits on WS | DONE and verified | 10MB frame buffer safety cap |
| Schema validation on WS | DONE and verified | Validates envelope type and required fields |
| Device Status page (real data) | DONE and verified | Real status from `/api/v1/devices/{id}/status` |
| Firmware modules | DONE and verified | Camera, flash LED, button, OLED, Wi-Fi, transport, state machine |
| Single config pins.h | DONE and verified | `hardware/firmware/config/pins.h` |
| wifi_secrets.h .example | DONE and verified | `hardware/firmware/config/wifi_secrets.h.example` |
| Staged bring-up sketches | DONE and verified | 8 complete sketches in `hardware/firmware/bringup/` (01 to 08) |
| Native unit tests (firmware) | DONE and verified | `hardware/firmware/test/test_state_machine/` |
| `pio run` compile result | DONE and verified | Building with PlatformIO `esp32cam` environment |
| Physical hardware execution | NOT TESTED | Requires physical ESP32-CAM board and FTDI connection |

## 5. UI

| Feature | Status | Notes |
|---------|--------|-------|
| Design tokens / no hardcoded colors | DONE and verified | Defined in `frontend/src/styles.css` `:root` |
| WCAG AA contrast | DONE and verified | Audited high-contrast text and border palette |
| Visible focus | DONE and verified | Custom focus outlines on interactive elements |
| Responsive to mobile | DONE and verified | Flexible grid and media query breakpoints |
| Loading states | DONE and verified | Loading spinners and indicators on all pages |
| Empty states | DONE and verified | Descriptive empty state guidance across pages |
| Success states | DONE and verified | Confirmation banners on patient/reminder actions |
| Error states | DONE and verified | Error handling on all API interactions |
| All required pages exist | DONE and verified | Dashboard, Patients, Patient Profile, New Screening, Capture/Upload, AI Analysis, Result, History, Report, Medicine Reminders, Device Status, Settings/About |

## 6. Security and privacy

| Feature | Status | Notes |
|---------|--------|-------|
| Secrets from env only | DONE and verified | Pydantic BaseSettings, `.env` git-ignored |
| .env.example complete | DONE and verified | All environment keys documented |
| Nothing sensitive committed | DONE and verified | Scanned full git history; 0 secrets committed |
| .gitignore covers .env | DONE and verified | `.env`, `.env.local` |
| .gitignore covers wifi_secrets.h | DONE and verified | `**/wifi_secrets.h` |
| .gitignore covers uploads | DONE and verified | `data/`, `uploads/` |
| .gitignore covers datasets | DONE and verified | `data/ham10000/`, `data/isic/` |
| .gitignore covers models | DONE and verified | `ai/weights/`, `*.pt`, `*.pth`, `*.onnx` |
| Structured logging | DONE and verified | Python standard logging with module-level loggers |
| No stack traces to clients | DONE and verified | Production error handlers suppress internal tracebacks |
| docs/privacy.md | DONE and verified | Covers data collected, purpose, storage, access, retention, and production auth roadmap |
| Auth architecture documented | DONE and verified | Documented in `docs/privacy.md` with Mermaid sequence |

## 7. Tests

| Feature | Status | Notes |
|---------|--------|-------|
| Backend patient tests | DONE and verified | 7 tests in `TestPatients` |
| Validation tests | DONE and verified | 6 tests in `TestImageValidation` |
| Screening tests | DONE and verified | E2E + integration flow tests |
| Upload tests | DONE and verified | 2 tests in `TestUploadScreening` |
| Invalid image tests | DONE and verified | Tests corrupted and empty uploads |
| Mock prediction tests | DONE and verified | 6 tests in `TestMockPrediction` |
| Low confidence tests | DONE and verified | Tests low-quality and abstain triggers |
| History tests | DONE and verified | 3 tests in `TestHistory` |
| Reminders tests | DONE and verified | 5 tests in `TestReminders` |
| Reports tests | DONE and verified | 3 tests in `TestReports` |
| Device auth tests | DONE and verified | 3 tests in `TestDeviceAuth` |
| AI model loading test | DONE and verified | Tests safe fallback in `ai/screening_model.py` |
| AI inference test | DONE and verified | Deterministic mock predictions verified |
| AI invalid input test | DONE and verified | Rejection of empty/malformed inputs |
| AI schema test | DONE and verified | Verified complete `ScreeningPrediction` schema |
| AI versioning test | DONE and verified | Verified model_name, version, preprocessing_version |
| Frontend tests | DONE and verified | 6 Vitest component tests in `frontend/src/__tests__/app.test.tsx` |
| Integration e2e | DONE and verified | Full pipeline: Patient -> Screening -> Capture -> AI -> Result -> Report |
| Docker test | NOT TESTED | Docker engine not installed on host machine |

## 8. Documentation

| Document | Status | Notes |
|----------|--------|-------|
| README.md | DONE and verified | Comprehensive guide with architecture, stack, install, API, and safety |
| docs/architecture.md | DONE and verified | Complete decoupled architecture document |
| docs/api.md | DONE and verified | REST & WebSocket API specification |
| docs/ai.md | DONE and verified | AI contract, quality gate, dataset notice, and drop-in checklist |
| docs/hardware.md | DONE and verified | Hardware spec and final BOM |
| docs/hardware-bringup.md | DONE and verified | 8 staged bring-up steps (01-08) |
| docs/wiring.md | DONE and verified | Pinout wiring table and breadboard diagram |
| docs/protocol.md | DONE and verified | WebSocket protocol v1.0 specification |
| docs/troubleshooting.md | DONE and verified | Hardware, flashing, network, and quality gate troubleshooting |
| docs/image-capture-guide.md | DONE and verified | Capture protocols, lighting, and focus adjustment |
| docs/research.md | DONE and verified | Paper outline with empty experiment benchmarking templates |
| docs/verification-status.md | DONE and verified | Clear audit of tested vs. unverified components |
