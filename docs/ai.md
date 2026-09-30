# AI screening

The AI engine receives **images** (and optional quality metadata). It must not
import firmware, GPIO, or device drivers.

## Interface

`ScreeningModel.predict(image, image_quality_status="ok") -> ScreeningPrediction`

Fields: prediction, confidence, model_version, preprocessing_version, timestamp,
image_quality_status, abstained, notes.

## Implementations

| Class | Behavior |
|-------|----------|
| `MockScreeningModel` | Deterministic mock from image hash; low quality → abstain. Labels: `finding_a`, `finding_b`, `unremarkable_screen`, `abstain`. |
| `RealScreeningModel` | Transfer-learning skin-lesion classifier (torchvision backbone). Loads a checkpoint from `SCREENING_MODEL_PATH`. Real preprocessing (colour constancy + ImageNet normalisation) and a quality gate. |

Select with `AI_MODE=mock` (default) or `AI_MODE=real` in `.env`.

## Real model: preprocessing

`ai/preprocessing.py` (needs `backend/requirements-ml.txt`):

- **Quality gate** — rejects empty/tiny/too-dark/too-bright/out-of-focus images
  (variance-of-Laplacian focus measure). Returns `ok` / `low_quality` / `invalid`.
- **Shades-of-Gray colour constancy** — normalises illumination colour, which
  improves robustness across cameras and lighting.
- **Resize + ImageNet normalisation** to a 224×224 CHW tensor.

## Real model: decision mapping

The multiclass lesion probabilities are collapsed into a binary screening
indication (details in the notes field):

- `refer` — combined suspicious-class probability ≥ 0.5 and confidence ≥
  `SCREENING_ABSTAIN_THRESHOLD`. Recommend clinical evaluation.
- `routine` — no suspicious features detected this screen.
- `abstain` — low image quality or low confidence; recapture / human review.

Suspicious classes default to `mel,bcc,akiec` (HAM10000). Configure via
`SCREENING_CLASS_NAMES` and `SCREENING_SUSPICIOUS_LABELS`.

## Graceful degradation

If the ML libraries or the checkpoint are missing, `RealScreeningModel` does not
crash the API — every screening returns an `abstain` result whose note explains
what to install or train. See `docs/ml_training.md` to obtain data and train.

Results are **screening assistance only**, not a confirmed medical diagnosis.
