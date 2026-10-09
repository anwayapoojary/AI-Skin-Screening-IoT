from pathlib import Path

from fastapi import APIRouter, Depends
from fastapi.responses import FileResponse

from ai.inference import get_model_info, get_model_metadata
from backend.app.config import settings
from backend.app.deps import auth_ready

router = APIRouter(dependencies=[Depends(auth_ready)])


@router.get("/info")
def model_info():
    info = (
        get_model_info()
        if settings.ai_mode == "real"
        else get_model_metadata()
    )
    info["active_backend"] = settings.ai_mode
    if settings.ai_mode == "mock" and "error" not in info:
        info["available"] = True
        info["load_error"] = None
    return info


@router.get("/confusion-matrix.png")
def confusion_matrix():
    path = Path(__file__).resolve().parents[4] / "ai" / "models" / "confusion_matrix.png"
    return FileResponse(path, media_type="image/png", filename="confusion_matrix.png")
