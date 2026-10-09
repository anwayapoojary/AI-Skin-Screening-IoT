# Skin model data and training

The project includes a trained seven-class TorchScript model at
`ai/models/model.pt`, along with its labels, preprocessing contract, evaluation
metrics, model card, and confusion matrix. Its current evaluation and
limitations are documented in [ai.md](./ai.md); those metrics are read from
`ai/models/metrics.json`.

## Data handling

The supplied model was trained on HAM10000 dermoscopic images, with a
lesion-ID grouped 70/15/15 train/validation/test split. The original dataset
is not included. If you download it for training or research, keep it in an
ignored `data/` directory and do not commit image data or metadata.

## Runtime

Install the backend dependencies from the repository root:

```powershell
.\.venv\Scripts\python.exe -m pip install -r backend\requirements.txt
```

The default backend is `MODEL_BACKEND=real`. Set `MODEL_BACKEND=mock` to use the
deterministic development model. The backend loads the checked-in model on CPU
at startup. A model-load failure leaves the
API running, reports its state at `/api/model/info`, and makes analysis return
a clear service error.

## Reproducing or replacing the model

Training is optional and requires your own appropriately licensed dataset.
Do not tune an uncertainty threshold against test-set results. If replacing
the artifact, keep the class order and preprocessing contract synchronized
with `ai/models/labels.json` and `ai/models/preprocess.json`, regenerate
evaluation artifacts on an appropriate held-out split, and update the model
card and documentation from those artifacts.

Model output is screening support only, not a diagnosis. HAM10000 training
does not validate the model on ESP32-CAM or other device images.
