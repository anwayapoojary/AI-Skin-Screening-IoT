from __future__ import annotations

import hashlib
import json
import math
from io import BytesIO
from pathlib import Path

from ai.inference import DISCLAIMER, MAX_UPLOAD_BYTES, InferenceError

_LABELS_PATH = Path(__file__).parent / "models" / "labels.json"


class MockScreeningModel:
    """Deterministic development model with the same output shape as real inference."""

    model_name = "Mock model"
    model_version = "mock-0.1.0"

    def __init__(self) -> None:
        with _LABELS_PATH.open("r", encoding="utf-8") as f:
            labels = json.load(f)
        self.classes: list[str] = labels["classes"]
        self.full_names: dict[str, str] = labels["full_names"]

    def predict(self, image_bytes: bytes) -> dict:
        if len(image_bytes) > MAX_UPLOAD_BYTES:
            raise InferenceError(
                f"Image too large ({len(image_bytes)} bytes). Maximum is {MAX_UPLOAD_BYTES} bytes."
            )
        try:
            from PIL import Image, UnidentifiedImageError

            with Image.open(BytesIO(image_bytes)) as image:
                if image.format not in {"JPEG", "PNG"}:
                    raise InferenceError("Upload a JPEG or PNG image.")
                image.verify()
        except InferenceError:
            raise
        except (UnidentifiedImageError, OSError, ValueError) as exc:
            raise InferenceError("Corrupt or non-image file — cannot decode.") from exc

        digest = hashlib.sha256(image_bytes).digest()
        weights = [math.exp((digest[index] / 255.0) * 3.0) for index in range(len(self.classes))]
        total = sum(weights)
        probabilities = {
            label: weight / total for label, weight in zip(self.classes, weights)
        }
        ordered = sorted(probabilities.items(), key=lambda item: item[1], reverse=True)
        top_label, top_probability = ordered[0]
        return {
            "top_label": top_label,
            "top_name": self.full_names[top_label],
            "top3": [
                {
                    "label": label,
                    "name": self.full_names[label],
                    "probability": round(probability, 6),
                }
                for label, probability in ordered[:3]
            ],
            "probabilities": probabilities,
            "model_name": self.model_name,
            "model_version": self.model_version,
            "is_mock": True,
            "uncertain": top_probability < 0.5,
            "disclaimer": DISCLAIMER,
        }
