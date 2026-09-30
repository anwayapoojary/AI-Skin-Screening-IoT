"""Real skin-lesion screening model.

Transfer-learning classifier (torchvision backbone) that consumes a captured
image and returns a *screening indication* — never a diagnosis. Multiclass
lesion probabilities are collapsed into a binary screening decision:

    "refer"    -> findings consistent with a suspicious lesion; recommend
                  in-person clinical evaluation
    "routine"  -> no suspicious features detected in this screen
    "abstain"  -> low image quality or low model confidence; recapture / review

Heavy deps (torch, torchvision, Pillow, numpy) are imported lazily. If they are
missing or no trained checkpoint is present, predict() returns an *abstain*
result with an explanatory note instead of crashing the API.
"""

from __future__ import annotations

import logging
import threading
from datetime import datetime, timezone

from ai.screening_model import ScreeningModel, ScreeningPrediction

logger = logging.getLogger(__name__)


def _build_backbone(arch: str, num_classes: int):
    """Create an untrained torchvision backbone with a fresh classifier head."""
    import torch.nn as nn
    import torchvision.models as tvm

    arch = arch.lower()
    if arch == "efficientnet_b0":
        m = tvm.efficientnet_b0(weights=None)
        in_f = m.classifier[1].in_features
        m.classifier[1] = nn.Linear(in_f, num_classes)
    elif arch == "efficientnet_b3":
        m = tvm.efficientnet_b3(weights=None)
        in_f = m.classifier[1].in_features
        m.classifier[1] = nn.Linear(in_f, num_classes)
    elif arch == "mobilenet_v3_large":
        m = tvm.mobilenet_v3_large(weights=None)
        in_f = m.classifier[3].in_features
        m.classifier[3] = nn.Linear(in_f, num_classes)
    elif arch == "resnet50":
        m = tvm.resnet50(weights=None)
        m.fc = nn.Linear(m.fc.in_features, num_classes)
    else:
        raise ValueError(f"Unsupported screening_model_arch: {arch}")
    return m


