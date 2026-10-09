import logging
from datetime import datetime, timezone
from pathlib import Path
from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile
from sqlalchemy.orm import Session

from backend.app.api.v1.screenings import _read_image, _run_inference, _validate_or_raise
from backend.app.db.session import get_db
from backend.app.deps import auth_ready, device_token_ok, get_gateway, require_device_token
from backend.app.models.entities import Device, DeviceEvent, Patient, Screening
from backend.app.schemas.api import DeviceOut, DeviceStatusOut
from backend.app.safety import SCREENING_DISCLAIMER
from backend.app.services.devices import persist_gateway_events, record_device_upload, upsert_device
from backend.app.services.images import save_image
from hardware.drivers.device import DeviceOfflineError

router = APIRouter(dependencies=[Depends(auth_ready)])
logger = logging.getLogger(__name__)
ONLINE_TIMEOUT_SECONDS = 10
_transport_details: dict[str, dict[str, str | None]] = {}
_capture_requests: set[str] = set()


def _record_event(db: Session, device: Device, message_type: str, payload: dict) -> None:
    import json

    db.add(
        DeviceEvent(
            device_pk=device.id,
            message_type=message_type,
            payload_json=json.dumps(payload, separators=(",", ":")),
        )
    )


def _utc(value: datetime | None) -> datetime | None:
    if value is None:
        return None
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)


def _latest_result(db: Session, device: Device) -> dict | None:
    row = (
        db.query(Screening)
        .filter(Screening.device_id == device.id)
        .order_by(Screening.created_at.desc(), Screening.id.desc())
        .first()
    )
    if row is None:
        return None
    image_url = f"/uploads/{Path(row.image_path).name}" if row.image_path else None
    return {
        "screening_id": row.id,
        "class": row.prediction,
        "confidence": row.confidence,
        "uncertain": row.uncertain,
        "is_mock": row.is_mock,
        "image_url": image_url,
        "note": SCREENING_DISCLAIMER,
        "created_at": row.prediction_timestamp or (
            _utc(row.created_at).isoformat() if row.created_at else None
        ),
    }


@router.post("/register", dependencies=[Depends(require_device_token)])
def register_device(body: dict, db: Session = Depends(get_db)):
    device_id = str(body.get("device_id", "")).strip()
    logger.info("Device request register: device_id=%s", device_id or "<missing>")
    if not device_id or len(device_id) > 64:
        raise HTTPException(status_code=422, detail="device_id must contain 1 to 64 characters")
    firmware = str(body.get("fw") or "unknown")[:64]
    transport = str(body.get("transport") or "usb serial")
    port = str(body.get("port") or "") or None
    logger.info("Device registration metadata: device_id=%s transport=%s port=%s", device_id, transport, port)

    device = db.query(Device).filter(Device.device_id == device_id).one_or_none()
    if device is None:
        device = Device(device_id=device_id, device_type="esp32-cam")
        db.add(device)
        db.flush()
    device.device_type = "esp32-cam"
    device.firmware_version = firmware
    device.protocol_version = "1.0"
    device.connection_status = "ONLINE"
    device.last_seen = datetime.now(timezone.utc)
    _transport_details[device_id] = {"transport": transport, "port": port}
    _record_event(db, device, "hello", body)
    db.commit()
    return {"ok": True, "device_id": device_id, "online": True}


@router.post("/heartbeat", dependencies=[Depends(require_device_token)])
def heartbeat(body: dict, db: Session = Depends(get_db)):
    device_id = str(body.get("device_id", "")).strip()
    logger.info("Device request heartbeat: device_id=%s", device_id or "<missing>")
    if not device_id:
        raise HTTPException(status_code=422, detail="device_id is required")
    device = db.query(Device).filter(Device.device_id == device_id).one_or_none()
    if device is None:
        raise HTTPException(status_code=404, detail="Device must register before sending heartbeats")
    device.connection_status = "ONLINE"
    device.last_seen = datetime.now(timezone.utc)
    details = _transport_details.setdefault(device_id, {"transport": "USB serial", "port": None})
    if body.get("transport"):
        details["transport"] = str(body["transport"])
    if body.get("port"):
        details["port"] = str(body["port"])
    _record_event(db, device, "heartbeat", body)
    db.commit()
    return {"ok": True, "device_id": device_id, "online": True, **details}


