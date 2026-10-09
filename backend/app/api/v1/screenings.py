from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from ai.inference import MAX_UPLOAD_BYTES, InferenceError, ModelUnavailableError
from backend.app.db.session import get_db
from backend.app.deps import auth_ready, get_gateway, get_model
from backend.app.models.entities import Patient, Screening, SensorReading
from backend.app.schemas.api import ScreeningCreate, ScreeningOut
from backend.app.services.devices import persist_gateway_events, upsert_device
from backend.app.services.images import save_image, validate_image_bytes
from hardware.drivers.device import DeviceOfflineError

router = APIRouter(dependencies=[Depends(auth_ready)])
Source = Literal["upload", "wifi", "usb", "simulated"]


@router.get("", response_model=list[ScreeningOut])
def list_screenings(patient_id: int | None = None, db: Session = Depends(get_db)):
    query = db.query(Screening)
    if patient_id is not None:
        query = query.filter(Screening.patient_id == patient_id)
    return query.order_by(Screening.id.desc()).all()


@router.get("/{screening_id}", response_model=ScreeningOut)
def get_screening(screening_id: int, db: Session = Depends(get_db)):
    row = db.get(Screening, screening_id)
    if not row:
        raise HTTPException(status_code=404, detail="Screening not found")
    return row


@router.post("", response_model=ScreeningOut)
def create_screening(body: ScreeningCreate, db: Session = Depends(get_db)):
    patient = db.get(Patient, body.patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    row = Screening(
        patient_id=patient.id,
        image_source=body.source,
        source=body.source,
        image_quality_status="pending",
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.post("/{screening_id}/upload", response_model=ScreeningOut)
async def upload_screening_image(
    screening_id: int,
    file: UploadFile = File(...),
    source: Source = Form(default="upload"),
    db: Session = Depends(get_db),
):
    row = _get_screening(db, screening_id)
    image_bytes = await _read_image(file)
    mime = _validate_or_raise(image_bytes)
    row.image_path = save_image(image_bytes, mime)
    row.image_source = source
    row.source = source
    row.image_quality_status = "uploaded"
    db.commit()
    db.refresh(row)
    return row


@router.post("/{screening_id}/analyze", response_model=ScreeningOut)
async def analyze_screening(screening_id: int, db: Session = Depends(get_db)):
    row = _get_screening(db, screening_id)
    if not row.image_path:
        raise HTTPException(status_code=409, detail="Upload an image before analysis.")
    try:
        with open(row.image_path, "rb") as image_file:
            image_bytes = image_file.read(MAX_UPLOAD_BYTES + 1)
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Unable to read screening image: {exc}") from exc
    _validate_or_raise(image_bytes)
    return _run_inference(db, row, image_bytes)


@router.post("/{screening_id}/capture", response_model=ScreeningOut)
async def capture_screening(
    screening_id: int,
    db: Session = Depends(get_db),
):
    """Capture from the configured device gateway; simulation requires no hardware."""
    row = _get_screening(db, screening_id)
    gateway = get_gateway()
    try:
        status = await gateway.status()
        if status.state == "OFFLINE":
            status = await gateway.connect()
        await gateway.start_screening()
        captured = await gateway.capture(patient_id=row.patient_id, screening_id=row.id)
    except (NotImplementedError, DeviceOfflineError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except TimeoutError:
        raise HTTPException(status_code=504, detail="Device capture timed out.") from None
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    image_bytes = captured.content
    if gateway.mode == "real" and not image_bytes:
        db.refresh(row)
        if not row.image_path or row.source != "wifi":
            raise HTTPException(status_code=502, detail="Device upload completed without a screening image.")
    else:
        mime = _validate_or_raise(image_bytes, captured.mime_type)
        row.image_path = save_image(image_bytes, mime)
        row.image_source = "simulated" if gateway.mode == "simulation" else "wifi"
        row.source = row.image_source
    row.device_firmware_version = status.firmware_version
    device = upsert_device(
        db,
        status,
        device_type="simulator" if gateway.mode == "simulation" else "unknown",
    )
    row.device_id = device.id
    for sample in await gateway.sensors():
        db.add(
            SensorReading(
                device_pk=device.id,
                name=sample.name,
                value=sample.value,
                unit=sample.unit,
                status=sample.status,
            )
        )
    persist_gateway_events(db, gateway, device.id)
    db.commit()

    result = row if not image_bytes else _run_inference(db, row, image_bytes)
    await gateway.push_result(
        {
            "prediction": row.prediction,
            "confidence": row.confidence,
            "uncertain": row.uncertain,
            "screening_id": row.id,
        }
    )
    device.connection_status = (await gateway.status()).state
    db.commit()
    return result


@router.post("/upload", response_model=ScreeningOut)
async def create_upload_and_analyze(
    patient_id: int = Form(...),
    file: UploadFile = File(...),
    source: Source = Form(default="upload"),
    db: Session = Depends(get_db),
):
    """Compatibility endpoint for clients that submit the whole flow at once."""
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    row = Screening(
        patient_id=patient.id,
        image_source=source,
        source=source,
        image_quality_status="pending",
    )
    db.add(row)
    db.flush()
    image_bytes = await _read_image(file)
    mime = _validate_or_raise(image_bytes)
    row.image_path = save_image(image_bytes, mime)
    db.commit()
    return _run_inference(db, row, image_bytes)


@router.post("/{screening_id}/predict", response_model=ScreeningOut)
async def repredict(screening_id: int, db: Session = Depends(get_db)):
    return await analyze_screening(screening_id, db)


def _get_screening(db: Session, screening_id: int) -> Screening:
    row = db.get(Screening, screening_id)
    if not row:
        raise HTTPException(status_code=404, detail="Screening not found")
    return row


async def _read_image(file: UploadFile) -> bytes:
    image_bytes = await file.read(MAX_UPLOAD_BYTES + 1)
    if len(image_bytes) > MAX_UPLOAD_BYTES:
        raise HTTPException(
            status_code=413,
            detail="Image exceeds the 10 MB limit.",
        )
    return image_bytes


def _validate_or_raise(image_bytes: bytes, mime_hint: str | None = None) -> str:
    status, mime = validate_image_bytes(image_bytes, mime_hint)
    if status == "too_large":
        raise HTTPException(status_code=413, detail="Image exceeds the 10 MB limit.")
    if status != "ok":
        raise HTTPException(
            status_code=415,
            detail="Invalid image: upload a complete, decodable JPEG or PNG file.",
        )
    return mime


def _run_inference(db: Session, row: Screening, image_bytes: bytes) -> Screening:
    model = get_model()
    try:
        result = model.predict(image_bytes)
    except InferenceError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc
    except ModelUnavailableError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    row.prediction = (
        "Uncertain, needs review" if result["uncertain"] else result["top_name"]
    )
    row.confidence = result["probabilities"][result["top_label"]]
    row.abstained = result["uncertain"]
    row.uncertain = result["uncertain"]
    row.top_label = result["top_label"]
    row.top_name = result["top_name"]
    row.probabilities = result["probabilities"]
    row.top3 = result["top3"]
    row.is_mock = result["is_mock"]
    row.model_name = "Mock screening model" if result["is_mock"] else "EfficientNet-B0"
    row.model_version = result["model_version"]
    row.preprocessing_version = "preprocess.json"
    row.image_quality_status = "ok"
    row.prediction_timestamp = datetime.now(timezone.utc).isoformat()
    db.commit()
    db.refresh(row)
    return row
