"""Real skin-lesion inference engine using the TorchScript model.

Loads ai/models/model.pt once at startup via torch.jit.load (CPU, eval,
torch.no_grad).  Pre-processes exactly per ai/models/preprocess.json.
Returns a dict that is interface-compatible with the mock so the backend
switches by config only.

Uncertain rule: top probability < 0.5 → uncertain=True.
model_version: short SHA-256 of model.pt + model name from metrics.json.
"""

from __future__ import annotations

import hashlib
import os
import json
import logging
import re
import threading
from io import BytesIO
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def _resolve_models_dir() -> Path:
    env_dir = os.environ.get("MODEL_DIR")
    if env_dir:
        return Path(env_dir).resolve()
    try:
        from backend.app.config import settings
        return Path(settings.model_dir).resolve()
    except Exception:
        return (Path(__file__).parent / "models").resolve()


# Paths — resolved relative to configured model directory.
_MODELS_DIR = _resolve_models_dir()
_MODEL_PATH = _MODELS_DIR / "model.pt"
_LABELS_PATH = _MODELS_DIR / "labels.json"
_PREPROCESS_PATH = _MODELS_DIR / "preprocess.json"
_METRICS_PATH = _MODELS_DIR / "metrics.json"

MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB

DISCLAIMER = (
    "Screening support only, not a diagnosis. "
    "Consult a doctor."
)


class InferenceError(ValueError):
    """Raised for rejected inputs (4xx-worthy)."""


class ModelUnavailableError(RuntimeError):
    """Raised when the configured real model could not be loaded."""


def _model_file_hash() -> str:
    digest = hashlib.sha256()
    with _MODEL_PATH.open("rb") as model_file:
        for chunk in iter(lambda: model_file.read(65536), b""):
            digest.update(chunk)
    return digest.hexdigest()


