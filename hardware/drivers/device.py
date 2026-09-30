from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from typing import Any


class DeviceOfflineError(RuntimeError):
    """Raised when a real device has not connected over Wi-Fi yet."""


class DeviceCommandTimeout(TimeoutError):
    """Raised when a device does not answer a command in time."""


@dataclass
class CapturedImage:
    content: bytes
    mime_type: str = "image/png"
    source: str = "device"  # device | computer | phone


@dataclass
class SensorSample:
    name: str
    value: float | None
    unit: str | None
    status: str  # ok | unavailable | error | unknown


@dataclass
class DeviceStatus:
    device_id: str
    connected: bool
    state: str
    camera_status: str
    sensor_status: str
    communication_status: str
    firmware_version: str | None
    protocol_version: str
    power_status: str | None
    last_communication: str | None
    display_state: str | None
    extra: dict[str, Any] = field(default_factory=dict)


class HealthScreeningDevice(ABC):
    """Backend/gateway depend on this interface — not on MCU-specific code."""

    @abstractmethod
    async def connect(self) -> None: ...

    @abstractmethod
    async def disconnect(self) -> None: ...

    @abstractmethod
    async def get_status(self) -> DeviceStatus: ...

    @abstractmethod
    async def capture_image(self) -> CapturedImage: ...

    @abstractmethod
    async def read_sensors(self) -> list[SensorSample]: ...

    @abstractmethod
    async def send_result(self, result: dict[str, Any]) -> None: ...

    @abstractmethod
    async def set_display(self, display_state: str) -> None: ...


class Sensor(ABC):
    name: str
    unit: str | None = None

    @abstractmethod
    def read(self) -> SensorSample: ...
