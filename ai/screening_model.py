from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import datetime, timezone


@dataclass
class ScreeningPrediction:
    prediction: str
    confidence: float
    model_version: str
    preprocessing_version: str
    timestamp: str
    image_quality_status: str
    abstained: bool
    notes: str

    def as_dict(self) -> dict:
        return {
            "prediction": self.prediction,
            "confidence": self.confidence,
            "model_version": self.model_version,
            "preprocessing_version": self.preprocessing_version,
            "timestamp": self.timestamp,
            "image_quality_status": self.image_quality_status,
            "abstained": self.abstained,
            "notes": self.notes,
            "disclaimer": (
                "Screening indication only. Not a confirmed medical diagnosis or certificate."
            ),
        }


class ScreeningModel(ABC):
    @abstractmethod
    def predict(self, image: bytes, image_quality_status: str = "ok") -> ScreeningPrediction: ...
