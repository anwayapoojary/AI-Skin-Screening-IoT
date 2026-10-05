from functools import lru_cache

from fastapi import Header, HTTPException

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
        from ai.real_model import RealScreeningModel

        return RealScreeningModel()
    return MockScreeningModel()


def auth_ready(authorization: str | None = Header(default=None)) -> None:
    if not settings.auth_enabled:
        return
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="Authentication required")
