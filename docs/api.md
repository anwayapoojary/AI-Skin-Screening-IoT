# Backend API Reference (v1.0)

Base URL: `http://localhost:8000/api/v1`
Interactive Swagger Docs: `http://localhost:8000/docs`

All responses are formatted as JSON unless specified otherwise.

---

## 1. System Health

### `GET /api/v1/health`
Returns system status, active device mode, and model backend (`ai_mode` is retained for compatibility).

**Response (200 OK):**
```json
{
  "status": "ok",
  "device_mode": "simulation",
  "ai_mode": "mock",
  "model_backend": "mock"
}
```

## 1.1 Dashboard summary

### `GET /api/v1/dashboard/summary`
Returns live aggregate counts for patients, screenings, pending results, failed
uploads, and non-expired active reminder schedules. The weekly screening count
covers the current calendar week (Monday through today). `last_sync` is `null` until
a device reports a sync; screening creation time is not treated as a device sync.
The dashboard uses this response together with the reminder, patient, and device
endpoints below to render its panels. Counts are zero when there are no matching
records.

---

## 2. Patients

### `GET /api/v1/patients`
List registered patients with optional query search.
- Query Parameter: `q` (optional) - substring match against `display_name` or `patient_code`.

### `POST /api/v1/patients`
Registers a new patient. The unique `patient_code` is automatically generated (e.g. `PAT-001`).

**Request Body:**
```json
{
  "display_name": "Jane Smith",
  "notes": "Follow-up visit for right forearm lesion"
}
```

### `GET /api/v1/patients/{id}`
Retrieve a patient by ID along with their historical screenings.

### `PUT /api/v1/patients/{id}`
Update patient information (name, notes).

---

## 3. Screenings & AI Evaluation

### `GET /api/v1/screenings`
List screenings with optional patient filter:
- Query Parameter: `patient_id` (optional).

### `POST /api/v1/screenings`
Creates a pending screening record.

**Request Body:**
```json
{
  "patient_id": 1,
  "source": "upload"
}
```

Allowed `source` values: `upload`, `wifi`, `usb`, or `simulated`.

### `POST /api/v1/screenings/{id}/upload`
Uploads an image file (multipart/form-data) to a screening.
- Form fields:
  - `source` (`upload`, `wifi`, `usb`, or `simulated`)
  - `file` (binary image data: image/jpeg or image/png, max 10MB)

### `POST /api/v1/screenings/{id}/analyze`
Runs inference for the uploaded image and stores the model version, probabilities,
top three predictions, uncertainty flag, backend type, source, and timestamp.

### `POST /api/v1/screenings/{id}/capture`
Captures through the configured device gateway. The simulated gateway works
without physical hardware and stores the result through the same inference
pipeline.

### `POST /api/v1/screenings/upload`
Compatibility endpoint that creates, uploads, and analyzes in one request.
Accepts `patient_id`, `source`, and `file` multipart fields.

### `GET /api/v1/screenings/{id}`
Retrieve the screening outcome, class probabilities, model version, source,
timestamp, uncertainty state, and required safety disclaimer.

---

## 4. Reports

### `GET /api/v1/reports/{screening_id}`
Generates a formal "AI Health Screening Report" object suitable for rendering or printing.
Reports include model limitations and state that the model is not validated on
device images.

---

## 5. Model metadata

### `GET /api/model/info`
Returns the active backend and model metadata. Evaluation metrics and class
recall/support are read from `ai/models/metrics.json`; limitations are parsed
from `ai/models/model_card.md`. When real-model loading fails, this endpoint
returns the unavailable state and error while the API remains available.

### `GET /api/model/confusion-matrix.png`
Returns the supplied model evaluation confusion-matrix image.

---

## 6. Medicine Reminders

*Note: Reminders are entered by authorized staff only. They are never automatically prescribed by AI.*

### `GET /api/v1/reminders`
List reminders. Filter by `patient_id` optional. Each reminder includes
`completed_today`, which is true after its daily occurrence is marked done.

### `POST /api/v1/reminders/{id}/complete`
Marks the active reminder's occurrence for today as complete without deactivating
the recurring schedule. Repeated requests on the same date are idempotent.

