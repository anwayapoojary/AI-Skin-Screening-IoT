from __future__ import annotations

from pathlib import Path
from typing import Literal

from pydantic import AliasChoices, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", extra="ignore")

    app_name: str = "AI Health Screening Device"
    app_env: str = "development"
    app_secret_key: str = "change-me-in-production"
    api_v1_prefix: str = "/api/v1"
    auth_enabled: bool = False
    auth_issuer: str = "ai-health-screening-device"
    database_url: str = "sqlite:///./data/app.db"
    device_mode: str = "simulation"
    device_transport: Literal["wifi", "usb", "simulated"] = "simulated"
    device_id: str = "DEVICE_001"
    protocol_version: str = "1.0"
    device_token: str = ""  # set in env for device auth on /ws/device
    model_backend: Literal["mock", "real"] = Field(
        default="real",
        validation_alias=AliasChoices("MODEL_BACKEND", "AI_MODE"),
    )

    # Legacy RealScreeningModel settings remain for backwards-compatible imports.
    screening_model_path: str = "./ai/weights/skin_model.pt"
    screening_model_arch: str = "efficientnet_b0"
    screening_class_names: str = "akiec,bcc,bkl,df,mel,nv,vasc"
    screening_suspicious_labels: str = "mel,bcc,akiec"
    screening_abstain_threshold: float = 0.55
    screening_tta: bool = False

    simulator_host: str = "127.0.0.1"
    simulator_port: int = 8090
    upload_dir: str = "./data/uploads"
    max_upload_bytes: int = 10 * 1024 * 1024
    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"
    serial_port: str = "AUTO"
    log_level: str = "INFO"

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def ai_mode(self) -> str:
        """Compatibility for existing clients; MODEL_BACKEND is canonical."""
        return self.model_backend

    @property
    def screening_class_list(self) -> list[str]:
        return [name.strip() for name in self.screening_class_names.split(",") if name.strip()]

    @property
    def screening_suspicious_list(self) -> list[str]:
        return [
            name.strip()
            for name in self.screening_suspicious_labels.split(",")
            if name.strip()
        ]

    def ensure_dirs(self) -> None:
        Path("data").mkdir(parents=True, exist_ok=True)
        Path(self.upload_dir).mkdir(parents=True, exist_ok=True)


settings = Settings()
