import pytest

from ai.mock_model import MockScreeningModel
from hardware.simulator.sample_image import SAMPLE_PNG


def test_mock_predict_matches_real_result_contract():
    m = MockScreeningModel()
    result = m.predict(SAMPLE_PNG)
    assert result["model_version"].startswith("mock")
    assert result["is_mock"] is True
    assert len(result["top3"]) == 3
    assert set(result["probabilities"]) == set(m.classes)
    assert sum(result["probabilities"].values()) == pytest.approx(1.0)
    assert result["disclaimer"] == "Screening support only, not a diagnosis. Consult a doctor."