### `POST /api/v1/reminders`
Create a new reminder schedule.

**Request Body:**
```json
{
  "patient_id": 1,
  "medicine_name": "Hydrocortisone 1% cream",
  "dosage": "Apply thin layer to affected area",
  "scheduled_time": "08:00",
  "frequency": "Twice daily"
}
```

### `PUT /api/v1/reminders/{id}`
Update reminder details or toggle `is_active` (activate/deactivate).

### `DELETE /api/v1/reminders/{id}`
Deletes a reminder record.

---

## 7. Hardware Gateway

### `GET /api/v1/devices`
List known hardware devices.

### `POST /api/v1/devices/register`
Register an ESP32-CAM hello. JSON fields: `device_id`, `fw`, optional
`transport` and `port`. The bridge refreshes this state after reconnect.

### `POST /api/v1/devices/heartbeat`
Refresh the device's last-seen timestamp. JSON fields: `device_id`, optional
`transport` and `port`.

### `GET /api/v1/devices/live`
List live devices with `online`, USB transport, COM port, firmware, last seen,
capture-request state, and latest result. A device is Online only when its most
recent heartbeat is no more than 10 seconds old.

### `POST /api/v1/devices/{id}/capture`
Without a file, the existing gateway capture behavior is retained. Add
`?request_only=true` to queue a USB capture request. The bridge uploads a JPEG
using multipart `file` and `patient_id`; the backend stores the screening,
runs the configured real or mock model, and returns its result.

### `GET /api/v1/devices/{id}/capture/request`
Polled by the serial bridge. Returns and clears the pending
`capture_requested` flag.

### `GET /api/v1/devices/{id}/result/latest`
Returns the latest screening result for the device, including an image URL and
the screening-only disclaimer.

### `GET /api/v1/devices/{id}/status`
Get current device telemetry (state, OLED display string, camera status, flash state, button state, last heartbeat).

### `POST /api/v1/devices/{id}/connect`
Initiates simulator connection if running in virtual mode.

### `POST /api/v1/devices/{id}/disconnect`
Disconnects active device session.

---

## 8. Device WebSocket Protocol

### `WS /ws/device`
Low-latency bidirectional WebSocket channel for ESP32-CAM and SimulatedDevice.

**Authentication:**
- Query param: `?token=<DEVICE_TOKEN>` or initial payload handshake:
```json
{
  "protocol_version": "1.0",
  "message_type": "DEVICE_CONNECT",
  "device_id": "DEVICE_001",
  "token": "dev_device_token_secret"
}
```

**Outbound Commands (Backend -> Device):**
- `IMAGE_CAPTURE`: Request JPEG frame acquisition with flash.
- `DISPLAY_UPDATE`: Set status string on 0.96" OLED.
- `SCREENING_RESULT`: Inform device of screening completion.

**Inbound Messages (Device -> Backend):**
- `STATUS`: Periodic heartbeat and sensor/button telemetry.
- `IMAGE_TRANSFER`: Base64-encoded JPEG image payload.
- `ERROR`: Hardware or peripheral fault reports.

## 9. Device Image Upload

### `POST /api/device/upload`
Accepts a device image and runs the shared screening inference pipeline.
Multipart form fields:
- `patient_id` (required): patient to associate with this screening.
- `file` (required): decodable JPEG or PNG, maximum 10 MiB.
- `source` (required): `wifi`, `usb`, or `simulated`.
- `device_id` (required): non-empty device identifier, maximum 64 characters.
- `screening_id` (optional): update a screening created by the guided flow.

The `source` is stored on the screening. This legacy endpoint remains available.
The new USB serial bridge validates the length/CRC32 frame and posts images to
`POST /api/v1/devices/{id}/capture`.
When device-token authentication is configured, include the `X-Device-Token: <DEVICE_TOKEN>` header.

### `GET /api/device/status`
Returns `active_mode`, its `mode_source` (`device_reported`, `last_upload`, or
`configured`), `device_id`, `last_upload_source`, `last_sync`, and server time.
The mode is not considered device-reported unless an online device reports it.
