from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.deps import auth_ready, get_gateway
from backend.app.models.entities import Device
from backend.app.schemas.api import DeviceOut, DeviceStatusOut
from backend.app.services.devices import persist_gateway_events, upsert_device
from hardware.drivers.device import DeviceOfflineError

router = APIRouter(dependencies=[Depends(auth_ready)])


@router.get("", response_model=list[DeviceOut])
def list_devices(db: Session = Depends(get_db)):
    return db.query(Device).all()


@router.post("/{device_id}/connect", response_model=DeviceStatusOut)
async def connect_device(device_id: str, db: Session = Depends(get_db)):
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
    gw = get_gateway()
    if gw.device_id != device_id:
        raise HTTPException(status_code=404, detail="Unknown device_id")
    try:
        status = await gw.status()
    except (NotImplementedError, DeviceOfflineError) as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    return _status_out(status, gw.mode)


@router.post("/{device_id}/capture")
async def capture(device_id: str):
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