class _RealInferenceEngine:
    """Singleton that loads the TorchScript model once and handles predictions."""

    def __init__(self) -> None:
        self._model: Any = None
        self._torch: Any = None
        self._lock = threading.Lock()
        self._load_error: str | None = None

        # Load config files (always required).
        try:
            with open(_LABELS_PATH, "r", encoding="utf-8") as f:
                labels_data = json.load(f)
            self._index_to_label: dict[int, str] = {
                int(k): v for k, v in labels_data["index_to_label"].items()
            }
            self._full_names: dict[str, str] = labels_data["full_names"]
            self._classes = [
                self._index_to_label[index]
                for index in range(len(self._index_to_label))
            ]
            if self._classes != labels_data["classes"]:
                raise ValueError("labels.json class order and index mapping do not match")

            with open(_PREPROCESS_PATH, "r", encoding="utf-8") as f:
                prep = json.load(f)
            self._input_size: tuple[int, int] = tuple(prep["input_size"])
            self._mean: list[float] = prep["mean"]
            self._std: list[float] = prep["std"]
            self._color: str = prep["color"]
            self._resize: str = prep["resize"]
            scale_match = re.search(r"divide by (\d+)", prep["scale"])
            if not scale_match:
                raise ValueError("preprocess.json scale must specify its divisor")
            self._scale_divisor = float(scale_match.group(1))
            if len(self._input_size) != 2 or len(self._mean) != 3 or len(self._std) != 3:
                raise ValueError("preprocess.json has invalid input dimensions or normalization")
            if self._color != "RGB" or "BILINEAR" not in self._resize.upper():
                raise ValueError("Only the configured RGB/BILINEAR preprocessing is supported")

            with open(_METRICS_PATH, "r", encoding="utf-8") as f:
                metrics = json.load(f)
            self._model_name: str = metrics["model"]

        except Exception as exc:
            self._load_error = f"Failed to load model config files: {exc}"
            logger.error("inference.py: %s", self._load_error)
            return

        # Derive model_version from file hash + model name.
        try:
            file_hash = self._hash_model_file()
            self._model_version: str = f"{file_hash[:8]}-{self._model_name.split()[0]}"
        except Exception as exc:
            self._model_version = "unknown-version"
            logger.warning("Could not compute model hash: %s", exc)

        # Load TorchScript model.
        self._try_load()

    def _hash_model_file(self) -> str:
        return _model_file_hash()

    def _try_load(self) -> None:
        try:
            import torch

            self._torch = torch
            model = torch.jit.load(str(_MODEL_PATH), map_location=torch.device("cpu"))
            model.eval()
            self._model = model
            logger.info(
                "inference.py: TorchScript model loaded — version=%s classes=%s",
                self._model_version,
                self._classes,
            )
        except ImportError as exc:
            self._load_error = (
                "torch not installed. Run: pip install -r backend/requirements-ml.txt"
            )
            logger.warning("inference.py: %s (%s)", self._load_error, exc)
        except Exception as exc:
            self._load_error = f"Failed to load model.pt: {exc}"
            logger.error("inference.py load failed: %s", exc)

    @property
    def ready(self) -> bool:
        return self._model is not None and self._load_error is None

    @property
    def load_error(self) -> str | None:
        return self._load_error

    def _preprocess(self, image_bytes: bytes):
        """Pre-process exactly per preprocess.json.

        RGB → resize to 224×224 PIL BILINEAR (no crop, aspect not preserved) →
        divide by 255 → normalize mean/std → CHW float32 → batch of 1.
        """
        import numpy as np
        from PIL import Image as PilImage

        with PilImage.open(BytesIO(image_bytes)) as im:
            im = im.convert(self._color)
            w, h = self._input_size  # (224, 224)
            im = im.resize((w, h), PilImage.Resampling.BILINEAR)
            x = np.asarray(im, dtype="float32") / self._scale_divisor

        mean = np.array(self._mean, dtype="float32")
        std = np.array(self._std, dtype="float32")
        x = (x - mean) / std          # HWC, normalised
        x = x.transpose(2, 0, 1)      # CHW
        x = np.ascontiguousarray(x, dtype="float32")

        torch = self._torch
        tensor = torch.from_numpy(x).unsqueeze(0)  # (1, 3, 224, 224)
        return tensor

    def predict(self, image_bytes: bytes) -> dict:
        """Run inference and return the result dict.

        Raises InferenceError for invalid/corrupt/oversized inputs.
        """
        # Size gate (10 MB).
        if len(image_bytes) > MAX_UPLOAD_BYTES:
            raise InferenceError(
                f"Image too large ({len(image_bytes)} bytes). Maximum is {MAX_UPLOAD_BYTES} bytes."
            )

        # Basic image decode check.
        try:
            from PIL import Image as PilImage, UnidentifiedImageError

            with PilImage.open(BytesIO(image_bytes)) as im:
                if im.format is None:
                    raise InferenceError("Unrecognised image format.")
                im.verify()
        except InferenceError:
            raise
        except Exception:
            raise InferenceError("Corrupt or non-image file — cannot decode.")

        if not self.ready:
            raise ModelUnavailableError(
                f"Real model is not available: {self._load_error or 'unknown error'}"
            )

        # Preprocess.
        try:
            tensor = self._preprocess(image_bytes)
        except Exception as exc:
            raise InferenceError(f"Preprocessing failed: {exc}") from exc

        # Inference.
        with self._lock:
            try:
                with self._torch.no_grad():
                    logits = self._model(tensor)
                    if tuple(logits.shape) != (1, len(self._classes)):
                        raise RuntimeError(
                            "Model returned output shape "
                            f"{tuple(logits.shape)}; expected (1, {len(self._classes)})."
                        )
                    probs_tensor = self._torch.softmax(logits, dim=1).squeeze(0)
                probs: list[float] = [float(v) for v in probs_tensor.cpu().tolist()]
            except Exception as exc:
                raise InferenceError(f"Inference failed: {exc}") from exc

        # Build label→probability mapping.
        n = len(self._classes)
        by_label = {self._classes[i]: probs[i] for i in range(min(n, len(probs)))}

        # Top class.
        top_label = max(by_label, key=by_label.get)  # type: ignore[arg-type]
        top_prob = float(by_label[top_label])

        # Top-3 list.
        sorted_items = sorted(by_label.items(), key=lambda kv: kv[1], reverse=True)
        top3 = [
            {
                "label": lbl,
                "name": self._full_names.get(lbl, lbl),
                "probability": round(prob, 6),
            }
            for lbl, prob in sorted_items[:3]
        ]

        # Uncertain rule: top probability < 0.5.
        uncertain = top_prob < 0.5

        return {
            "top_label": top_label,
            "top_name": self._full_names.get(top_label, top_label),
            "top3": top3,
            "probabilities": by_label,
            "model_name": "EfficientNet-B0 / HAM10000",
            "model_version": self._model_version,
            "is_mock": False,
            "uncertain": uncertain,
            "disclaimer": DISCLAIMER,
        }

    def model_info(self) -> dict:
        """Return artifact metadata and the runtime load state."""
        info = _read_model_metadata()
        info["available"] = self.ready
        info["load_error"] = self._load_error
        return info