class RealScreeningModel(ScreeningModel):
    """Loads an evaluated checkpoint and runs inference. Screening only."""

    model_version = "derm-real-unloaded"
    preprocessing_version = "prep-derm-1.0.0"

    def __init__(self) -> None:
        from backend.app.config import settings

        self.settings = settings
        self.class_names = settings.screening_class_list
        self.suspicious = set(settings.screening_suspicious_list)
        self.threshold = float(settings.screening_abstain_threshold)
        self.tta = bool(settings.screening_tta)
        self._model = None
        self._torch = None
        self._device = None
        self._load_error: str | None = None
        self._lock = threading.Lock()
        self._try_load()

    # ------------------------------------------------------------------ load
    def _try_load(self) -> None:
        try:
            import torch

            from ai.preprocessing import PREPROCESSING_VERSION

            self.preprocessing_version = PREPROCESSING_VERSION
            ckpt_path = self.settings.screening_model_path
            self._device = torch.device("cuda" if torch.cuda.is_available() else "cpu")

            import os

            if not os.path.exists(ckpt_path):
                self._load_error = (
                    f"checkpoint not found at '{ckpt_path}'. Train one with "
                    f"scripts/train_skin_model.py or set SCREENING_MODEL_PATH."
                )
                logger.warning("RealScreeningModel: %s", self._load_error)
                return

            ckpt = torch.load(ckpt_path, map_location=self._device)
            # Accept either a raw state_dict or a dict with metadata.
            if isinstance(ckpt, dict) and "state_dict" in ckpt:
                state = ckpt["state_dict"]
                self.class_names = ckpt.get("class_names", self.class_names)
                arch = ckpt.get("arch", self.settings.screening_model_arch)
                self.model_version = ckpt.get("model_version", "derm-real-1.0.0")
                if "suspicious_labels" in ckpt:
                    self.suspicious = set(ckpt["suspicious_labels"])
            else:
                state = ckpt
                arch = self.settings.screening_model_arch
                self.model_version = "derm-real-1.0.0"

            model = _build_backbone(arch, len(self.class_names))
            model.load_state_dict(state)
            model.eval()
            model.to(self._device)
            self._model = model
            self._torch = torch
            logger.info(
                "RealScreeningModel loaded arch=%s classes=%s device=%s",
                arch, self.class_names, self._device,
            )
        except ImportError as exc:
            self._load_error = (
                "ML deps missing (torch/torchvision). Install backend/requirements-ml.txt."
            )
            logger.warning("RealScreeningModel: %s (%s)", self._load_error, exc)
        except Exception as exc:  # pragma: no cover - defensive
            self._load_error = f"failed to load model: {exc}"
            logger.exception("RealScreeningModel load failed")

    @property
    def ready(self) -> bool:
        return self._model is not None

    # --------------------------------------------------------------- predict
    def predict(self, image: bytes, image_quality_status: str = "ok") -> ScreeningPrediction:
        ts = datetime.now(timezone.utc).isoformat()

        if not self.ready:
            return self._abstain(ts, image_quality_status or "unknown",
                                 f"Real model not available: {self._load_error}")

        if not image:
            return self._abstain(ts, "invalid", "Empty image — model abstained.")

        # Server-side quality gate (also catches upstream 'invalid').
        from ai.preprocessing import assess_quality, preprocess_for_model

        if image_quality_status not in ("ok", "", None):
            return self._abstain(ts, image_quality_status, "Upstream flagged low image quality.")

        q = assess_quality(image)
        if q.status != "ok":
            return self._abstain(ts, q.status, f"Image quality gate: {q.reason}.")

        try:
            probs = self._infer(image, preprocess_for_model)
        except Exception as exc:  # pragma: no cover - defensive
            logger.exception("inference failed")
            return self._abstain(ts, "error", f"Inference error: {exc}")

        # Collapse multiclass -> binary screening decision.
        by_label = dict(zip(self.class_names, probs))
        top_label = max(by_label, key=by_label.get)
        top_prob = float(by_label[top_label])
        susp_prob = float(sum(p for lbl, p in by_label.items() if lbl in self.suspicious))
        decision_conf = max(susp_prob, 1.0 - susp_prob)

        top3 = sorted(by_label.items(), key=lambda kv: kv[1], reverse=True)[:3]
        breakdown = ", ".join(f"{lbl}={p:.2f}" for lbl, p in top3)

        if decision_conf < self.threshold:
            return self._abstain(
                ts, "ok",
                f"Confidence {decision_conf:.2f} below threshold {self.threshold:.2f}. "
                f"Top: {breakdown}.",
            )

        if susp_prob >= 0.5:
            prediction = "refer"
            notes = (
                f"Screening suggests features that warrant clinical evaluation "
                f"(suspicious probability {susp_prob:.2f}; top class {top_label} {top_prob:.2f}). "
                f"Breakdown: {breakdown}."
            )
            confidence = susp_prob
        else:
            prediction = "routine"
            notes = (
                f"No suspicious features detected in this screen "
                f"(suspicious probability {susp_prob:.2f}; top class {top_label} {top_prob:.2f}). "
                f"Breakdown: {breakdown}."
            )
            confidence = 1.0 - susp_prob

        return ScreeningPrediction(
            prediction=prediction,
            confidence=round(confidence, 4),
            model_version=self.model_version,
            preprocessing_version=self.preprocessing_version,
            timestamp=ts,
            image_quality_status="ok",
            abstained=False,
            notes=notes,
        )

    # ------------------------------------------------------------- internals
    def _infer(self, image: bytes, preprocess_fn) -> list[float]:
        torch = self._torch
        x = preprocess_fn(image)  # numpy CHW float32
        tensor = torch.from_numpy(x).unsqueeze(0).to(self._device)
        batch = [tensor]
        if self.tta:
            # Horizontal + vertical flips as light test-time augmentation.
            batch.append(torch.flip(tensor, dims=[3]))
            batch.append(torch.flip(tensor, dims=[2]))
        with torch.no_grad(), self._lock:
            logits_sum = None
            for t in batch:
                logits = self._model(t)
                probs = torch.softmax(logits, dim=1)
                logits_sum = probs if logits_sum is None else logits_sum + probs
            mean_probs = (logits_sum / len(batch)).squeeze(0)
        return [float(v) for v in mean_probs.cpu().tolist()]

    def _abstain(self, ts: str, quality: str, note: str) -> ScreeningPrediction:
        return ScreeningPrediction(
            prediction="abstain",
            confidence=0.0,
            model_version=self.model_version,
            preprocessing_version=self.preprocessing_version,
            timestamp=ts,
            image_quality_status=quality,
            abstained=True,
            notes=note,
        )
