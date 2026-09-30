from __future__ import annotations

from datetime import datetime, timezone
from typing import Any

from pydantic import BaseModel, Field

from hardware.protocols.constants import (
    DEVICE_STATES,
    ERROR_CODES,
    MESSAGE_TYPES,
    PROTOCOL_VERSION,
)


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


class DeviceEnvelope(BaseModel):
    protocol_version: str = PROTOCOL_VERSION
    device_id: str
    message_type: str
    timestamp: str = Field(default_factory=utc_now_iso)
    payload: dict[str, Any] = Field(default_factory=dict)

    def model_post_init(self, __context: Any) -> None:
        if self.message_type not in MESSAGE_TYPES:
            raise ValueError(f"Unknown message_type: {self.message_type}")


class DeviceStatusPayload(BaseModel):
    state: str
    camera_status: str = "unknown"
    sensor_status: str = "unknown"
    communication_status: str = "ok"
    firmware_version: str | None = None
    protocol_version: str = PROTOCOL_VERSION
    power_status: str | None = None  # omit/None until hardware confirms battery telemetry
    last_error: str | None = None
    display_state: str | None = None

    def model_post_init(self, __context: Any) -> None:
        if self.state not in DEVICE_STATES:
            raise ValueError(f"Unknown state: {self.state}")


class ErrorPayload(BaseModel):
    code: str
    message: str
    details: dict[str, Any] = Field(default_factory=dict)

    def model_post_init(self, __context: Any) -> None:
        if self.code not in ERROR_CODES:
            raise ValueError(f"Unknown error code: {self.code}")


def make_envelope(device_id: str, message_type: str, payload: dict[str, Any] | None = None) -> DeviceEnvelope:
    return DeviceEnvelope(device_id=device_id, message_type=message_type, payload=payload or {})
