"""Server-side handle for the real ESP32-CAM, spoken to over Wi-Fi (protocol v1.0).

The physical device is a WebSocket *client* that connects to the backend at
``/ws/device``. This class does not touch GPIO or MCU code — it commands the
connected device through the shared ConnectionManager and shapes replies into
the same interface the simulator implements, so the API layer is unchanged.

Pin/board specifics live only in firmware. Nothing here assumes GPIO numbers.
"""

from __future__ import annotations

from typing import Any

from hardware.device_gateway.connection_manager import manager
from hardware.drivers.device import (
    CapturedImage,
    DeviceOfflineError,
    DeviceStatus,
    HealthScreeningDevice,
    SensorSample,
)
from hardware.protocols.constants import PROTOCOL_VERSION


class RealHardwareDevice(HealthScreeningDevice):
    """Talks to a real ESP32-CAM that has connected over Wi-Fi."""

    def __init__(self, device_id: str) -> None:
        self.device_id = device_id
        self._display_state = "READY"

    def _require_online(self) -> None:
        if not manager.is_connected(self.device_id):
            raise DeviceOfflineError(
                f"E_DISCONNECT: device {self.device_id} has not connected over Wi-Fi. "
                "Power the ESP32-CAM and confirm it reaches /ws/device."
            )

    async def connect(self) -> None:
        # The device initiates its own Wi-Fi/WebSocket connection; the server
        # cannot dial out to it. We simply verify it is present.
        self._require_online()

    async def disconnect(self) -> None:
        # Server-side no-op: the device owns its socket lifecycle. We optionally
        # blank the display if it is still reachable.
        if manager.is_connected(self.device_id):
            try:
                await manager.set_display(self.device_id, "READY")
            except Exception:
                pass

    async def get_status(self) -> DeviceStatus:
        online = manager.is_connected(self.device_id)
        payload: dict[str, Any] = manager.last_status(self.device_id) if online else {}
        state = payload.get("state") or ("READY" if online else "OFFLINE")
        return DeviceStatus(
            device_id=self.device_id,
            connected=online,
            state=state,
            camera_status=payload.get("camera_status", "ok" if online else "unknown"),
            sensor_status=payload.get("sensor_status", "unavailable"),
            communication_status="ok" if online else "disconnected",
            firmware_version=payload.get("firmware_version"),
            protocol_version=payload.get("protocol_version", PROTOCOL_VERSION),
            power_status=payload.get("power_status"),  # None until hardware reports it
            last_communication=manager.last_seen(self.device_id),
            display_state=payload.get("display_state", self._display_state),
            extra={
                "button": payload.get("button"),
                "flash": payload.get("flash"),
                "oled": payload.get("oled", "0.96in"),
            },
        )

    async def capture_image(
        self,
        patient_id: int | None = None,
        screening_id: int | None = None,
    ) -> CapturedImage:
        self._require_online()
        data, mime = await manager.request_capture(
            self.device_id,
            patient_id=patient_id,
            screening_id=screening_id,
        )
        return CapturedImage(content=data, mime_type=mime, source="device")

    async def read_sensors(self) -> list[SensorSample]:
        # No health/environment sensors in the BOM — nothing to report.
        return []

    async def send_result(self, result: dict[str, Any]) -> None:
        if not manager.is_connected(self.device_id):
            return
        # Only a short, non-diagnostic summary reaches the OLED.
        summary = {
            "prediction": result.get("prediction"),
            "abstained": result.get("abstained"),
            "display_state": "RESULT AVAILABLE",
        }
        await manager.send_result(self.device_id, summary)

    async def set_display(self, display_state: str) -> None:
        self._display_state = display_state
        if manager.is_connected(self.device_id):
            await manager.set_display(self.device_id, display_state)
