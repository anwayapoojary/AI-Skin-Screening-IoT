"""Registry of live device Wi-Fi connections (protocol v1.0 over WebSocket).

The ESP32-CAM is the WebSocket *client*: it connects out to the backend at
``/ws/device``, announces itself with DEVICE_CONNECT, then streams status /
heartbeats and answers commands (IMAGE_CAPTURE -> IMAGE_TRANSFER).

This module is a process-wide singleton (``manager``) shared by the WebSocket
endpoint and by RealHardwareDevice, so the request path can command a device
that connected on a different task. It holds no MCU-specific code.
"""

from __future__ import annotations

import asyncio
import base64
import logging
from typing import Any, Protocol
from uuid import uuid4

from hardware.drivers.device import DeviceCommandTimeout
from hardware.protocols.schema import make_envelope, utc_now_iso

logger = logging.getLogger(__name__)


class WSLike(Protocol):
    async def send_text(self, data: str) -> None: ...


class DeviceConnection:
    def __init__(self, device_id: str, ws: WSLike) -> None:
        self.device_id = device_id
        self.ws = ws
        self.connected_at = utc_now_iso()
        self.last_seen = self.connected_at
        self.last_status: dict[str, Any] = {}
        # request_id -> Future awaiting an IMAGE_TRANSFER / response
        self.pending: dict[str, asyncio.Future] = {}


class ConnectionManager:
    def __init__(self) -> None:
        self._conns: dict[str, DeviceConnection] = {}
        self._lock = asyncio.Lock()

    # ----------------------------------------------------------- lifecycle
    async def register(self, device_id: str, ws: WSLike) -> DeviceConnection:
        async with self._lock:
            existing = self._conns.get(device_id)
            if existing is not None:
                # Replace a stale connection; fail its pending requests.
                self._fail_pending(existing, "replaced by new connection")
            conn = DeviceConnection(device_id, ws)
            self._conns[device_id] = conn
            logger.info("device connected: %s", device_id)
            return conn

    async def unregister(self, device_id: str, ws: WSLike | None = None) -> None:
        async with self._lock:
            conn = self._conns.get(device_id)
            if conn is None:
                return
            if ws is not None and conn.ws is not ws:
                return  # a newer connection already took over
            self._fail_pending(conn, "device disconnected")
            self._conns.pop(device_id, None)
            logger.info("device disconnected: %s", device_id)

    def _fail_pending(self, conn: DeviceConnection, reason: str) -> None:
        for fut in list(conn.pending.values()):
            if not fut.done():
                fut.set_exception(DeviceCommandTimeout(reason))
        conn.pending.clear()

    # --------------------------------------------------------------- state
    def is_connected(self, device_id: str) -> bool:
        return device_id in self._conns

    def last_status(self, device_id: str) -> dict[str, Any]:
        conn = self._conns.get(device_id)
        return dict(conn.last_status) if conn else {}

    def last_seen(self, device_id: str) -> str | None:
        conn = self._conns.get(device_id)
        return conn.last_seen if conn else None

    def connected_ids(self) -> list[str]:
        return list(self._conns.keys())

    # ------------------------------------------------------------ commands
    async def _send(self, device_id: str, message_type: str, payload: dict[str, Any]) -> None:
        conn = self._conns.get(device_id)
        if conn is None:
            raise DeviceCommandTimeout(f"device {device_id} not connected")
        env = make_envelope(device_id, message_type, payload)
        await conn.ws.send_text(env.model_dump_json())

    async def set_display(self, device_id: str, display_state: str) -> None:
        await self._send(device_id, "SET_DISPLAY", {"display_state": display_state})

    async def send_result(self, device_id: str, summary: dict[str, Any]) -> None:
        await self._send(device_id, "SCREENING_RESULT", summary)

    async def start_screening(self, device_id: str) -> None:
        await self._send(device_id, "SCREENING_START", {})

    async def request_capture(
        self,
        device_id: str,
        timeout: float = 60.0,
        patient_id: int | None = None,
        screening_id: int | None = None,
    ) -> tuple[bytes, str]:
        """Command a capture and await the returned image. Returns (bytes, mime)."""
        conn = self._conns.get(device_id)
        if conn is None:
            raise DeviceCommandTimeout(f"device {device_id} not connected")
        request_id = uuid4().hex
        loop = asyncio.get_running_loop()
        fut: asyncio.Future = loop.create_future()
        conn.pending[request_id] = fut
        try:
            await self._send(
                device_id,
                "IMAGE_CAPTURE",
                {
                    "request_id": request_id,
                    "patient_id": patient_id,
                    "screening_id": screening_id,
                },
            )
            image_b64, mime = await asyncio.wait_for(fut, timeout=timeout)
        except asyncio.TimeoutError as exc:
            raise DeviceCommandTimeout("E_TIMEOUT: no image within timeout") from exc
        finally:
            conn.pending.pop(request_id, None)
        try:
            data = base64.b64decode(image_b64)
        except Exception as exc:
            raise RuntimeError("E_IMAGE: bad base64 image payload") from exc
        return data, mime

    # ---------------------------------------------------------- ingest RX
    async def handle_incoming(self, device_id: str, envelope: dict[str, Any]) -> None:
        conn = self._conns.get(device_id)
        if conn is None:
            return
        conn.last_seen = utc_now_iso()
        mtype = envelope.get("message_type")
        payload = envelope.get("payload") or {}

        if mtype == "DEVICE_STATUS":
            conn.last_status = payload
        elif mtype == "HEARTBEAT":
            if payload:
                conn.last_status.update(payload)
        elif mtype == "IMAGE_TRANSFER":
            req = payload.get("request_id")
            fut = conn.pending.get(req) if req else None
            if fut is None and conn.pending:
                # Fall back to the oldest pending request if no id was echoed.
                fut = next(iter(conn.pending.values()))
            if fut is not None and not fut.done():
                fut.set_result((payload.get("image_b64", ""), payload.get("mime", "image/jpeg")))
        elif mtype == "ERROR":
            # Fail any in-flight capture with the device's error.
            code = payload.get("code", "E_INVALID_CMD")
            msg = payload.get("message", "device error")
            for fut in list(conn.pending.values()):
                if not fut.done():
                    fut.set_exception(RuntimeError(f"{code}: {msg}"))
            conn.pending.clear()
        # DEVICE_CONNECT / SENSOR_DATA are informational here.


# Process-wide singleton.
manager = ConnectionManager()
