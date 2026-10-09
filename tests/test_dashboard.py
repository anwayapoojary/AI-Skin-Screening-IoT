from datetime import date, datetime, timedelta, timezone
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from backend.app.db.base import Base
from backend.app.db.session import get_db
from backend.app.main import app
from backend.app.models.entities import (
    MedicationReminder,
    Patient,
    ReminderCompletion,
    Screening,
)


@pytest.fixture
def dashboard_db():
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
    yield test_session
    if previous_override is None:
        app.dependency_overrides.pop(get_db, None)
    else:
        app.dependency_overrides[get_db] = previous_override
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.fixture
def client(dashboard_db):
    with TestClient(app) as test_client:
        yield test_client


def test_dashboard_summary_empty(client):
    response = client.get("/api/v1/dashboard/summary")
    assert response.status_code == 200
    data = response.json()

    assert data["total_patients"] == 0
    assert data["screenings_today"] == 0
    assert data["screenings_this_week"] == 0
    assert data["pending_results"] == 0
    assert data["upcoming_reminders"] == 0
    assert data["failed_uploads"] == 0
    assert data["last_sync"] is None
    assert data["active_ai_model"]
    assert data["device_mode"]
    assert data["ai_mode"]


def test_dashboard_summary_counts_records_and_excludes_inactive_or_expired_reminders(
    client, dashboard_db
):
    today = date.today()
    now = datetime.now(timezone.utc).replace(tzinfo=None)
    with dashboard_db() as db:
        patient = Patient(
            patient_code=f"PAT-DASH-{uuid4().hex}",
            display_name="Dashboard Test Subject",
            notes="Testing metrics calculation",
        )
        db.add(patient)
        db.flush()

        db.add_all(
            [
                MedicationReminder(
                    patient_id=patient.id,
                    medicine="Active reminder",
                    dosage_text="Once daily",
                    frequency="Daily",
                    reminder_time="10:00",
                    start_date=today.isoformat(),
                    is_active=True,
                ),
                MedicationReminder(
                    patient_id=patient.id,
                    medicine="Expired reminder",
                    dosage_text="Once daily",
                    frequency="Daily",
                    reminder_time="10:00",
                    start_date=(today - timedelta(days=4)).isoformat(),
                    end_date=(today - timedelta(days=1)).isoformat(),
                    is_active=True,
                ),
                MedicationReminder(
                    patient_id=patient.id,
                    medicine="Inactive reminder",
                    dosage_text="Once daily",
                    frequency="Daily",
                    reminder_time="10:00",
                    start_date=today.isoformat(),
                    is_active=False,
                ),
                Screening(
                    patient_id=patient.id,
                    image_source="upload",
                    prediction="Melanocytic nevus",
                    confidence=0.92,
                    abstained=False,
                    model_name="MobileNetV2",
                    model_version="v1.0.0",
                    image_quality_status="passed",
                    created_at=now,
                ),
                Screening(
                    patient_id=patient.id,
                    image_source="device",
                    prediction=None,
                    confidence=None,
                    abstained=False,
                    image_quality_status="pending",
                    created_at=now,
                ),
                Screening(
                    patient_id=patient.id,
                    image_source="upload",
                    prediction=None,
                    confidence=None,
                    abstained=False,
                    image_quality_status="rejected",
                    created_at=now,
                ),
                Screening(
                    patient_id=patient.id,
                    image_source="upload",
                    prediction="Melanocytic nevus",
                    confidence=0.8,
                    abstained=False,
                    image_quality_status="passed",
                    created_at=now - timedelta(days=today.weekday() + 1),
                ),
            ]
        )
        db.commit()

    response = client.get("/api/v1/dashboard/summary")
    assert response.status_code == 200
    data = response.json()

    assert data["total_patients"] == 1
    assert data["screenings_today"] == 3
    assert data["screenings_this_week"] == 3
    assert data["pending_results"] == 1
    assert data["upcoming_reminders"] == 1
    assert data["failed_uploads"] == 1
    assert data["last_sync"] is None


def test_marking_reminder_done_is_per_day_and_preserves_schedule(client, dashboard_db):
    with dashboard_db() as db:
        patient = Patient(
            patient_code=f"PAT-DASH-{uuid4().hex}",
            display_name="Reminder Test Subject",
        )
        db.add(patient)
        db.flush()
        reminder = MedicationReminder(
            patient_id=patient.id,
            medicine="Daily medicine",
            dosage_text="Once daily",
            frequency="Daily",
            reminder_time="10:00",
            start_date=date.today().isoformat(),
            is_active=True,
        )
        db.add(reminder)
        db.commit()
        reminder_id = reminder.id

    response = client.post(f"/api/v1/reminders/{reminder_id}/complete")
    assert response.status_code == 200
    assert response.json() == {
        "reminder_id": reminder_id,
        "completed_on": date.today().isoformat(),
    }
    assert client.post(f"/api/v1/reminders/{reminder_id}/complete").status_code == 200

    with dashboard_db() as db:
        reminder = db.get(MedicationReminder, reminder_id)
        assert reminder is not None
        assert reminder.is_active is True
        assert (
            db.query(ReminderCompletion)
            .filter(ReminderCompletion.reminder_id == reminder_id)
            .count()
            == 1
        )

    reminder_data = client.get("/api/v1/reminders").json()[0]
    assert reminder_data["completed_today"] is True
    assert reminder_data["is_active"] is True
