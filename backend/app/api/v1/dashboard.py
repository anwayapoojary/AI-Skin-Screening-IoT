from datetime import date, datetime, timedelta, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import and_, func, not_, or_
from sqlalchemy.orm import Session

from ai.inference import get_model_metadata
from backend.app.config import settings
from backend.app.db.session import get_db
from backend.app.deps import auth_ready, get_model
from backend.app.models.entities import Device, MedicationReminder, Patient, Screening
from backend.app.schemas.api import DashboardSummaryOut

router = APIRouter(dependencies=[Depends(auth_ready)])


@router.get("/summary", response_model=DashboardSummaryOut)
def get_dashboard_summary(db: Session = Depends(get_db)):
    total_patients = db.query(func.count(Patient.id)).scalar() or 0

    now_utc = datetime.now(timezone.utc)
    today_start = now_utc.replace(hour=0, minute=0, second=0, microsecond=0)
    today_start_naive = today_start.replace(tzinfo=None)
    tomorrow_start_naive = today_start_naive + timedelta(days=1)
    week_start_naive = today_start_naive - timedelta(days=today_start.weekday())

    screenings_today = (
        db.query(func.count(Screening.id))
        .filter(
            Screening.created_at >= today_start_naive,
            Screening.created_at < tomorrow_start_naive,
        )
        .scalar()
        or 0
    )
    screenings_this_week = (
        db.query(func.count(Screening.id))
        .filter(
            Screening.created_at >= week_start_naive,
            Screening.created_at < tomorrow_start_naive,
        )
        .scalar()
        or 0
    )
    pending_results = (
        db.query(func.count(Screening.id))
        .filter(
            or_(
                Screening.image_quality_status == "pending",
                and_(
                    Screening.prediction.is_(None),
                    or_(
                        Screening.image_quality_status.is_(None),
                        not_(Screening.image_quality_status.in_(["rejected", "failed"])),
                    ),
                ),
            )
        )
        .scalar()
        or 0
    )
    failed_uploads = (
        db.query(func.count(Screening.id))
        .filter(Screening.image_quality_status.in_(["rejected", "failed"]))
        .scalar()
        or 0
    )
    upcoming_reminders = (
        db.query(func.count(MedicationReminder.id))
        .filter(
            MedicationReminder.is_active.is_(True),
            or_(
                MedicationReminder.end_date.is_(None),
                MedicationReminder.end_date >= date.today().isoformat(),
            ),
        )
        .scalar()
        or 0
    )

    latest_device = (
        db.query(Device.last_seen)
        .filter(Device.last_seen.isnot(None))
        .order_by(Device.last_seen.desc())
        .first()
    )
    last_sync = latest_device[0] if latest_device and latest_device[0] else None

    model_info = get_model_metadata()
    model_version = (
        get_model().model_version
        if settings.model_backend == "mock"
        else model_info.get("model_version")
    )
    model_label = (
        "Mock screening model"
        if settings.model_backend == "mock"
        else model_info.get("model_name", "Real skin model unavailable")
    )

    return DashboardSummaryOut(
        total_patients=total_patients,
        screenings_today=screenings_today,
        screenings_this_week=screenings_this_week,
        pending_results=pending_results,
        upcoming_reminders=upcoming_reminders,
        failed_uploads=failed_uploads,
        active_ai_model=model_label,
        model_version=model_version,
        model_backend=settings.model_backend,
        device_mode=settings.device_mode,
        ai_mode=settings.ai_mode,
        last_sync=last_sync,
    )
