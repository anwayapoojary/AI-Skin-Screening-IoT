"""Image preprocessing and quality assessment for skin-lesion screening.

Heavy dependencies (Pillow, numpy, torch) are imported lazily so the base
FastAPI app and the mock model keep working without the ML extras installed.
Install the ML stack with:  pip install -r backend/requirements-ml.txt
"""

from __future__ import annotations

from dataclasses import dataclass
from io import BytesIO
from typing import TYPE_CHECKING

if TYPE_CHECKING:  # pragma: no cover - typing only
    import numpy as np


# ImageNet normalisation — matches the torchvision pretrained backbones used
# by the training script and RealScreeningModel.
IMAGENET_MEAN = (0.485, 0.456, 0.406)
IMAGENET_STD = (0.229, 0.224, 0.225)

# Default input side for the classifier (EfficientNet-B0 style).
DEFAULT_INPUT_SIZE = 224

PREPROCESSING_VERSION = "prep-derm-1.0.0"


class PreprocessingUnavailable(RuntimeError):
    """Raised when Pillow/numpy are not installed."""


@dataclass
class QualityReport:
    status: str          # "ok" | "low_quality" | "invalid"
    reason: str          # human-readable explanation
    blur_score: float | None = None      # variance of Laplacian; higher = sharper
    brightness: float | None = None      # mean luminance 0-255
    width: int | None = None
    height: int | None = None


def _require_libs():
    try:
        import numpy as np  # noqa: F401
        from PIL import Image  # noqa: F401
    except Exception as exc:  # pragma: no cover - depends on environment
        raise PreprocessingUnavailable(
            "Image ML extras not installed. Run: pip install -r backend/requirements-ml.txt"
        ) from exc
    return np, Image


def load_rgb(image_bytes: bytes):
    """Decode arbitrary image bytes to an RGB numpy array (H, W, 3) uint8."""
    np, Image = _require_libs()
    with Image.open(BytesIO(image_bytes)) as im:
        im = im.convert("RGB")
        arr = np.asarray(im, dtype="uint8")
    return arr


def _laplacian_variance(gray) -> float:
    """Focus measure: variance of a 3x3 Laplacian convolution (no OpenCV needed)."""
    np, _ = _require_libs()
    k = np.array([[0, 1, 0], [1, -4, 1], [0, 1, 0]], dtype="float32")
    g = gray.astype("float32")
    # Manual 'valid' 2D convolution via shifted sums (small kernel, fine for our sizes).
    out = (
        k[0, 1] * g[:-2, 1:-1]
        + k[1, 0] * g[1:-1, :-2]
        + k[1, 1] * g[1:-1, 1:-1]
        + k[1, 2] * g[1:-1, 2:]
        + k[2, 1] * g[2:, 1:-1]
    )
    return float(out.var())


def assess_quality(
    image_bytes: bytes,
    *,
    min_side: int = 96,
    min_blur: float = 12.0,
    dark_thresh: float = 25.0,
    bright_thresh: float = 235.0,
) -> QualityReport:
    """Cheap heuristic gate before the model. Never a medical judgement.

    Returns status "invalid" for undecodable/empty input, "low_quality" when
    the image is too small, too blurry, or badly exposed, else "ok".
    """
    if not image_bytes:
        return QualityReport(status="invalid", reason="empty image")
    try:
        np, _ = _require_libs()
        arr = load_rgb(image_bytes)
    except PreprocessingUnavailable:
        # Without the ML libs we cannot assess; treat as ok and let magic-byte
        # validation in services/images.py do the basic gate.
        return QualityReport(status="ok", reason="quality checks skipped (ML libs absent)")
    except Exception:
        return QualityReport(status="invalid", reason="undecodable image")

    h, w = arr.shape[:2]
    if min(h, w) < min_side:
        return QualityReport(status="low_quality", reason=f"resolution {w}x{h} below {min_side}px", width=w, height=h)

    gray = arr.mean(axis=2)
    brightness = float(gray.mean())
    blur = _laplacian_variance(gray)

    if brightness < dark_thresh:
        return QualityReport(status="low_quality", reason="image too dark", blur_score=blur, brightness=brightness, width=w, height=h)
    if brightness > bright_thresh:
        return QualityReport(status="low_quality", reason="image overexposed / washed out", blur_score=blur, brightness=brightness, width=w, height=h)
    if blur < min_blur:
        return QualityReport(status="low_quality", reason="image out of focus", blur_score=blur, brightness=brightness, width=w, height=h)

    return QualityReport(status="ok", reason="ok", blur_score=blur, brightness=brightness, width=w, height=h)


def shades_of_gray(arr, power: int = 6, eps: float = 1e-6):
    """Shades-of-Gray colour constancy (Finlayson & Trezzi).

    Normalises illumination colour, which measurably improves dermoscopic /
    skin-lesion classification robustness across cameras and lighting.
    Input/output: uint8 RGB (H, W, 3).
    """
    np, _ = _require_libs()
    x = arr.astype("float32")
    # Per-channel Minkowski (p-norm) illuminant estimate.
    illum = np.power(np.power(x, power).mean(axis=(0, 1)) + eps, 1.0 / power)
    gray = illum.mean()
    scale = gray / (illum + eps)
    out = np.clip(x * scale, 0, 255).astype("uint8")
    return out


def preprocess_for_model(
    image_bytes: bytes,
    *,
    size: int = DEFAULT_INPUT_SIZE,
    color_constancy: bool = True,
):
    """Full preprocessing -> float32 CHW tensor-ready numpy array, ImageNet-normalised.

    Returns a numpy array of shape (3, size, size). Convert to a torch tensor
    at the call site to avoid importing torch here.
    """
    np, Image = _require_libs()
    arr = load_rgb(image_bytes)
    if color_constancy:
        arr = shades_of_gray(arr)

    # Resize with Pillow (high-quality) then center square is already square-resized.
    im = Image.fromarray(arr).resize((size, size), Image.BILINEAR)
    x = np.asarray(im, dtype="float32") / 255.0

    mean = np.array(IMAGENET_MEAN, dtype="float32")
    std = np.array(IMAGENET_STD, dtype="float32")
    x = (x - mean) / std
    x = x.transpose(2, 0, 1)  # HWC -> CHW
    return np.ascontiguousarray(x, dtype="float32")
