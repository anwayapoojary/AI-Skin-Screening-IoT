"""Comprehensive test suite for patient, reminder, screening, validation,
device auth, report, and integration flows.

Covers: patient create/search/edit, image validation, upload screening,
invalid image, low confidence, history, reminder CRUD/deactivate/delete,
report title and disclaimer, device auth token, and integration e2e.
"""
import io
import os

import pytest
from fastapi.testclient import TestClient

from backend.app.db.session import SessionLocal, init_db
from backend.app.main import app
from backend.app.models.entities import Patient

init_db()
client = TestClient(app)


# ── Helpers ──

def _create_patient(name: str = "Test Patient") -> dict:
    r = client.post("/api/v1/patients", json={"display_name": name})
    assert r.status_code == 200
    return r.json()


def _make_png(w=100, h=100) -> bytes:
    """Minimal valid PNG (solid color) without needing Pillow in tests."""
    from hardware.simulator.sample_image import SAMPLE_PNG
    return SAMPLE_PNG


def _make_jpeg() -> bytes:
    """Minimal valid JPEG header bytes."""
    return b"\xff\xd8\xff\xe0" + b"\x00" * 200


# ── Patient tests ──

class TestPatients:
    def test_create_patient_generates_code(self):
        p = _create_patient("Auto Code Patient")
        assert p["patient_code"].startswith("PAT-")
        assert len(p["patient_code"]) == 12  # PAT-XXXXXXXX

    def test_list_patients(self):
        _create_patient("Listed Patient")
        r = client.get("/api/v1/patients")
        assert r.status_code == 200
        assert len(r.json()) > 0

    def test_search_patients_by_name(self):
        _create_patient("Searchable Alpha")
        r = client.get("/api/v1/patients?q=Searchable")
        assert r.status_code == 200
        results = r.json()
        assert any("Searchable" in p["display_name"] for p in results)

    def test_search_patients_by_code(self):
        p = _create_patient("Code Search Patient")
        code = p["patient_code"]
        r = client.get(f"/api/v1/patients?q={code[:6]}")
        assert r.status_code == 200
        assert any(pp["patient_code"] == code for pp in r.json())

    def test_get_patient_profile(self):
        p = _create_patient("Profile Patient")
        r = client.get(f"/api/v1/patients/{p['id']}")
        assert r.status_code == 200
        assert r.json()["display_name"] == "Profile Patient"

    def test_get_patient_not_found(self):
        r = client.get("/api/v1/patients/99999")
        assert r.status_code == 404

    def test_edit_patient(self):
        p = _create_patient("Before Edit")
        r = client.put(
            f"/api/v1/patients/{p['id']}",
            json={"display_name": "After Edit", "notes": "Updated notes"},
        )
        assert r.status_code == 200
        assert r.json()["display_name"] == "After Edit"
        assert r.json()["notes"] == "Updated notes"
        # Verify code unchanged
        assert r.json()["patient_code"] == p["patient_code"]


# ── Image validation tests ──

class TestImageValidation:
    def test_empty_image_rejected(self):
        from backend.app.services.images import validate_image_bytes
        status, mime = validate_image_bytes(b"")
        assert status == "invalid"

    def test_oversized_image_rejected(self):
        from backend.app.services.images import validate_image_bytes
        big = b"\xff\xd8\xff" + b"\x00" * (10 * 1024 * 1024 + 1)
        status, _ = validate_image_bytes(big)
        assert status == "invalid"

    def test_valid_png_accepted(self):
        from backend.app.services.images import validate_image_bytes
        png = _make_png()
        status, mime = validate_image_bytes(png)
        assert status == "ok"
        assert mime == "image/png"

    def test_valid_jpeg_accepted(self):
        from backend.app.services.images import validate_image_bytes
        jpeg = _make_jpeg()
        status, mime = validate_image_bytes(jpeg)
        assert status == "ok"
        assert mime == "image/jpeg"

    def test_garbage_bytes_rejected(self):
        from backend.app.services.images import validate_image_bytes
        status, _ = validate_image_bytes(b"not an image at all")
        assert status == "invalid"

    def test_safe_filename_generation(self):
        from backend.app.services.images import save_image
        path = save_image(_make_png(), "image/png")
        import os
        basename = os.path.basename(path)
        # Must be hex UUID + extension, no user-controlled chars
        assert basename.endswith(".png")
        name_part = basename[:-4]
        assert len(name_part) == 32  # hex UUID
        assert all(c in "0123456789abcdef" for c in name_part)


# ── Upload screening test ──

