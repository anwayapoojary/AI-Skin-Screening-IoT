from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from backend.app.config import settings
from backend.app.db.session import get_db
from backend.app.deps import auth_ready, get_gateway, get_model
from backend.app.models.entities import Device, Patient, Screening, SensorReading
from backend.app.schemas.api import ScreeningCreate, ScreeningOut
from backend.app.services.devices import persist_gateway_events, upsert_device
from backend.app.services.images import save_image, validate_image_bytes
from hardware.drivers.device import DeviceOfflineError

router = APIRouter(dependencies=[Depends(auth_ready)])


@router.get("", response_model=list[ScreeningOut])
def list_screenings(patient_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(Screening)
    if patient_id is not None:
        q = q.filter(Screening.patient_id == patient_id)
    return q.order_by(Screening.id.desc()).all()


@router.get("/{screening_id}", response_model=ScreeningOut)
def get_screening(screening_id: int, db: Session = Depends(get_db)):
    row = db.get(Screening, screening_id)
    if not row:
        raise HTTPException(status_code=404, detail="Screening not found")
    return row


@router.post("", response_model=ScreeningOut)
async def create_and_run_screening(body: ScreeningCreate, db: Session = Depends(get_db)):
    """Device-mode capture: virtual or real device camera through the gateway."""
    return await _run_screening(db, body.patient_id, image_bytes=None, image_source=body.image_source)


@router.post("/upload", response_model=ScreeningOut)
async def screening_from_upload(
    patient_id: int = Form(...),
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    """Development mode: computer/phone image enters the same AI pipeline."""
    data = await file.read()
    if len(data) > settings.max_upload_bytes:
        raise HTTPException(status_code=400, detail="File too large")
    return await _run_screening(db, patient_id, image_bytes=data, image_source="computer")


@router.post("/{screening_id}/predict", response_model=ScreeningOut)
async def repredict(screening_id: int, db: Session = Depends(get_db)):
    row = db.get(Screening, screening_id)
    if not row or not row.image_path:
        raise HTTPException(status_code=404, detail="Screening image not found")
    with open(row.image_path, "rb") as fh:
        data = fh.read()
    quality, mime = validate_image_bytes(data)
    model = get_model()
    pred = model.predict(data, image_quality_status=quality)
    row.prediction = pred.prediction
    row.confidence = pred.confidence
    row.abstained = pred.abstained
    row.model_name = type(model).__name__
    row.model_version = pred.model_version
    row.preprocessing_version = pred.preprocessing_version
    row.image_quality_status = pred.image_quality_status
    row.prediction_timestamp = pred.timestamp
    db.commit()
    db.refresh(row)
    return row


async def _run_screening(
    db: Session,
    patient_id: int,
    image_bytes: bytes | None,
    image_source: str,
) -> Screening:
    patient = db.get(Patient, patient_id)
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    gw = get_gateway()
    try:
        status = await gw.status()
        if status.state == "OFFLINE":
            status = await gw.connect()
    except (NotImplementedError, DeviceOfflineError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    device_row = upsert_device(db, status, device_type="simulator" if gw.mode == "simulation" else "unknown")

    await gw.start_screening()
    if image_bytes is None:
        try:
            captured = await gw.capture()
            image_bytes = captured.content
            mime_hint = captured.mime_type
            image_source = captured.source
        except TimeoutError:
            raise HTTPException(status_code=504, detail="E_TIMEOUT") from None
        except RuntimeError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc
    else:
        mime_hint = None

    quality, mime = validate_image_bytes(image_bytes, mime_hint)
    model = get_model()
    if quality != "ok":
        path = None
        pred = model.predict(image_bytes or b"", image_quality_status="invalid")
    else:
        path = save_image(image_bytes, mime)
        pred = model.predict(image_bytes, image_quality_status="ok")

    samples = await gw.sensors()
    for s in samples:
        db.add(
            SensorReading(
                device_pk=device_row.id,
                name=s.name,
                value=s.value,
                unit=s.unit,
                status=s.status,
            )
        )

    row = Screening(
        patient_id=patient.id,
        device_id=device_row.id,
        image_path=path,
        image_source=image_source,
        prediction=pred.prediction,
        confidence=pred.confidence,
        abstained=pred.abstained,
        model_name=type(model).__name__,
        model_version=pred.model_version,
        preprocessing_version=pred.preprocessing_version,
        image_quality_status=pred.image_quality_status,
        device_firmware_version=status.firmware_version,
        prediction_timestamp=pred.timestamp,
    )
    db.add(row)
    persist_gateway_events(db, gw, device_row.id)
    db.commit()
    db.refresh(row)

    await gw.push_result(
        {
            "prediction": pred.prediction,
            "confidence": pred.confidence,
            "abstained": pred.abstained,
            "screening_id": row.id,
        }
    )
    device_row.connection_status = (await gw.status()).state
    db.commit()
    return row
