import json
import threading
from io import BytesIO
from pathlib import Path

import numpy as np
import pytest
import torch
from PIL import Image

from ai import inference


def _png_bytes() -> bytes:
    buffer = BytesIO()
    Image.new("RGB", (80, 48), color=(128, 92, 70)).save(buffer, format="PNG")
    return buffer.getvalue()


def test_torchscript_model_loads_and_returns_seven_probabilities():
    inference.load_at_startup()
    engine = inference._get_engine()
    assert engine.ready, engine.load_error
    assert engine._model.training is False
    assert next(engine._model.parameters()).device.type == "cpu"
    input_tensor = engine._preprocess(_png_bytes())
    assert tuple(input_tensor.shape) == (1, 3, 224, 224)
    assert input_tensor.dtype == torch.float32
    with torch.no_grad():
        model_output = engine._model(input_tensor)
    assert tuple(model_output.shape) == (1, 7)
    result = inference.predict(_png_bytes())
    assert len(result["probabilities"]) == 7
    assert sum(result["probabilities"].values()) == pytest.approx(1.0)
    assert len(result["top3"]) == 3
    assert result["is_mock"] is False
    assert result["disclaimer"] == "Screening support only, not a diagnosis. Consult a doctor."


def test_preprocessing_matches_json_rgb_resize_and_normalization():
    import json

    prep = json.loads(
        (Path(__file__).resolve().parents[1] / "ai" / "models" / "preprocess.json")
        .read_text(encoding="utf-8")
    )
    image_bytes = _png_bytes()
    with Image.open(BytesIO(image_bytes)) as image:
        rgb = image.convert(prep["color"])
        resized = rgb.resize(tuple(prep["input_size"]), Image.Resampling.BILINEAR)
        pixels = np.asarray(resized, dtype=np.float32) / 255.0
    expected = ((pixels - np.asarray(prep["mean"], dtype=np.float32)) /
                np.asarray(prep["std"], dtype=np.float32)).transpose(2, 0, 1)
    expected_tensor = torch.from_numpy(np.ascontiguousarray(expected)).unsqueeze(0)
    actual = inference._get_engine()._preprocess(image_bytes)
    torch.testing.assert_close(actual, expected_tensor)


def test_config_selects_mock_or_real_interface(monkeypatch):
    from ai.mock_model import MockScreeningModel
    from backend.app import deps
    from backend.app.config import settings

    try:
        monkeypatch.setattr(settings, "ai_mode", "mock")
        deps.get_model.cache_clear()
        assert isinstance(deps.get_model(), MockScreeningModel)

        monkeypatch.setattr(settings, "ai_mode", "real")
        deps.get_model.cache_clear()
        assert deps.get_model() is inference
    finally:
        deps.get_model.cache_clear()


def test_corrupt_and_oversized_images_are_rejected():
    with pytest.raises(inference.InferenceError, match="Corrupt or non-image"):
        inference.predict(b"not an image")
    with pytest.raises(inference.InferenceError, match="Image too large"):
        inference.predict(b"x" * (inference.MAX_UPLOAD_BYTES + 1))


@pytest.mark.parametrize(
    ("class_probabilities", "expected_uncertain"),
    [
        ([0.5, 0.5, 0, 0, 0, 0, 0], False),
        ([0.49, 0.085, 0.085, 0.085, 0.085, 0.085, 0.085], True),
    ],
)
def test_uncertain_threshold_boundary(monkeypatch, class_probabilities, expected_uncertain):
    labels = json.loads((inference._MODELS_DIR / "labels.json").read_text(encoding="utf-8"))
    engine = inference._RealInferenceEngine.__new__(inference._RealInferenceEngine)
    engine._torch = torch
    engine._model = lambda _tensor: torch.log(
        torch.tensor(class_probabilities, dtype=torch.float32).clamp_min(1e-30)
    ).unsqueeze(0)
    engine._lock = threading.Lock()
    engine._load_error = None
    engine._classes = labels["classes"]
    engine._full_names = labels["full_names"]
    engine._model_version = "boundary-test"
    engine._preprocess = lambda _image: torch.zeros((1, 3, 224, 224))
    monkeypatch.setattr(inference, "_get_engine", lambda: engine)

    result = inference.predict(_png_bytes())
    assert result["uncertain"] is expected_uncertain


def test_ai_status_and_model_metadata(monkeypatch):
    from fastapi.testclient import TestClient
    from backend.app.main import app
    from backend.app.config import settings

    status = inference.get_status()
    assert status["active_model"] == "EfficientNet-B0 / HAM10000"
    assert status["load_state"] == "ready"
    assert status["num_classes"] == 7
    assert len(status["classes"]) == 7
    assert "model.pt" in status["model_file_path"]
    assert status["available"] is True
    assert status["error"] is None

    # Test /ai/status via TestClient
    with TestClient(app) as client:
        resp = client.get("/ai/status")
        assert resp.status_code == 200
        data = resp.json()
        assert data["num_classes"] == 7
        assert "disclaimer" in data