# Module-level singleton — loaded once at import time.
_engine: _RealInferenceEngine | None = None
_engine_lock = threading.Lock()


def _get_engine() -> _RealInferenceEngine:
    global _engine
    if _engine is None:
        with _engine_lock:
            if _engine is None:
                _engine = _RealInferenceEngine()
    return _engine


def predict(image_bytes: bytes) -> dict:
    """Public API: run inference on raw image bytes.

    Returns: {top_label, top_name, top3, probabilities, model_version,
               is_mock, uncertain, disclaimer}
    Raises InferenceError for invalid inputs.
    """
    return _get_engine().predict(image_bytes)


def get_model_info() -> dict:
    """Return model metadata from metrics.json + model_card.md."""
    return _get_engine().model_info()


def get_model_metadata() -> dict:
    """Read model-card and metric files without loading PyTorch."""
    return _read_model_metadata()


def _read_model_metadata() -> dict:
    try:
        with _LABELS_PATH.open("r", encoding="utf-8") as f:
            labels_data = json.load(f)
        with _METRICS_PATH.open("r", encoding="utf-8") as f:
            metrics = json.load(f)
    except (OSError, json.JSONDecodeError, KeyError) as exc:
        return {"available": False, "error": f"Unable to read model metadata: {exc}"}

    classes = labels_data["classes"]
    full_names = labels_data["full_names"]
    per_class = metrics["per_class"]
    class_metrics = [
        {
            "label": label,
            "name": full_names[label],
            "recall": per_class[label]["recall"],
            "f1": per_class[label]["f1-score"],
            "support": per_class[label]["support"],
        }
        for label in classes
        if label in per_class
    ]

    limitations = []
    card_path = _MODELS_DIR / "model_card.md"
    try:
        card_text = card_path.read_text(encoding="utf-8")
    except OSError as exc:
        return {"available": False, "error": f"Unable to read model_card.md: {exc}"}
    in_limitations = False
    for line in card_text.splitlines():
        stripped = line.strip()
        if stripped == "## Limitations":
            in_limitations = True
            continue
        if in_limitations and stripped.startswith("##"):
            break
        if in_limitations and stripped.startswith("- "):
            limitations.append(stripped[2:].strip())

    try:
        model_version = f"{_model_file_hash()[:8]}-{metrics['model'].split()[0]}"
    except (OSError, KeyError, IndexError):
        model_version = None

    return {
        "model_name": "EfficientNet-B0 / HAM10000",
        "raw_model_name": metrics["model"],
        "model_version": model_version,
        "architecture": metrics["model"],
        "classes": classes,
        "class_names": full_names,
        "split": metrics["split"],
        "split_method": metrics["split"],
        "n_train": metrics["n_train"],
        "n_val": metrics["n_val"],
        "n_test": metrics["n_test"],
        "test_macro_f1": metrics["test_macro_f1"],
        "test_accuracy": metrics["test_accuracy"],
        "per_class": class_metrics,
        "limitations": limitations,
        "training_dataset": "HAM10000 (dermoscopic images, 7 classes, 10015 images)",
        "not_validated_on": "ESP32-CAM device images — domain shift expected",
        "confusion_matrix_url": "/api/model/confusion-matrix.png",
    }


def is_available() -> bool:
    """True if the TorchScript model loaded successfully."""
    return _get_engine().ready


def load_at_startup() -> None:
    """Initialize the singleton early while allowing the API to start on failure."""
    _get_engine()


def get_status() -> dict:
    """Return model runtime status including active model, load state, num classes, and path."""
    engine = _get_engine()
    return {
        "active_model": "EfficientNet-B0 / HAM10000" if engine.ready else "Real model unavailable",
        "load_state": "ready" if engine.ready else ("failed" if engine.load_error else "unloaded"),
        "num_classes": len(engine._classes) if engine._classes else 0,
        "classes": engine._classes,
        "model_file_path": str(_MODEL_PATH.resolve()),
        "model_version": engine._model_version,
        "available": engine.ready,
        "error": engine.load_error,
        "disclaimer": DISCLAIMER,
    }