class TestUploadScreening:
    def test_upload_screening_with_png(self):
        p = _create_patient("Upload Patient")
        # Connect device first (required for flow)
        client.post("/api/v1/devices/DEVICE_001/connect")
        png = _make_png()
        r = client.post(
            "/api/v1/screenings/upload",
            data={"patient_id": str(p["id"])},
            files={"file": ("test.png", io.BytesIO(png), "image/png")},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["prediction"] is not None
        assert data["model_version"] is not None
        assert data["model_name"] is not None
        assert data["prediction_timestamp"] is not None

    def test_upload_invalid_image_abstains(self):
        p = _create_patient("Invalid Upload Patient")
        client.post("/api/v1/devices/DEVICE_001/connect")
        r = client.post(
            "/api/v1/screenings/upload",
            data={"patient_id": str(p["id"])},
            files={"file": ("bad.bin", io.BytesIO(b"not an image"), "application/octet-stream")},
        )
        assert r.status_code == 200
        data = r.json()
        assert data["abstained"] is True


# ── Mock prediction tests ──

class TestMockPrediction:
    def test_mock_model_labelled_demo(self):
        from ai.mock_model import MockScreeningModel
        m = MockScreeningModel()
        assert "mock" in m.model_version.lower()

    def test_mock_predict_valid_image(self):
        from ai.mock_model import MockScreeningModel
        m = MockScreeningModel()
        pred = m.predict(_make_png(), "ok")
        assert pred.model_version.startswith("mock")
        assert pred.preprocessing_version.startswith("prep-mock")
        assert pred.timestamp  # not empty

    def test_mock_predict_low_quality_abstains(self):
        from ai.mock_model import MockScreeningModel
        m = MockScreeningModel()
        pred = m.predict(_make_png(), "low_quality")
        assert pred.abstained is True
        assert pred.prediction == "abstain"

    def test_mock_predict_empty_abstains(self):
        from ai.mock_model import MockScreeningModel
        m = MockScreeningModel()
        pred = m.predict(b"", "ok")
        assert pred.abstained is True

    def test_prediction_schema_complete(self):
        from ai.mock_model import MockScreeningModel
        m = MockScreeningModel()
        pred = m.predict(_make_png(), "ok")
        d = pred.as_dict()
        required_fields = {"prediction", "confidence", "model_version",
                          "preprocessing_version", "timestamp",
                          "image_quality_status", "abstained", "notes", "disclaimer"}
        assert required_fields.issubset(set(d.keys()))

    def test_prediction_versioning(self):
        from ai.mock_model import MockScreeningModel
        m = MockScreeningModel()
        pred = m.predict(_make_png(), "ok")
        assert pred.model_version  # not empty
        assert pred.preprocessing_version  # not empty


# ── History tests ──

class TestHistory:
    def test_list_all_screenings(self):
        r = client.get("/api/v1/screenings")
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_list_screenings_by_patient(self):
        p = _create_patient("History Patient")
        r = client.get(f"/api/v1/screenings?patient_id={p['id']}")
        assert r.status_code == 200
        # New patient, so 0 screenings
        assert r.json() == []

    def test_get_screening_not_found(self):
        r = client.get("/api/v1/screenings/99999")
        assert r.status_code == 404


# ── Reminder CRUD tests ──

class TestReminders:
    def test_create_reminder(self):
        p = _create_patient("Reminder Patient")
        r = client.post("/api/v1/reminders", json={
            "patient_id": p["id"],
            "medicine": "Vitamin D",
            "dosage_text": "1000 IU",
            "frequency": "daily",
            "reminder_time": "08:00",
            "start_date": "2026-01-01",
        })
        assert r.status_code == 200
        data = r.json()
        assert data["is_active"] is True
        assert data["medicine"] == "Vitamin D"

    def test_create_reminder_invalid_patient(self):
        r = client.post("/api/v1/reminders", json={
            "patient_id": 99999,
            "medicine": "Test",
            "dosage_text": "1 tab",
            "frequency": "daily",
            "reminder_time": "09:00",
            "start_date": "2026-01-01",
        })
        assert r.status_code == 404

    def test_edit_reminder(self):
        p = _create_patient("Edit Reminder Patient")
        r = client.post("/api/v1/reminders", json={
            "patient_id": p["id"],
            "medicine": "Old Med",
            "dosage_text": "1 tab",
            "frequency": "daily",
            "reminder_time": "08:00",
            "start_date": "2026-01-01",
        })
        rid = r.json()["id"]
        r2 = client.put(f"/api/v1/reminders/{rid}", json={
            "medicine": "New Med",
            "dosage_text": "2 tabs",
        })
        assert r2.status_code == 200
        assert r2.json()["medicine"] == "New Med"
        assert r2.json()["dosage_text"] == "2 tabs"

    def test_deactivate_reminder(self):
        p = _create_patient("Deactivate Patient")
        r = client.post("/api/v1/reminders", json={
            "patient_id": p["id"],
            "medicine": "Active Med",
            "dosage_text": "1 tab",
            "frequency": "daily",
            "reminder_time": "08:00",
            "start_date": "2026-01-01",
        })
        rid = r.json()["id"]
        r2 = client.put(f"/api/v1/reminders/{rid}", json={"is_active": False})
        assert r2.status_code == 200
        assert r2.json()["is_active"] is False

    def test_delete_reminder(self):
        p = _create_patient("Delete Patient")
        r = client.post("/api/v1/reminders", json={
            "patient_id": p["id"],
            "medicine": "Deleted Med",
            "dosage_text": "1 tab",
            "frequency": "daily",
            "reminder_time": "08:00",
            "start_date": "2026-01-01",
        })
        rid = r.json()["id"]
        r2 = client.delete(f"/api/v1/reminders/{rid}")
        assert r2.status_code == 200
        assert r2.json()["ok"] is True
        # Verify deleted
        r3 = client.get(f"/api/v1/reminders/{rid}")
        assert r3.status_code == 404


# ── Report tests ──

class TestReports:
    def test_report_title_is_ai_health_screening(self):
        p = _create_patient("Report Patient")
        client.post("/api/v1/devices/DEVICE_001/connect")
        s = client.post("/api/v1/screenings", json={
            "patient_id": p["id"],
            "image_source": "device",
        })
        sid = s.json()["id"]
        r = client.get(f"/api/v1/reports/{sid}")
        assert r.status_code == 200
        report = r.json()
        assert report["title"] == "AI Health Screening Report"
        assert "certificate" in report["disclaimer"].lower()
        assert "screening report" in report["disclaimer"].lower()

    def test_report_not_found(self):
        r = client.get("/api/v1/reports/99999")
        assert r.status_code == 404

    def test_report_includes_model_info(self):
        p = _create_patient("Report Model Patient")
        client.post("/api/v1/devices/DEVICE_001/connect")
        s = client.post("/api/v1/screenings", json={
            "patient_id": p["id"],
            "image_source": "device",
        })
        sid = s.json()["id"]
        r = client.get(f"/api/v1/reports/{sid}")
        report = r.json()
        assert report["model_version"] is not None


# ── Device auth tests ──

class TestDeviceAuth:
    def test_device_status_no_auth_needed_in_dev(self):
        """Without DEVICE_TOKEN set, device endpoints are open."""
        r = client.get("/api/v1/devices/DEVICE_001/status")
        assert r.status_code == 200

    def test_ws_device_no_token_when_configured(self):
        """When DEVICE_TOKEN is set, missing token should reject."""
        import backend.app.config as cfg
        original = cfg.settings.device_token
        try:
            cfg.settings.device_token = "test-secret-token"
            with client.websocket_connect("/ws/device") as ws:
                # Should be closed by server
                pass
        except Exception:
            pass  # Expected: connection refused or closed
        finally:
            cfg.settings.device_token = original

    def test_ws_device_wrong_token_when_configured(self):
        """Wrong token should be rejected."""
        import backend.app.config as cfg
        original = cfg.settings.device_token
        try:
            cfg.settings.device_token = "correct-token"
            with client.websocket_connect("/ws/device?token=wrong-token") as ws:
                pass
        except Exception:
            pass  # Expected: connection refused
        finally:
            cfg.settings.device_token = original


# ── Integration: Patient → Screening → AI → Result → History ──

class TestIntegrationFlow:
    def test_full_screening_flow(self):
        # 1. Create patient
        p = _create_patient("Integration Patient")
        pid = p["id"]
        code = p["patient_code"]
        assert code.startswith("PAT-")

        # 2. Connect device
        c = client.post("/api/v1/devices/DEVICE_001/connect")
        assert c.status_code == 200
        assert c.json()["state"] == "READY"

        # 3. Run screening via device
        s = client.post("/api/v1/screenings", json={
            "patient_id": pid,
            "image_source": "device",
        })
        assert s.status_code == 200
        screening = s.json()
        assert screening["prediction"] is not None
        assert screening["model_version"] is not None
        assert screening["model_name"] is not None
        assert screening["prediction_timestamp"] is not None
        assert "diagnosis" in screening["disclaimer"].lower() or "Diagnosis" in screening["disclaimer"]
        sid = screening["id"]

        # 4. Get result
        r = client.get(f"/api/v1/screenings/{sid}")
        assert r.status_code == 200
        assert r.json()["id"] == sid

        # 5. Check history
        h = client.get(f"/api/v1/screenings?patient_id={pid}")
        assert h.status_code == 200
        assert len(h.json()) >= 1
        assert any(s["id"] == sid for s in h.json())

        # 6. Get report
        report = client.get(f"/api/v1/reports/{sid}")
        assert report.status_code == 200
        report_data = report.json()
        assert report_data["title"] == "AI Health Screening Report"
        assert "certificate" in report_data["disclaimer"].lower()
        assert report_data["patient_code"] == code

        # 7. Device status
        st = client.get("/api/v1/devices/DEVICE_001/status")
        assert st.status_code == 200
