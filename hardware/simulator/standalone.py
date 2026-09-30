"""Optional standalone WebSocket simulator — same protocol as in-process device.

Transport is a development convenience. Physical radio/USB is UNKNOWN until hardware confirmation.
"""

from __future__ import annotations

import asyncio
import json
import logging

from hardware.protocols.schema import DeviceEnvelope, make_envelope
from hardware.simulator.simulated_device import SimulatedDevice

logger = logging.getLogger(__name__)


async def handle_client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter, device: SimulatedDevice) -> None:
    """Newline-delimited JSON (debug TCP). Prefer in-process SimulatedDevice for the app."""
    try:
        while True:
            line = await reader.readline()
            if not line:
                break
            envelope = DeviceEnvelope.model_validate_json(line)
            reply = await _dispatch(device, envelope)
            writer.write((reply.model_dump_json() + "\n").encode())
            await writer.drain()
    finally:
        writer.close()
        await writer.wait_closed()


async def _dispatch(device: SimulatedDevice, msg: DeviceEnvelope) -> DeviceEnvelope:
    if msg.message_type == "DEVICE_CONNECT":
        await device.connect()
        st = await device.get_status()
        return make_envelope(device.device_id, "DEVICE_STATUS", {"state": st.state})
    if msg.message_type == "IMAGE_CAPTURE":
        img = await device.capture_image()
        return make_envelope(
            device.device_id,
            "IMAGE_TRANSFER",
            {"mime_type": img.mime_type, "size": len(img.content)},
        )
    if msg.message_type == "SENSOR_DATA":
        samples = await device.read_sensors()
        return make_envelope(
            device.device_id,
            "SENSOR_DATA",
            {"readings": [{"name": s.name, "status": s.status} for s in samples]},
        )
    return make_envelope(device.device_id, "ERROR", {"code": "E_INVALID_CMD", "message": msg.message_type})


async def run_tcp_simulator(host: str = "127.0.0.1", port: int = 8090) -> None:
    device = SimulatedDevice()
    await device.connect()

    async def _client(r: asyncio.StreamReader, w: asyncio.StreamWriter) -> None:
        await handle_client(r, w, device)

    server = await asyncio.start_server(_client, host, port)
    logger.info("TCP protocol simulator on %s:%s (development only)", host, port)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    asyncio.run(run_tcp_simulator())
