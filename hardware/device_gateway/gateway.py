from __future__ import annotations

import logging
from typing import Any

from hardware.drivers.device import CapturedImage, DeviceStatus, HealthScreeningDevice, SensorSample
from hardware.drivers.real_device import RealHardwareDevice
from hardware.drivers.serial_device import SerialHardwareDevice
from hardware.protocols.schema import make_envelope
from hardware.simulator.simulated_device import SimulatedDevice

logger = logging.getLogger(__name__)


class DeviceGateway:
    """Owns the active HealthScreeningDevice. API layer must not import ESP32/MCU code."""

    def __init__(self, mode: str, device_id: str, port: str = "AUTO") -> None:
        self.mode = mode
        self.device_id = device_id
        self.device: HealthScreeningDevice
        if mode == "simulation":
            self.device = SimulatedDevice(device_id=device_id)
        elif mode == "real":
            self.device = RealHardwareDevice(device_id=device_id)
        elif mode in ("serial", "usb"):
            self.device = SerialHardwareDevice(device_id=device_id, port=port)
        else:
            raise ValueError(f"Unknown DEVICE_MODE: {mode}. Must be 'simulation', 'real' (Wi-Fi), or 'serial' (direct USB).")
        self._events: list[dict[str, Any]] = []

    def _log_event(self, message_type: str, payload: dict[str, Any]) -> dict[str, Any]:
        env = make_envelope(self.device_id, message_type, payload)
        record = env.model_dump()
        self._events.append(record)
        return record

    async def connect(self) -> DeviceStatus:
        self._log_event("DEVICE_CONNECT", {"mode": self.mode})
        await self.device.connect()
        status = await self.device.get_status()
        self._log_event("DEVICE_STATUS", {"state": status.state})
        return status

    async def disconnect(self) -> None:
        await self.device.disconnect()
        self._log_event("DEVICE_STATUS", {"state": "OFFLINE"})

    async def status(self) -> DeviceStatus:
        return await self.device.get_status()

    async def capture(self) -> CapturedImage:
        await self.device.set_display("PLACE/CAPTURE IMAGE")
        image = await self.device.capture_image()
        self._log_event("IMAGE_TRANSFER", {"bytes": len(image.content), "mime": image.mime_type})
        return image

    async def sensors(self) -> list[SensorSample]:
        samples = await self.device.read_sensors()
        self._log_event(
            "SENSOR_DATA",
            {"count": len(samples), "statuses": [s.status for s in samples]},
        )
        return samples

    async def start_screening(self) -> None:
        self._log_event("SCREENING_START", {})
        await self.device.set_display("ANALYZING...")

    async def push_result(self, result: dict[str, Any]) -> None:
        # Device display gets a short, non-diagnostic summary only
        await self.device.send_result(result)
        self._log_event("SCREENING_RESULT", {"prediction": result.get("prediction")})

    async def heartbeat(self) -> None:
        self._log_event("HEARTBEAT", {})

    @property
    def recent_events(self) -> list[dict[str, Any]]:
        return list(self._events[-50:])
