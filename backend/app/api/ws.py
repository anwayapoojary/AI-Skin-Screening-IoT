"""WebSocket endpoint the real ESP32-CAM connects to (protocol v1.0 JSON).

Mounted at ``/ws/device`` (matches GATEWAY_WS_URL in .env). The device connects
out to this endpoint, sends DEVICE_CONNECT, then streams DEVICE_STATUS /
HEARTBEAT and answers IMAGE_CAPTURE commands with IMAGE_TRANSFER.

This module holds no MCU/GPIO code; it only relays protocol envelopes to the
shared ConnectionManager.
"""

from __future__ import annotations

import json
import logging

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect

from backend.app.config import settings
from hardware.device_gateway.connection_manager import manager
from hardware.protocols.constants import MESSAGE_TYPES
from hardware.protocols.schema import make_envelope

logger = logging.getLogger(__name__)

router = APIRouter()

# Maximum payload size accepted over the WebSocket (bytes).
MAX_WS_MESSAGE_BYTES = 2 * 1024 * 1024  # 2 MiB — covers a base64 SVGA JPEG


def _check_device_token(token: str | None) -> bool:
    """Validate the device token.  Returns True if auth passes."""
    expected = settings.device_token
    if not expected:
        return True  # no token configured → open (development)
    return token == expected


@router.websocket("/ws/device")
async def device_socket(
    ws: WebSocket,
    token: str | None = Query(default=None),
) -> None:
    # ── Token auth ──
    if not _check_device_token(token):
        await ws.close(code=4001, reason="invalid or missing device token")
        return

    await ws.accept()
    device_id: str | None = None
    try:
        # First frame must be DEVICE_CONNECT announcing the device_id.
        raw = await ws.receive_text()
        if len(raw) > MAX_WS_MESSAGE_BYTES:
            await ws.send_text(
                make_envelope("unknown", "ERROR",
                              {"code": "E_INVALID_CMD", "message": "message too large"}
                              ).model_dump_json()
            )
            await ws.close()
            return

        hello = json.loads(raw)
        if hello.get("message_type") != "DEVICE_CONNECT" or not hello.get("device_id"):
            await ws.send_text(
                make_envelope("unknown", "ERROR",
                              {"code": "E_INVALID_CMD", "message": "expected DEVICE_CONNECT with device_id"}
                              ).model_dump_json()
            )
            await ws.close()
            return

        device_id = str(hello["device_id"])
        await manager.register(device_id, ws)
        await manager.handle_incoming(device_id, hello)
        # Acknowledge so the firmware can move to READY.
        await ws.send_text(make_envelope(device_id, "ACK", {"of": "DEVICE_CONNECT"}).model_dump_json())

        while True:
            raw = await ws.receive_text()
            if len(raw) > MAX_WS_MESSAGE_BYTES:
                await ws.send_text(
                    make_envelope(device_id, "ERROR",
                                  {"code": "E_INVALID_CMD", "message": "message too large"}).model_dump_json()
                )
                continue
            try:
                env = json.loads(raw)
            except json.JSONDecodeError:
                await ws.send_text(
                    make_envelope(device_id, "ERROR",
                                  {"code": "E_INVALID_CMD", "message": "malformed JSON"}).model_dump_json()
                )
                continue
            if env.get("message_type") not in MESSAGE_TYPES:
                await ws.send_text(
                    make_envelope(device_id, "ERROR",
                                  {"code": "E_INVALID_CMD", "message": "unknown message_type"}).model_dump_json()
                )
                continue
            await manager.handle_incoming(device_id, env)

    except WebSocketDisconnect:
        logger.info("device websocket closed: %s", device_id)
    except Exception:  # pragma: no cover - defensive
        logger.exception("device websocket error (%s)", device_id)
    finally:
        if device_id:
            await manager.unregister(device_id, ws)
