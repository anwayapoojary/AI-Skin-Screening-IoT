# Skin-lesion screening model — data & training

This is the one part of the project that needs resources **outside this repo**:
a labelled dermatology image dataset and a machine with a GPU (a few hours on a
free Colab/Kaggle GPU is enough). Everything else — preprocessing, inference,
serving — is already implemented.

> Screening indication only. A model trained this way is a research/education
> prototype, **not** a diagnostic medical device. Do not deploy for real
> clinical decisions without proper clinical validation and regulatory review.

## 1. Get a dataset

Recommended public options (you download these yourself — licences require
your acceptance):

| Dataset | Classes | Where |
|---------|---------|-------|
| **HAM10000** (10,015 dermatoscopic images) | 7 (akiec, bcc, bkl, df, mel, nv, vasc) | Kaggle: "Skin Cancer MNIST: HAM10000" / Harvard Dataverse |
| **ISIC Archive** | benign / malignant (+ diagnoses) | isic-archive.com |

HAM10000 is the easiest starting point and matches the default class list in
`.env` (`SCREENING_CLASS_NAMES=akiec,bcc,bkl,df,mel,nv,vasc`).

Layout after download (HAM10000 CSV mode):

```
data/ham10000/
  images/            # all .jpg files (merge the two HAM10000 image folders)
  HAM10000_metadata.csv   # columns include image_id, dx
```

## 2. Install the ML extras

```bash
pip install -r backend/requirements-ml.txt
# For a GPU, install a CUDA torch build from pytorch.org FIRST, then the line above.
```

## 3. Train

```bash
python scripts/train_skin_model.py \
    --images-dir data/ham10000/images \
    --metadata-csv data/ham10000/HAM10000_metadata.csv \
    --image-col image_id --label-col dx --image-ext .jpg \
    --arch efficientnet_b0 --epochs 15 --batch-size 32 \
    --suspicious-labels mel,bcc,akiec \
    --out ai/weights/skin_model.pt
```

Or, if you arrange images into one folder per class:

```bash
python scripts/train_skin_model.py \
    --image-folder data/split/train --val-folder data/split/val \
    --out ai/weights/skin_model.pt
```

The script uses transfer learning (ImageNet-pretrained backbone), class-weighted
loss to handle HAM10000's heavy imbalance, augmentation, and a short head-only
warmup. It reports validation accuracy and — most importantly for a screening
tool — **screening sensitivity** (fraction of truly-suspicious lesions flagged).

The checkpoint embeds `class_names`, `arch`, and `suspicious_labels`, so
inference stays in sync with training.

## 4. Serve the trained model

Set in `.env`:

```
AI_MODE=real
SCREENING_MODEL_PATH=./ai/weights/skin_model.pt
SCREENING_ABSTAIN_THRESHOLD=0.55
# SCREENING_TTA=true   # optional test-time augmentation for a little more robustness
```

Restart the API. `RealScreeningModel` loads the checkpoint and every screening
now runs the trained network. If the checkpoint or the ML libs are missing, the
API does **not** crash — each screening returns an `abstain` result whose note
explains what to fix.

## How predictions map to a screening decision

The multiclass probabilities are collapsed into a binary indication:

- `refer` — combined probability of the suspicious classes ≥ 0.5 and confidence
  ≥ the abstain threshold. Recommend in-person clinical evaluation.
- `routine` — no suspicious features detected this screen.
- `abstain` — low image quality or low confidence; recapture or have a human review.

The per-class breakdown is included in the screening notes for transparency.

## What I still need from you

- The dataset download (licence acceptance is personal) **or** a checkpoint you
  already trained.
- A GPU run of step 3 (I can't train inside the sandbox). Share the resulting
  `skin_model.pt` and I'll wire/verify serving, or drop it at the path above.
- If you want a different target than HAM10000's 7 classes (e.g. a binary
  benign/malignant set), tell me and I'll adjust the class list and mapping.
