"""Tests for the skin-lesion preprocessing + quality gate, and the RealScreeningModel
graceful-fallback behaviour. These skip cleanly if the ML extras aren't installed."""

import importlib

import pytest

np = pytest.importorskip("numpy")
Image = None
try:
    from PIL import Image  # noqa: F811
except Exception:  # pragma: no cover
    Image = None

pytestmark = pytest.mark.skipif(Image is None, reason="Pillow not installed")


def _png_bytes(w=160, h=160, color=(180, 120, 100), noise=True):
    from io import BytesIO
    arr = np.zeros((h, w, 3), dtype="uint8")
    arr[:, :] = color
    if noise:
        rng = np.random.default_rng(0)
        arr = np.clip(arr.astype("int16") + rng.integers(-40, 40, arr.shape), 0, 255).astype("uint8")
    im = Image.fromarray(arr)
    buf = BytesIO()
    im.save(buf, format="PNG")
    return buf.getvalue()


def test_quality_ok_for_textured_image():
    from ai.preprocessing import assess_quality
    q = assess_quality(_png_bytes())
    assert q.status == "ok", q.reason


def test_quality_flags_tiny_image():
    from ai.preprocessing import assess_quality
    q = assess_quality(_png_bytes(w=40, h=40))
    assert q.status == "low_quality"


def test_quality_flags_dark_image():
    from ai.preprocessing import assess_quality
    q = assess_quality(_png_bytes(color=(3, 3, 3), noise=False))
    assert q.status == "low_quality"


def test_quality_invalid_for_garbage():
    from ai.preprocessing import assess_quality
    q = assess_quality(b"not an image")
    assert q.status == "invalid"


def test_preprocess_shape_and_normalisation():
    from ai.preprocessing import preprocess_for_model
    x = preprocess_for_model(_png_bytes(), size=224)
    assert x.shape == (3, 224, 224)
    assert x.dtype.name == "float32"
    # ImageNet-normalised values should be roughly centred, not in 0..1.
    assert x.min() < 0.0 < x.max()


def test_shades_of_gray_preserves_shape():
    from ai.preprocessing import load_rgb, shades_of_gray
    arr = load_rgb(_png_bytes())
    out = shades_of_gray(arr)
    assert out.shape == arr.shape
    assert out.dtype.name == "uint8"


def test_real_model_abstains_without_weights(monkeypatch, tmp_path):
    """With no checkpoint present, RealScreeningModel must abstain, not crash."""
    torch = pytest.importorskip("torch")  # noqa: F841
    monkeypatch.setenv("SCREENING_MODEL_PATH", str(tmp_path / "does_not_exist.pt"))
    # Reload config + model so the env var takes effect.
    import backend.app.config as cfg
    importlib.reload(cfg)
    import ai.real_model as rm
    importlib.reload(rm)
    model = rm.RealScreeningModel()
    assert model.ready is False
    pred = model.predict(_png_bytes())
    assert pred.abstained is True
    assert pred.prediction == "abstain"
