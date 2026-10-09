from ai.inference import get_model_metadata
from backend.app.schemas.api import ReportOut
from backend.app.models.entities import Screening
from backend.app.safety import SCREENING_DISCLAIMER

REPORT_TITLE = "AI Health Screening Report"


def build_report(screening: Screening) -> ReportOut:
    patient = screening.patient
    device = screening.device
    model_metadata = get_model_metadata()
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
        uncertain=screening.uncertain,
        is_mock=screening.is_mock,
        source=screening.source,
        top_label=screening.top_label,
        top_name=screening.top_name,
        probabilities=screening.probabilities,
        top3=screening.top3,
        timestamp=screening.timestamp,
        model_name=screening.model_name,
        model_version=screening.model_version,
        firmware_version=screening.device_firmware_version,
        image_quality_status=screening.image_quality_status,
        model_limitations=model_metadata.get("limitations", []),
        not_validated_on_device_images=True,
        title=REPORT_TITLE,
        disclaimer=SCREENING_DISCLAIMER,
    )
