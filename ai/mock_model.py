from __future__ import annotations

import hashlib
from datetime import datetime, timezone

from ai.screening_model import ScreeningModel, ScreeningPrediction

MOCK_LABELS = ("finding_a", "finding_b", "unremarkable_screen")


class MockScreeningModel(ScreeningModel):
    """Deterministic mock — not a trained clinical model."""

    model_version = "mock-0.1.0"
    preprocessing_version = "prep-mock-0.1.0"

    def predict(self, image: bytes, image_quality_status: str = "ok") -> ScreeningPrediction:
        ts = datetime.now(timezone.utc).isoformat()
        if image_quality_status != "ok" or not image:
            return ScreeningPrediction(
                prediction="abstain",
                confidence=0.0,
                model_version=self.model_version,
                preprocessing_version=self.preprocessing_version,
                timestamp=ts,
                image_quality_status=image_quality_status if image else "invalid",
                abstained=True,
                notes="Low image quality or empty image — model abstained.",
            )
        digest = hashlib.sha256(image).digest()
        idx = digest[0] % len(MOCK_LABELS)
        confidence = 0.55 + (digest[1] / 255.0) * 0.4
        if confidence < 0.60:
            return ScreeningPrediction(
                prediction="abstain",
                confidence=round(confidence, 4),
                model_version=self.model_version,
                preprocessing_version=self.preprocessing_version,
                timestamp=ts,
                image_quality_status=image_quality_status,
                abstained=True,
                notes="Confidence below abstention threshold.",
            )
        return ScreeningPrediction(
            prediction=MOCK_LABELS[idx],
            confidence=round(confidence, 4),
            model_version=self.model_version,
            preprocessing_version=self.preprocessing_version,
            timestamp=ts,
            image_quality_status=image_quality_status,
            abstained=False,
            notes="Mock model output for development only.",
        )
