from __future__ import annotations

from pathlib import Path
from uuid import uuid4

from backend.app.config import settings

ALLOWED_MIME = {"image/png": ".png", "image/jpeg": ".jpg"}
PNG_MAGIC = b"\x89PNG\r\n\x1a\n"
JPEG_MAGIC = b"\xff\xd8\xff"


def validate_image_bytes(data: bytes, mime_hint: str | None = None) -> tuple[str, str]:
    if not data:
        return "invalid", "empty"
    if len(data) > settings.max_upload_bytes:
        return "invalid", "too_large"
    if data.startswith(PNG_MAGIC):
        return "ok", "image/png"
    if data.startswith(JPEG_MAGIC):
        return "ok", "image/jpeg"
    if mime_hint in ALLOWED_MIME and len(data) > 32:
        return "ok", mime_hint
    return "invalid", "unsupported"


def save_image(data: bytes, mime: str) -> str:
    ext = ALLOWED_MIME.get(mime, ".bin")
    name = f"{uuid4().hex}{ext}"
    dest = Path(settings.upload_dir) / name
    dest.write_bytes(data)
    return str(dest.as_posix())
