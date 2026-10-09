from fastapi import APIRouter, Depends

from backend.app.config import settings
from backend.app.deps import auth_ready, get_gateway

router = APIRouter(dependencies=[Depends(auth_ready)])


@router.get("/health")
def health():
    gw = get_gateway()
    return {
        "status": "ok",
        "app": settings.app_name,
        "env": settings.app_env,
        "device_mode": settings.device_mode,
        "ai_mode": settings.ai_mode,
        "model_backend": settings.model_backend,
        "controller": "ESP32-CAM",
        "hardware_received": False,
        "protocol_version": settings.protocol_version,
        "auth_enabled": settings.auth_enabled,
        "gateway_mode": gw.mode,
        "hardware_confirmed": False,
    }
