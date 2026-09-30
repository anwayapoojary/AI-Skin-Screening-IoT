from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api import ws
from backend.app.api.v1 import devices, health, patients, reminders, reports, screenings
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origin_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

prefix = settings.api_v1_prefix
app.include_router(health.router, prefix=prefix, tags=["health"])
app.include_router(patients.router, prefix=f"{prefix}/patients", tags=["patients"])
app.include_router(screenings.router, prefix=f"{prefix}/screenings", tags=["screenings"])
app.include_router(devices.router, prefix=f"{prefix}/devices", tags=["devices"])
app.include_router(reports.router, prefix=f"{prefix}/reports", tags=["reports"])
app.include_router(reminders.router, prefix=f"{prefix}/reminders", tags=["reminders"])

# Device WebSocket link (real ESP32-CAM connects here). Mounted at app root
# so the firmware URL is ws://<host>:8000/ws/device, matching .env.
app.include_router(ws.router)
