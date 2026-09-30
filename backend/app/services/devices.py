from __future__ import annotations

from datetime import datetime, timezone

from sqlalchemy.orm import Session

from backend.app.models.entities import Device, DeviceEvent
from hardware.device_gateway.gateway import DeviceGateway
from hardware.drivers.device import DeviceStatus


def upsert_device(db: Session, status: DeviceStatus, device_type: str = "simulator") -> Device:
    row = db.query(Device).filter(Device.device_id == status.device_id).one_or_none()
    now = datetime.now(timezone.utc)
    if row is None:
        row = Device(
            device_id=status.device_id,
            device_type=device_type,
            firmware_version=status.firmware_version,
            protocol_version=status.protocol_version,
            connection_status=status.state,
            last_seen=now,
        )
        db.add(row)
        db.commit()
        db.refresh(row)
        return row
    row.firmware_version = status.firmware_version
    row.protocol_version = status.protocol_version
    row.connection_status = status.state
    row.last_seen = now
    db.commit()
    db.refresh(row)
    return row


def persist_gateway_events(db: Session, gateway: DeviceGateway, device_pk: int) -> None:
    import json

    for ev in gateway.recent_events:
        db.add(
            DeviceEvent(
                device_pk=device_pk,
                message_type=ev["message_type"],
                payload_json=json.dumps(ev.get("payload") or {}),
            )
        )
    db.commit()
