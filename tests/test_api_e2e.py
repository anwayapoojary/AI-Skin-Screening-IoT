from fastapi.testclient import TestClient
import pytest

from backend.app.db.session import SessionLocal, init_db
from backend.app.main import app
from backend.app.models.entities import Patient

DISCLAIMER = "Screening support only, not a diagnosis. Consult a doctor."

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
    created = client.post(
        "/api/v1/screenings", json={"patient_id": pid, "source": "simulated"}
    )
    assert created.status_code == 200, created.text
    s = client.post(f"/api/v1/screenings/{created.json()['id']}/capture")
    assert s.status_code == 200, s.text
    data = s.json()
    assert data["prediction"]
    assert data["model_version"]
    assert data["disclaimer"] == DISCLAIMER
    assert data["is_mock"] is True
    assert data["source"] == "simulated"
    assert sum(data["probabilities"].values()) == pytest.approx(1.0)
    sid = data["id"]
    stored = client.get(f"/api/v1/screenings/{sid}")
    assert stored.status_code == 200
    report = client.get(f"/api/v1/reports/{sid}")
    assert report.status_code == 200
    assert report.json()["disclaimer"] == DISCLAIMER
    assert report.json()["model_version"] == data["model_version"]
    assert report.json()["probabilities"] == data["probabilities"]
    assert report.json()["model_limitations"]
    st = client.get("/api/v1/devices/DEVICE_001/status")
    assert st.json()["display_state"] in ("RESULT AVAILABLE", "READY")
    sensors = client.get("/api/v1/devices/DEVICE_001/sensors")
    assert sensors.status_code == 200
    assert all(x["status"] == "unavailable" for x in sensors.json())


def test_patient_upload_analyze_history_and_report_flow():
    patient = client.post(
        "/api/v1/patients",
        json={"display_name": "Upload Flow Test", "notes": "synthetic test record"},
    )
    assert patient.status_code == 200, patient.text
    patient_id = patient.json()["id"]
    created = client.post(
        "/api/v1/screenings", json={"patient_id": patient_id, "source": "upload"}
    )
    assert created.status_code == 200, created.text
    screening_id = created.json()["id"]

    from hardware.simulator.sample_image import SAMPLE_PNG

    uploaded = client.post(
        f"/api/v1/screenings/{screening_id}/upload",
        data={"source": "upload"},
        files={"file": ("test.png", SAMPLE_PNG, "image/png")},
    )
    assert uploaded.status_code == 200, uploaded.text
    analyzed = client.post(f"/api/v1/screenings/{screening_id}/analyze")
    assert analyzed.status_code == 200, analyzed.text
    result = analyzed.json()
    assert result["prediction"]
    assert result["timestamp"]
    assert sum(result["probabilities"].values()) == pytest.approx(1.0)

    history = client.get("/api/v1/screenings")
    assert history.status_code == 200
    assert any(row["id"] == screening_id for row in history.json())
    report = client.get(f"/api/v1/reports/{screening_id}")
    assert report.status_code == 200
    assert report.json()["disclaimer"] == DISCLAIMER
    assert report.json()["source"] == "upload"


def test_upload_rejects_corrupt_and_oversized_files():
    patient_id = _patient()
    created = client.post(
        "/api/v1/screenings", json={"patient_id": patient_id, "source": "upload"}
    )
    screening_id = created.json()["id"]

    corrupt = client.post(
        f"/api/v1/screenings/{screening_id}/upload",
        data={"source": "upload"},
        files={"file": ("broken.png", b"not an image", "image/png")},
    )
    assert corrupt.status_code == 415
    assert "decodable JPEG or PNG" in corrupt.json()["detail"]

    oversized = client.post(
        f"/api/v1/screenings/{screening_id}/upload",
        data={"source": "upload"},
        files={"file": ("large.jpg", b"x" * (10 * 1024 * 1024 + 1), "image/jpeg")},
    )
    assert oversized.status_code == 413


@pytest.mark.parametrize("source", ["wifi", "usb", "simulated"])
def test_device_sources_share_upload_endpoint(source):
    from hardware.simulator.sample_image import SAMPLE_PNG

    patient_id = _patient()
    created = client.post(
        "/api/v1/screenings", json={"patient_id": patient_id, "source": source}
    )
    screening_id = created.json()["id"]
    uploaded = client.post(
        f"/api/v1/screenings/{screening_id}/upload",
        data={"source": source},
        files={"file": ("capture.png", SAMPLE_PNG, "image/png")},
    )
    assert uploaded.status_code == 200, uploaded.text
    analyzed = client.post(f"/api/v1/screenings/{screening_id}/analyze")
    assert analyzed.status_code == 200, analyzed.text
    assert analyzed.json()["source"] == source
    assert analyzed.json()["image_source"] == source


def test_model_info_metrics_are_read_from_metrics_file():
    import json
    from pathlib import Path

    metrics_path = Path(__file__).resolve().parents[1] / "ai" / "models" / "metrics.json"
    metrics = json.loads(metrics_path.read_text(encoding="utf-8"))
    response = client.get("/api/model/info")
    assert response.status_code == 200
    info = response.json()
    assert info["test_macro_f1"] == metrics["test_macro_f1"]
    for item in info["per_class"]:
        assert item["recall"] == metrics["per_class"][item["label"]]["recall"]
        assert item["support"] == metrics["per_class"][item["label"]]["support"]


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
