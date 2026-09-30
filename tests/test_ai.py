from ai.mock_model import MockScreeningModel
from hardware.simulator.sample_image import SAMPLE_PNG


def test_mock_predict_and_abstain_empty():
    m = MockScreeningModel()
    p = m.predict(SAMPLE_PNG, "ok")
    assert p.model_version.startswith("mock")
    assert p.disclaimer if hasattr(p, "disclaimer") else True
    d = p.as_dict()
    assert "Not a confirmed medical diagnosis" in d["disclaimer"]
    bad = m.predict(b"", "ok")
    assert bad.abstained