@router.get("/live")
def devices_live(db: Session = Depends(get_db)):
    logger.info("Device request live listing")
    now = datetime.now(timezone.utc)
    devices = []
    for device in db.query(Device).order_by(Device.last_seen.desc()).all():
        last_seen = _utc(device.last_seen)
        online = bool(
            last_seen is not None
            and (now - last_seen).total_seconds() <= ONLINE_TIMEOUT_SECONDS
        )
        details = _transport_details.get(device.device_id, {})
        devices.append(
            {
                "device_id": device.device_id,
                "online": online,
                "transport": details.get("transport", "USB serial" if device.device_type == "esp32-cam" else "unknown"),
                "port": details.get("port"),
                "last_seen": last_seen.isoformat() if last_seen else None,
                "firmware": device.firmware_version,
                "status": device.connection_status if online else "OFFLINE",
                "capture_requested": device.device_id in _capture_requests,
                "latest_result": _latest_result(db, device),
            }
        )
    return {"devices": devices, "online_timeout_seconds": ONLINE_TIMEOUT_SECONDS}


@router.get("/{device_id}/capture/request", dependencies=[Depends(require_device_token)])
def poll_capture_request(device_id: str):
    logger.info("Device request capture poll: device_id=%s", device_id)
    requested = device_id in _capture_requests
    _capture_requests.discard(device_id)
    return {"capture_requested": requested}


@router.get("/{device_id}/result/latest")
def latest_device_result(device_id: str, db: Session = Depends(get_db)):
    logger.info("Device request latest result: device_id=%s", device_id)
    device = db.query(Device).filter(Device.device_id == device_id).one_or_none()
    if device is None:
        raise HTTPException(status_code=404, detail="Device not found")
    result = _latest_result(db, device)
    if result is None:
        raise HTTPException(status_code=404, detail="No screening result is available for this device")
    return result


@router.get("", response_model=list[DeviceOut])
def list_devices(db: Session = Depends(get_db)):
    logger.info("Device request list")
    return db.query(Device).all()


