from datetime import datetime, timezone
from typing import Literal

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from backend.app.api.v1.screenings import _read_image, _run_inference, _validate_or_raise
from backend.app.config import settings
from backend.app.db.session import get_db
from backend.app.deps import auth_ready, require_device_token
from backend.app.device_adapters import get_device_adapter
from backend.app.models.entities import Device, Patient, Screening
from backend.app.services.devices import record_device_upload
from backend.app.services.images import save_image
from backend.app.schemas.api import ScreeningOut
from hardware.device_gateway.connection_manager import manager

router = APIRouter(dependencies=[Depends(auth_ready), Depends(require_device_token)])
UploadSource = Literal["wifi", "usb", "simulated"]


@router.post("/upload", response_model=ScreeningOut)
async def upload_device_image(
    patient_id: int = Form(...),
    file: UploadFile = File(...),
    source: UploadSource = Form(...),
    device_id: str = Form(..., min_length=1, max_length=64),
    screening_id: int | None = Form(default=None, gt=0),
    db: Session = Depends(get_db),
):
    patient = db.get(Patient, patient_id)
    if patient is None:
        raise HTTPException(status_code=404, detail="Patient not found")

    try:
        adapter = get_device_adapter(source)
        upload = adapter.prepare_upload(device_id)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    image_bytes = await _read_image(file)
    mime = _validate_or_raise(image_bytes, file.content_type)
    device = record_device_upload(
        db,
        device_id=upload.device_id,
        source=upload.source,
        device_type=upload.device_type,
    )
    row = db.get(Screening, screening_id) if screening_id is not None else None
    if screening_id is not None and row is None:
        raise HTTPException(status_code=404, detail="Screening not found")
    if row is not None and row.patient_id != patient.id:
        raise HTTPException(status_code=422, detail="Screening does not belong to patient")
    if row is None:
        row = Screening(patient_id=patient.id)
        db.add(row)
    row.device_id = device.id
    row.image_path = save_image(image_bytes, mime)
    row.image_source = upload.source
    row.source = upload.source
    row.image_quality_status = "uploaded"
    db.flush()
    return _run_inference(db, row, image_bytes)


@router.get("/status")
def device_transport_status(db: Session = Depends(get_db)):
    latest_device = db.query(Device).order_by(Device.last_seen.desc()).first()
    latest_upload = (
        db.query(Screening)
        .filter(Screening.device_id.isnot(None))
        .order_by(Screening.created_at.desc())
        .first()
    )
    latest_upload_device = (
        db.get(Device, latest_upload.device_id)
        if latest_upload and latest_upload.device_id
        else None
    )
    latest_device = latest_upload_device or latest_device
    reported_mode = (
        manager.last_status(latest_device.device_id).get("transport_mode")
        if latest_device and manager.is_connected(latest_device.device_id)
        else None
    )
    active_mode = reported_mode or (
        latest_upload.source if latest_upload else settings.device_transport
    )
    last_sync = latest_device.last_seen if latest_device else None
    if last_sync is not None and last_sync.tzinfo is None:
        last_sync = last_sync.replace(tzinfo=timezone.utc)

    return {
        "active_mode": active_mode,
        "mode_source": (
            "device_reported"
            if reported_mode
            else "last_upload"
            if latest_upload
            else "configured"
        ),
        "device_id": latest_upload_device.device_id
        if latest_upload_device
        else latest_device.device_id
        if latest_device
        else None,
        "last_upload_source": latest_upload.source if latest_upload else None,
        "last_sync": last_sync.isoformat() if last_sync else None,
        "server_time": datetime.now(timezone.utc).isoformat(),
    }
