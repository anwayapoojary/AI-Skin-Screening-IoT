from __future__ import annotations

from pathlib import Path
from uuid import uuid4
from io import BytesIO

from ai.inference import MAX_UPLOAD_BYTES
from backend.app.config import settings
from PIL import Image, UnidentifiedImageError

ALLOWED_MIME = {"image/png": ".png", "image/jpeg": ".jpg"}
FORMAT_MIME = {"PNG": "image/png", "JPEG": "image/jpeg"}


def validate_image_bytes(data: bytes, mime_hint: str | None = None) -> tuple[str, str]:
    if not data:
        return "invalid", "empty"
    if len(data) > MAX_UPLOAD_BYTES:
        return "too_large", "too_large"
    try:
        with Image.open(BytesIO(data)) as image:
            mime = FORMAT_MIME.get(image.format or "")
            image.verify()
        if mime is None:
            return "invalid", "unsupported"
        if mime_hint and mime_hint != mime:
            return "invalid", "unsupported"
        return "ok", mime
    except (UnidentifiedImageError, OSError, ValueError, Image.DecompressionBombError):
        return "invalid", "unsupported"


def save_image(data: bytes, mime: str) -> str:
    ext = ALLOWED_MIME.get(mime, ".bin")
    name = f"{uuid4().hex}{ext}"
    dest = Path(settings.upload_dir) / name
    dest.write_bytes(data)
    return str(dest.as_posix())
