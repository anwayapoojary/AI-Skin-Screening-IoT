from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api import device, ws
from backend.app.api.v1 import (
    dashboard,
    devices,
    health,
    model,
    patients,
    reminders,
    reports,
    screenings,
)
from ai.inference import load_at_startup
from backend.app.config import settings
from backend.app.db.session import init_db

init_db()

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
    description="Health screening device API. Simulation-first. Not a diagnostic medical device.",
    openapi_url="/openapi.json",
    docs_url="/docs",
)

_cors_origins = settings.cors_origin_list
app.add_middleware(
    CORSMiddleware,
    allow_origins=_cors_origins,
    allow_credentials=_cors_origins != ["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

prefix = settings.api_v1_prefix
app.include_router(health.router, prefix=prefix, tags=["health"])
app.include_router(dashboard.router, prefix=f"{prefix}/dashboard", tags=["dashboard"])
app.include_router(patients.router, prefix=f"{prefix}/patients", tags=["patients"])
app.include_router(screenings.router, prefix=f"{prefix}/screenings", tags=["screenings"])
app.include_router(devices.router, prefix=f"{prefix}/devices", tags=["devices"])
app.include_router(reports.router, prefix=f"{prefix}/reports", tags=["reports"])
app.include_router(reminders.router, prefix=f"{prefix}/reminders", tags=["reminders"])
app.include_router(model.router, prefix="/api/model", tags=["model"])
app.include_router(device.router, prefix="/api/device", tags=["device transport"])

# Device WebSocket link (real ESP32-CAM connects here). Mounted at app root
# so the firmware URL is ws://<host>:8000/ws/device, matching .env.
app.include_router(ws.router)


@app.on_event("startup")
def load_configured_model() -> None:
    if settings.ai_mode == "real":
        load_at_startup()


@app.get("/ai/status", tags=["ai"])
@app.get(f"{prefix}/ai/status", tags=["ai"])
def get_ai_status():
    if settings.ai_mode == "mock":
        return {
            "active_model": "Mock model",
            "load_state": "mock",
            "num_classes": 7,
            "classes": ["akiec", "bcc", "bkl", "df", "mel", "nv", "vasc"],
            "model_file_path": None,
            "model_version": "mock-0.1.0",
            "ai_mode": "mock",
            "available": True,
            "error": None,
            "disclaimer": "Screening support only, not a diagnosis. Consult a doctor.",
        }
    from ai.inference import get_status as get_real_status
    st = get_real_status()
    st["ai_mode"] = settings.ai_mode
    return st


from pathlib import Path
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse

frontend_dist = Path(__file__).resolve().parents[2] / "frontend" / "dist"
upload_directory = Path(settings.upload_dir).resolve()
app.mount(
    "/uploads",
    StaticFiles(directory=str(upload_directory), check_dir=False),
    name="uploads",
)
if (frontend_dist / "index.html").exists():
    if (frontend_dist / "assets").exists():
        app.mount("/assets", StaticFiles(directory=str(frontend_dist / "assets")), name="assets")

    @app.get("/{full_path:path}", include_in_schema=False)
    async def serve_spa(full_path: str):
        target = frontend_dist / full_path
        if full_path and target.exists() and target.is_file():
            return FileResponse(target)
        return FileResponse(frontend_dist / "index.html")
