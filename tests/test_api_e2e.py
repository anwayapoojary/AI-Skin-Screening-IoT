from fastapi.testclient import TestClient

from backend.app.db.session import SessionLocal, init_db
from backend.app.main import app
from backend.app.models.entities import Patient

init_db()
client = TestClient(app)


def _patient() -> int:
    db = SessionLocal()
    try:
        row = db.query(Patient).filter(Patient.display_name == "E2E Synthetic").one_or_none()
        if row:
            return row.id
        row = Patient(patient_code="E2E-001", display_name="E2E Synthetic", notes="test")
        db.add(row)
        db.commit()
        db.refresh(row)
        return row.id
    finally:
        db.close()


def test_health():
    r = client.get("/api/v1/health")
    assert r.status_code == 200
    body = r.json()
    assert body["device_mode"] == "simulation"
    assert body["hardware_received"] is False


def test_e2e_virtual_device_screening():
    pid = _patient()
    c = client.post("/api/v1/devices/DEVICE_001/connect")
    assert c.status_code == 200
    assert c.json()["state"] == "READY"
    s = client.post("/api/v1/screenings", json={"patient_id": pid, "image_source": "device"})
    assert s.status_code == 200, s.text
    data = s.json()
    assert data["prediction"]
    assert data["model_version"]
    assert "diagnosis" in data["disclaimer"].lower() or "Diagnosis" in data["disclaimer"]
    sid = data["id"]
    stored = client.get(f"/api/v1/screenings/{sid}")
    assert stored.status_code == 200
    report = client.get(f"/api/v1/reports/{sid}")
    assert report.status_code == 200
    assert "certificate" in report.json()["disclaimer"].lower()
    st = client.get("/api/v1/devices/DEVICE_001/status")
    assert st.json()["display_state"] in ("RESULT AVAILABLE", "READY")
    sensors = client.get("/api/v1/devices/DEVICE_001/sensors")
    assert sensors.status_code == 200
    assert all(x["status"] == "unavailable" for x in sensors.json())


def test_reminder_not_from_ai():
    pid = _patient()
    r = client.post(
        "/api/v1/reminders",
        json={
            "patient_id": pid,
            "medicine": "Demo med",
            "dosage_text": "1 tablet",
            "frequency": "daily",
            "reminder_time": "08:00",
            "start_date": "2026-01-01",
        },
    )
    assert r.status_code == 200
