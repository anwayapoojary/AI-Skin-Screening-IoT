from __future__ import annotations

from typing import Any

from hardware.drivers.device import CapturedImage, DeviceStatus, HealthScreeningDevice, SensorSample
from hardware.drivers.sensors import HumiditySensor, OtherHealthSensor, TemperatureSensor
from hardware.protocols.constants import PROTOCOL_VERSION
from hardware.protocols.schema import utc_now_iso
from hardware.simulator.sample_image import get_sample_png
from hardware.simulator.state_machine import DeviceStateMachine


class SimulatedDevice(HealthScreeningDevice):
    """Virtual device that speaks the same interface as future real hardware."""

    def __init__(self, device_id: str = "DEVICE_001") -> None:
        self.device_id = device_id
        self.sm = DeviceStateMachine()
        self._firmware = "sim-0.1.0"
        self._last_comm: str | None = None
        self._last_result: dict[str, Any] | None = None
        self._sensors = [TemperatureSensor(), HumiditySensor(), OtherHealthSensor()]
        self.fail_next_capture = False
        self.timeout_next = False
        self.flash_on = False
        self.button = "idle"
        self.device_type = "esp32-cam-simulator"

    def _touch(self) -> None:
        self._last_comm = utc_now_iso()

    async def connect(self) -> None:
        if self.sm.state == "READY":
            self._touch()
            return
        if self.sm.state == "ERROR":
            self.sm.transition("CONNECTING")
        else:
            self.sm.transition("CONNECTING")
        self._touch()
        self.sm.transition("READY")
        self.sm.display_state = "READY"

    async def disconnect(self) -> None:
        self.sm.transition("OFFLINE")
        self.sm.display_state = "READY"
        self._touch()

    async def get_status(self) -> DeviceStatus:
        self._touch()
        connected = self.sm.state not in ("OFFLINE",)
        return DeviceStatus(
            device_id=self.device_id,
            connected=connected and self.sm.state != "OFFLINE",
            state=self.sm.state,
            camera_status="ok" if self.sm.state != "ERROR" else "error",
            sensor_status="unavailable",
            communication_status="ok" if connected else "disconnected",
            firmware_version=self._firmware,
            protocol_version=PROTOCOL_VERSION,
            power_status=None,
            last_communication=self._last_comm,
            display_state=self.sm.display_state,
            extra={"button": self.button, "flash": "on" if self.flash_on else "off", "oled": "0.96in-sim"},
        )

    async def capture_image(
        self,
        patient_id: int | None = None,
        screening_id: int | None = None,
    ) -> CapturedImage:
        if self.timeout_next:
            self.timeout_next = False
            self.sm.transition("ERROR")
            raise TimeoutError("E_TIMEOUT")
        if self.fail_next_capture:
            self.fail_next_capture = False
            self.sm.transition("ERROR")
            raise RuntimeError("E_CAPTURE")
        self.sm.transition("CAPTURING")
        self.sm.display_state = "CAPTURING..."
        self.flash_on = True
        self._touch()
        self.sm.transition("TRANSFERRING")
        self.flash_on = False
        self.sm.display_state = "PROCESSING..."
        return CapturedImage(content=get_sample_png(), mime_type="image/png", source="device")

    async def read_sensors(self) -> list[SensorSample]:
        self._touch()
        return [s.read() for s in self._sensors]

    async def send_result(self, result: dict[str, Any]) -> None:
        self._last_result = result
        self.sm.transition("READY")
        self.sm.display_state = "RESULT AVAILABLE"
        self._touch()

    async def set_display(self, display_state: str) -> None:
        self.sm.display_state = display_state
        self._touch()

    @property
    def last_result(self) -> dict[str, Any] | None:
        return self._last_result
