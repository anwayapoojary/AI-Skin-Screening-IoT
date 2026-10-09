# Skin screening model

## Safety and scope

**Screening support only, not a diagnosis. Consult a doctor.**

This research prototype is not a medical device. It must not be used to
diagnose, rule out disease, or make treatment decisions.

## Model and data

The real backend loads the checked-in TorchScript EfficientNet-B0 model from
`ai/models/model.pt`. Its seven output labels, full display names, and input
normalization values are read from `ai/models/labels.json` and
`ai/models/preprocess.json`. The reported version combines a short SHA-256
hash of the weights with the model name in `ai/models/metrics.json`.

The training data is HAM10000 dermoscopic imagery. Evaluation splits are
grouped by lesion ID using the 70/15/15 train/validation/test method recorded
in `metrics.json`; patient-level separation is not possible because HAM10000
does not provide patient IDs.

## Supplied evaluation metrics

These values are read from `ai/models/metrics.json`; they describe the supplied
test-set evaluation and are not device-validation results.

| Test class | Recall | Test support |
| --- | ---: | ---: |
| akiec | 0.5238095238095238 | 63 |
| bcc | 0.8088235294117647 | 68 |
| bkl | 0.7236842105263158 | 152 |
| df | 0.42857142857142855 | 7 |
| mel | 0.6631016042780749 | 187 |
| nv | 0.7751004016064257 | 996 |
| vasc | 0.9523809523809523 | 21 |

Test macro-F1: `0.6161402803949866`.

The test support is especially small for rare classes, so those class-level
metrics are noisy. The supplied confusion matrix is
`ai/models/confusion_matrix.png`.

## Limitations

- Training images are dermoscopic; the image domain differs from ordinary
  photos and ESP32-CAM captures.
- The model has **not been validated on device images**. Performance on
  ESP32-CAM, Wi-Fi, or USB captures is unknown.
- The data has substantial class imbalance; melanocytic nevi dominate the
  test set.
- Demographic and skin-tone diversity is limited and is mostly lighter skin
  types.
- Per-class metrics for rare classes are noisy because their test supports
  are small.

## Configuration and inference

`MODEL_BACKEND=mock` selects the deterministic development model.
`MODEL_BACKEND=real` selects the TorchScript artifact. The mock remains
available for development and tests.

Real inference decodes an image as RGB, directly resizes it to the dimensions
in `preprocess.json` with PIL bilinear interpolation (no crop), scales and
normalizes using the file's values, then runs CPU inference with TorchScript.
The output probabilities are softmax values for all seven classes. If the top
probability is below `0.5`, the result is presented as “Uncertain, needs
review”.

The backend serves model metadata at `/api/model/info` and the supplied
confusion matrix at `/api/model/confusion-matrix.png`. If the selected real
model cannot load, the API remains available, reports the failure through
model info, and rejects analysis with a clear service error.

Datasets and local image uploads belong under ignored `data/` directories;
do not commit dataset images. The trained `ai/models/model.pt` artifact is
intentionally version controlled.
