from __future__ import annotations

from pathlib import Path

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
    device_id: str = "DEVICE_001"
    protocol_version: str = "1.0"
    device_token: str = ""  # set in env for device auth on /ws/device
    ai_mode: str = "mock"

    # Real skin-lesion model (used only when ai_mode == "real").
    # Point screening_model_path at a checkpoint produced by scripts/train_skin_model.py.
    screening_model_path: str = "./ai/weights/skin_model.pt"
    screening_model_arch: str = "efficientnet_b0"
    # Comma-separated class names in the exact order the model was trained on.
    screening_class_names: str = "akiec,bcc,bkl,df,mel,nv,vasc"
    # Which of those classes should be treated as "refer / suspicious".
    screening_suspicious_labels: str = "mel,bcc,akiec"
    screening_abstain_threshold: float = 0.55
    screening_tta: bool = False

    simulator_host: str = "127.0.0.1"
    simulator_port: int = 8090
    upload_dir: str = "./data/uploads"
    max_upload_bytes: int = 10 * 1024 * 1024
    cors_origins: str = "*"
    serial_port: str = "AUTO"
    log_level: str = "INFO"

    @property
    def cors_origin_list(self) -> list[str]:
        if self.cors_origins.strip() == "*":
            return ["*"]
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def screening_class_list(self) -> list[str]:
        return [c.strip() for c in self.screening_class_names.split(",") if c.strip()]

    @property
    def screening_suspicious_list(self) -> list[str]:
        return [c.strip() for c in self.screening_suspicious_labels.split(",") if c.strip()]

    def ensure_dirs(self) -> None:
        Path("data").mkdir(parents=True, exist_ok=True)
        Path(self.upload_dir).mkdir(parents=True, exist_ok=True)


settings = Settings()
