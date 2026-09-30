"""Tests for the real-device WebSocket transport (ConnectionManager +
RealHardwareDevice), using a fake WebSocket so no real hardware is needed."""

import asyncio
import base64
import json

import pytest

from hardware.device_gateway.connection_manager import manager
from hardware.drivers.device import DeviceOfflineError
from hardware.drivers.real_device import RealHardwareDevice


class FakeWS:
    def __init__(self):
        self.sent: list[str] = []

    async def send_text(self, data: str) -> None:
        self.sent.append(data)

    def messages(self) -> list[dict]:
        return [json.loads(m) for m in self.sent]


def test_real_device_offline_raises():
    async def _run():
        dev = RealHardwareDevice("OFFLINE_DEV")
        st = await dev.get_status()
        assert st.state == "OFFLINE"
        assert st.connected is False
        with pytest.raises(DeviceOfflineError):
            await dev.connect()
        with pytest.raises(DeviceOfflineError):
            await dev.capture_image()

    asyncio.run(_run())


def test_status_reflects_device_report():
    async def _run():
        did = "WS_DEV_STATUS"
        ws = FakeWS()
        await manager.register(did, ws)
        await manager.handle_incoming(did, {
            "message_type": "DEVICE_STATUS",
            "payload": {
                "state": "READY", "camera_status": "ok",
                "firmware_version": "fw-1.2.3", "display_state": "READY",
                "flash": "off", "button": "idle",
            },
        })
        dev = RealHardwareDevice(did)
        await dev.connect()  # online -> must not raise
        st = await dev.get_status()
        assert st.connected is True
        assert st.state == "READY"
        assert st.firmware_version == "fw-1.2.3"
        assert st.sensor_status == "unavailable"
        await manager.unregister(did, ws)

    asyncio.run(_run())


def test_capture_round_trip_over_ws():
    async def _run():
        did = "WS_DEV_CAP"
        ws = FakeWS()
        await manager.register(did, ws)
        dev = RealHardwareDevice(did)

        img_bytes = b"\xff\xd8\xff" + b"FAKEJPEG" * 4
        b64 = base64.b64encode(img_bytes).decode()

        async def responder():
            for _ in range(200):
                for m in ws.messages():
                    if m["message_type"] == "IMAGE_CAPTURE":
                        rid = m["payload"]["request_id"]
                        await manager.handle_incoming(did, {
                            "message_type": "IMAGE_TRANSFER",
                            "payload": {"request_id": rid, "image_b64": b64, "mime": "image/jpeg"},
                        })
                        return
                await asyncio.sleep(0.005)
            raise AssertionError("no IMAGE_CAPTURE command was sent")

        cap = asyncio.ensure_future(dev.capture_image())
        await responder()
        captured = await cap
        assert captured.content == img_bytes
        assert captured.mime_type == "image/jpeg"
        assert captured.source == "device"
        await manager.unregister(did, ws)

    asyncio.run(_run())


def test_capture_times_out_without_response():
    async def _run():
        did = "WS_DEV_TIMEOUT"
        ws = FakeWS()
        await manager.register(did, ws)
        with pytest.raises(TimeoutError):
            await manager.request_capture(did, timeout=0.1)
        await manager.unregister(did, ws)

    asyncio.run(_run())


def test_commands_are_sent_to_device():
    async def _run():
        did = "WS_DEV_CMD"
        ws = FakeWS()
        await manager.register(did, ws)
        dev = RealHardwareDevice(did)
        await dev.set_display("ANALYZING...")
        await dev.send_result({"prediction": "refer", "abstained": False})
        types = [m["message_type"] for m in ws.messages()]
        assert "SET_DISPLAY" in types
        assert "SCREENING_RESULT" in types
        await manager.unregister(did, ws)

    asyncio.run(_run())


def test_device_error_fails_pending_capture():
    async def _run():
        did = "WS_DEV_ERR"
        ws = FakeWS()
        await manager.register(did, ws)

        async def responder():
            for _ in range(200):
                for m in ws.messages():
                    if m["message_type"] == "IMAGE_CAPTURE":
                        await manager.handle_incoming(did, {
                            "message_type": "ERROR",
                            "payload": {"code": "E_CAMERA", "message": "frame grab failed"},
                        })
                        return
                await asyncio.sleep(0.005)

        cap = asyncio.ensure_future(manager.request_capture(did, timeout=2.0))
        await responder()
        with pytest.raises(RuntimeError):
            await cap
        await manager.unregister(did, ws)

    asyncio.run(_run())