@router.post("/{device_id}/connect", response_model=DeviceStatusOut)
async def connect_device(device_id: str, db: Session = Depends(get_db)):
    logger.info("Device request connect: device_id=%s", device_id)
    gw = get_gateway()
    if gw.device_id != device_id:
        raise HTTPException(status_code=404, detail="Unknown device_id in this process")
    try:
        status = await gw.connect()
    except (NotImplementedError, DeviceOfflineError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    row = upsert_device(db, status, device_type="simulator" if gw.mode == "simulation" else "esp32-cam")
    persist_gateway_events(db, gw, row.id)
    return _status_out(status, gw.mode)


@router.post("/{device_id}/disconnect")
async def disconnect_device(device_id: str, db: Session = Depends(get_db)):
    logger.info("Device request disconnect: device_id=%s", device_id)
    gw = get_gateway()
    if gw.device_id != device_id:
        raise HTTPException(status_code=404, detail="Unknown device_id")
    try:
        await gw.disconnect()
        status = await gw.status()
    except (NotImplementedError, DeviceOfflineError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    upsert_device(db, status)
    return {"ok": True, "state": status.state}


@router.get("/{device_id}/status", response_model=DeviceStatusOut)
async def device_status(device_id: str):
    logger.info("Device request status: device_id=%s", device_id)
    gw = get_gateway()
    if gw.device_id != device_id:
        raise HTTPException(status_code=404, detail="Unknown device_id")
    try:
        status = await gw.status()
    except (NotImplementedError, DeviceOfflineError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return _status_out(status, gw.mode)


@router.post("/{device_id}/capture")
async def capture(
    device_id: str,
    file: UploadFile | None = File(default=None),
    patient_id: int = Form(default=1, gt=0),
    request_only: bool = Query(default=False),
    x_device_token: str | None = Header(default=None, alias="X-Device-Token"),
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
):
    logger.info("Device request capture: device_id=%s upload=%s", device_id, file is not None)
    if file is not None:
        provided_token = x_device_token
        if provided_token is None and authorization and authorization.startswith("Bearer "):
            provided_token = authorization.removeprefix("Bearer ").strip()
        if not device_token_ok(provided_token):
            raise HTTPException(status_code=401, detail="Invalid or missing device token")
        patient = db.get(Patient, patient_id)
        if patient is None:
            raise HTTPException(status_code=404, detail=f"Patient {patient_id} not found")
        image_bytes = await _read_image(file)
        mime = _validate_or_raise(image_bytes, file.content_type)
        device = record_device_upload(
            db,
            device_id=device_id,
            source="usb",
            device_type="esp32-cam",
        )
        row = Screening(
            patient_id=patient.id,
            device_id=device.id,
            image_path=save_image(image_bytes, mime),
            image_source="usb",
            source="usb",
            image_quality_status="uploaded",
            device_firmware_version=device.firmware_version,
        )
        db.add(row)
        db.flush()
        _record_event(db, device, "capture", {"screening_id": row.id, "transport": "usb"})
        result = _run_inference(db, row, image_bytes)
        db.commit()
        db.refresh(result)
        return result

    device = db.query(Device).filter(Device.device_id == device_id).one_or_none()
    if request_only:
        last_seen = _utc(device.last_seen) if device else None
        if last_seen is None or (datetime.now(timezone.utc) - last_seen).total_seconds() > ONLINE_TIMEOUT_SECONDS:
            raise HTTPException(status_code=409, detail="Device is offline")
        _capture_requests.add(device_id)
        return {"ok": True, "capture_requested": True, "device_id": device_id}
    if device is not None and device.connection_status in {"ONLINE", "CAPTURING", "SENDING", "ANALYSING"}:
        _capture_requests.add(device_id)
        return {"ok": True, "capture_requested": True, "device_id": device_id}

    # Keep the pre-existing gateway capture behavior for non-serial clients.
    gw = get_gateway()
    if gw.device_id != device_id:
        raise HTTPException(status_code=404, detail="Unknown device_id")
    try:
        img = await gw.capture()
    except (NotImplementedError, DeviceOfflineError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except (TimeoutError, RuntimeError) as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc
    return {"ok": True, "bytes": len(img.content), "mime_type": img.mime_type, "source": img.source}


@router.get("/{device_id}/sensors")
async def sensors(device_id: str):
    logger.info("Device request sensors: device_id=%s", device_id)
    gw = get_gateway()
    if gw.device_id != device_id:
        raise HTTPException(status_code=404, detail="Unknown device_id")
    try:
        samples = await gw.sensors()
    except (NotImplementedError, DeviceOfflineError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return [
        {"name": s.name, "value": s.value, "unit": s.unit, "status": s.status}
        for s in samples
    ]


def _status_out(status, mode: str) -> DeviceStatusOut:
    return DeviceStatusOut(
        device_id=status.device_id,
        connected=status.connected,
        state=status.state,
        camera_status=status.camera_status,
        sensor_status=status.sensor_status,
        communication_status=status.communication_status,
        firmware_version=status.firmware_version,
        protocol_version=status.protocol_version,
        power_status=status.power_status,
        last_communication=status.last_communication,
        display_state=status.display_state,
        button=(status.extra or {}).get("button"),
        flash=(status.extra or {}).get("flash"),
        mode=mode,
    )
