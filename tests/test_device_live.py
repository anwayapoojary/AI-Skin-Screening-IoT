from datetime import datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db.base import Base
from backend.app.db.session import get_db
from backend.app.main import app
from backend.app.models.entities import Patient
from backend.app.models.entities import Device
from hardware.simulator.sample_image import SAMPLE_PNG


@pytest.fixture
def live_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_db():
        db = sessions()
        try:
            yield db
        finally:
            db.close()

    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_db
    with sessions() as db:
        patient = Patient(
            patient_code=f"PAT-LIVE-{uuid4().hex}",
            display_name="Live Device Test Patient",
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)
        patient_id = patient.id
    try:
        with TestClient(app) as client:
            yield client, patient_id, sessions
    finally:
        if previous_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_override
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_serial_register_heartbeat_and_online_timeout(live_client):
    transport_client = live_client
    client, _, test_session = transport_client
    device_id = f"USB-{uuid4().hex[:12]}"

    registered = client.post(
        "/api/v1/devices/register",
        json={
            "device_id": device_id,
            "fw": "test-fw",
            "transport": "USB serial",
            "port": "COM_TEST",
        },
    )
    assert registered.status_code == 200, registered.text
    assert registered.json()["online"] is True

    live = client.get("/api/v1/devices/live").json()
    device = next(item for item in live["devices"] if item["device_id"] == device_id)
    assert device["online"] is True
    assert device["transport"] == "USB serial"
    assert device["port"] == "COM_TEST"
    assert device["firmware"] == "test-fw"

    beat = client.post("/api/v1/devices/heartbeat", json={"device_id": device_id})
    assert beat.status_code == 200, beat.text

    with test_session() as db:
        row = db.query(Device).filter(Device.device_id == device_id).one()
        row.last_seen = datetime.now(timezone.utc) - timedelta(seconds=11)
        db.commit()
    expired = client.get("/api/v1/devices/live").json()
    device = next(item for item in expired["devices"] if item["device_id"] == device_id)
    assert device["online"] is False
    assert device["status"] == "OFFLINE"


def test_serial_capture_request_is_polled_once(live_client):
    transport_client = live_client
    client, _, _ = transport_client
    device_id = f"USB-{uuid4().hex[:12]}"
    assert client.post(
        "/api/v1/devices/register",
        json={"device_id": device_id, "fw": "test-fw", "port": "COM_TEST"},
    ).status_code == 200
    queued = client.post(f"/api/v1/devices/{device_id}/capture?request_only=true")
    assert queued.status_code == 200, queued.text
    assert queued.json()["capture_requested"] is True
    assert client.get(f"/api/v1/devices/{device_id}/capture/request").json() == {
        "capture_requested": True
    }
    assert client.get(f"/api/v1/devices/{device_id}/capture/request").json() == {
        "capture_requested": False
    }


def test_serial_capture_upload_returns_real_screening_result(live_client):
    transport_client = live_client
    client, patient_id, _ = transport_client
    device_id = f"USB-{uuid4().hex[:12]}"
    assert client.post(
        "/api/v1/devices/register",
        json={"device_id": device_id, "fw": "test-fw", "port": "COM_TEST"},
    ).status_code == 200

    response = client.post(
        f"/api/v1/devices/{device_id}/capture",
        data={"patient_id": str(patient_id)},
        files={"file": ("capture.png", SAMPLE_PNG, "image/png")},
    )
    assert response.status_code == 200, response.text
    screening = response.json()
    assert screening["source"] == "usb"
    assert screening["prediction"] is not None
    assert screening["confidence"] is not None
    assert screening["is_mock"] is True

    latest = client.get(f"/api/v1/devices/{device_id}/result/latest")
    assert latest.status_code == 200, latest.text
    assert latest.json()["screening_id"] == screening["id"]
    assert latest.json()["image_url"].startswith("/uploads/")
    assert "not a diagnosis" in latest.json()["note"]
