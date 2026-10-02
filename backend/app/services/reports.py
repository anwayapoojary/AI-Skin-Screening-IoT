from backend.app.schemas.api import ReportOut
from backend.app.models.entities import Screening

DISCLAIMER = (
    "This document is a research screening report, not a medical certificate, "
    "diagnosis, or prescription. Interpret only with qualified clinical oversight."
)

REPORT_TITLE = "AI Health Screening Report"


def build_report(screening: Screening) -> ReportOut:
    patient = screening.patient
    device = screening.device
    return ReportOut(
        screening_id=screening.id,
        patient_code=patient.patient_code,
        patient_display_name=patient.display_name,
        date=screening.created_at,
        device_id=device.device_id if device else None,
        image_path=screening.image_path,
        prediction=screening.prediction,
        confidence=screening.confidence,
        abstained=screening.abstained,
        model_name=screening.model_name,
        model_version=screening.model_version,
        firmware_version=screening.device_firmware_version,
        image_quality_status=screening.image_quality_status,
        title=REPORT_TITLE,
        disclaimer=DISCLAIMER,
    )
