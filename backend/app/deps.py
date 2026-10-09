from functools import lru_cache

from fastapi import Header, HTTPException, Query

from ai.mock_model import MockScreeningModel
from backend.app.config import settings
from hardware.device_gateway.gateway import DeviceGateway


@lru_cache
def get_gateway() -> DeviceGateway:
    return DeviceGateway(
        mode=settings.device_mode,
        device_id=settings.device_id,
        port=getattr(settings, "serial_port", "AUTO"),
    )


@lru_cache
def get_model():
    if settings.ai_mode == "real":
        from ai import inference

        return inference
    return MockScreeningModel()


def auth_ready(authorization: str | None = Header(default=None)) -> None:
    if not settings.auth_enabled:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")


def device_token_ok(token: str | None) -> bool:
    expected = settings.device_token
    if not expected:
        return True
    return token == expected


def require_device_token(
    authorization: str | None = Header(default=None),
    x_device_token: str | None = Header(default=None, alias="X-Device-Token"),
    token: str | None = Query(default=None),
) -> None:
    provided = token or x_device_token
    if authorization and authorization.startswith("Bearer "):
        provided = provided or authorization.removeprefix("Bearer ").strip()
    if not device_token_ok(provided):
        raise HTTPException(status_code=401, detail="Invalid or missing device token")
