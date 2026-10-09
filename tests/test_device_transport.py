from datetime import datetime, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.config import settings
from backend.app.db.base import Base
from backend.app.db.session import get_db
from backend.app.device_adapters import (
    SimulatedAdapter,
    UsbSerialAdapter,
    WifiAdapter,
    get_device_adapter,
)
from backend.app.main import app
from backend.app.models.entities import Patient, Screening
from hardware.simulator.sample_image import SAMPLE_PNG


@pytest.fixture
def transport_client():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    test_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        db = test_session()
        try:
            yield db
        finally:
            db.close()

    previous_override = app.dependency_overrides.get(get_db)
    app.dependency_overrides[get_db] = override_get_db
    with test_session() as db:
        patient = Patient(
            patient_code=f"PAT-TRANSPORT-{uuid4().hex}",
            display_name="Transport Test Patient",
        )
        db.add(patient)
        db.commit()
        db.refresh(patient)
        patient_id = patient.id

    try:
        with TestClient(app) as client:
            yield client, patient_id, test_session
    finally:
        if previous_override is None:
            app.dependency_overrides.pop(get_db, None)
        else:
            app.dependency_overrides[get_db] = previous_override
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


@pytest.mark.parametrize(
    ("source", "adapter_type"),
    [
        ("wifi", WifiAdapter),
        ("usb", UsbSerialAdapter),
        ("simulated", SimulatedAdapter),
    ],
)
def test_device_upload_accepts_each_transport_source(
    transport_client, source, adapter_type
):
    client, patient_id, test_session = transport_client
    response = client.post(
        "/api/device/upload",
        data={
            "patient_id": str(patient_id),
            "source": source,
            "device_id": "DEVICE-TRANSPORT-TEST",
        },
        files={"file": ("capture.png", SAMPLE_PNG, "image/png")},
    )

    assert response.status_code == 200, response.text
    data = response.json()
    assert data["source"] == source
    assert data["image_source"] == source
    assert data["prediction"]

    with test_session() as db:
        screening = db.get(Screening, data["id"])
        assert screening is not None
        assert screening.source == source
        assert screening.device.device_type == adapter_type.device_type
        assert screening.device.last_seen is not None


def test_device_transport_selects_adapter_from_source_or_config(monkeypatch):
    monkeypatch.setattr(settings, "device_transport", "simulated")
    assert isinstance(get_device_adapter(), SimulatedAdapter)
    assert isinstance(get_device_adapter("wifi"), WifiAdapter)
    assert isinstance(get_device_adapter("usb"), UsbSerialAdapter)


def test_simulated_adapter_records_simulated_source():
    upload = SimulatedAdapter().prepare_upload("SIM-DEVICE")
    assert upload.source == "simulated"
    assert upload.device_id == "SIM-DEVICE"
    assert upload.device_type == "simulator"
    assert upload.connection_status == "SIMULATED_UPLOAD_RECEIVED"


@pytest.mark.parametrize(
    ("data", "content_type", "expected_status"),
    [
        (b"not an image", "image/png", 415),
        (b"x" * (10 * 1024 * 1024 + 1), "image/jpeg", 413),
    ],
    ids=["invalid-image", "oversized-image"],
)
def test_device_upload_validates_image_type_and_size(
    transport_client, data, content_type, expected_status
):
    client, patient_id, _ = transport_client
    response = client.post(
        "/api/device/upload",
        data={
            "patient_id": str(patient_id),
            "source": "simulated",
            "device_id": "DEVICE-INVALID-IMAGE",
        },
        files={"file": ("capture", data, content_type)},
    )
    assert response.status_code == expected_status


def test_device_status_reports_configured_mode_and_last_upload(transport_client, monkeypatch):
    client, patient_id, _ = transport_client
    monkeypatch.setattr(settings, "device_transport", "simulated")

    response = client.post(
        "/api/device/upload",
        data={
            "patient_id": str(patient_id),
            "source": "usb",
            "device_id": "DEVICE-STATUS-TEST",
        },
        files={"file": ("capture.png", SAMPLE_PNG, "image/png")},
    )
    assert response.status_code == 200, response.text

    status = client.get("/api/device/status")
    assert status.status_code == 200
    assert status.json()["active_mode"] == "usb"
    assert status.json()["mode_source"] == "last_upload"
    assert status.json()["last_upload_source"] == "usb"
    assert status.json()["device_id"] == "DEVICE-STATUS-TEST"
    assert datetime.fromisoformat(status.json()["last_sync"]).tzinfo is not None


def test_device_upload_updates_the_guided_screening(transport_client):
    client, patient_id, test_session = transport_client
    with test_session() as db:
        row = Screening(patient_id=patient_id, source="simulated")
        db.add(row)
        db.commit()
        screening_id = row.id

    response = client.post(
        "/api/device/upload",
        data={
            "patient_id": str(patient_id),
            "source": "wifi",
            "device_id": "DEVICE-GUIDED-TEST",
            "screening_id": str(screening_id),
        },
        files={"file": ("capture.png", SAMPLE_PNG, "image/png")},
    )

    assert response.status_code == 200, response.text
    assert response.json()["id"] == screening_id
    assert response.json()["source"] == "wifi"
    with test_session() as db:
        assert db.query(Screening).count() == 1
