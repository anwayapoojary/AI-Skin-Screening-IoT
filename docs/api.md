# Backend API Reference (v1.0)

Base URL: `http://localhost:8000/api/v1`
Interactive Swagger Docs: `http://localhost:8000/docs`

All responses are formatted as JSON unless specified otherwise.

---

## 1. System Health

### `GET /api/v1/health`
Returns system status, active device mode, and AI mode.

**Response (200 OK):**
```json
{
  "status": "ok",
  "device_mode": "virtual",
  "ai_mode": "mock",
  "active_device_connected": true,
  "database": "connected"
}
```

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
Initiates a screening via connected hardware (or virtual simulator).

**Request Body:**
```json
{
  "patient_id": 1,
  "image_source": "device"
}
```

### `POST /api/v1/screenings/upload`
Uploads an image file directly (multipart/form-data) for screening.
- Form fields:
  - `patient_id` (integer)
  - `file` (binary image data: image/jpeg or image/png, max 10MB)

### `GET /api/v1/screenings/{id}`
Retrieve screening outcome, prediction confidence, image quality verdict, and clinical disclaimer.

---

## 4. Reports

### `GET /api/v1/reports/{screening_id}`
Generates a formal "AI Health Screening Report" object suitable for rendering or printing.

---

## 5. Medicine Reminders

*Note: Reminders are entered by authorized staff only. They are never automatically prescribed by AI.*

### `GET /api/v1/reminders`
List reminders. Filter by `patient_id` optional.

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

## 6. Hardware Gateway

### `GET /api/v1/devices`
List known hardware devices.

### `GET /api/v1/devices/{id}/status`
Get current device telemetry (state, OLED display string, camera status, flash state, button state, last heartbeat).

### `POST /api/v1/devices/{id}/connect`
Initiates simulator connection if running in virtual mode.

### `POST /api/v1/devices/{id}/disconnect`
Disconnects active device session.

---

## 7. Device WebSocket Protocol

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
