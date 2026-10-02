# AI Screening Engine Architecture & Model Contract

The AI engine receives **images** (JPEG/PNG bytes) and quality metadata. It is strictly decoupled from device drivers, GPIO, and firmware transport.

## 1. Interface Specification

All model implementations must conform to the abstract base class `ScreeningModel`:

```python
ScreeningModel.predict(image: bytes, image_quality_status: str = "ok") -> ScreeningPrediction
```

### Prediction Output Schema

| Field | Type | Description |
|-------|------|-------------|
| `prediction` | `str` | Predicted class name or screening category (e.g., `Benign keratosis`, `refer`, `routine`, `abstain`) |
| `confidence` | `float` | Model confidence probability `[0.0, 1.0]` |
| `model_name` | `str` | Registered model identifier (e.g., `MockScreeningModel`, `EfficientNet-B0-Skin`) |
| `model_version` | `str` | Version tag or commit hash of the weights |
| `preprocessing_version` | `str` | Pipeline tag (e.g., `v1.0-standard`, `shades-of-gray-224`) |
| `timestamp` | `datetime` | UTC timestamp when inference was executed |
| `image_quality_status` | `str` | Verdict from optical quality gate (`ok`, `low_quality`, `invalid`) |
| `abstained` | `bool` | True if quality was low or confidence was below threshold |
| `disclaimer` | `str` | Mandatory investigational device disclaimer |
| `notes` | `str` | Diagnostic details, class probabilities breakdown, or reason for abstaining |

---

## 2. Implementations

| Implementation | Location | Behavior |
|----------------|----------|----------|
| `MockScreeningModel` (Default) | `backend/app/services/ai_mock.py` | Deterministic simulation based on SHA256 digest of image bytes. Clearly tagged `DEMO / MOCK`. Never claims real clinical validity. |
| `RealScreeningModel` | `backend/app/services/ai_real.py` | PyTorch transfer-learning backbone (e.g. EfficientNet-B0 or ResNet50). Loads weights from `MODEL_PATH`. Fails safely if weights or PyTorch are missing. |

Configure active mode in `.env`:
```ini
AI_MODE=mock      # or 'real'
SCREENING_ABSTAIN_THRESHOLD=0.70
SCREENING_MODEL_PATH=ai/weights/best_model.pt
SCREENING_LABELS_PATH=ai/weights/labels.json
```

---

## 3. Preprocessing & Optical Quality Gate

Located in `backend/app/services/preprocessing.py`:

1. **Format & Decoding Verification**: Decodes JPEG/PNG buffers. Rejects corrupted byte streams.
2. **Dimension Check**: Minimum image edge `min_side >= 96` pixels.
3. **Sharpness Gate (Laplacian Variance)**: Rejects blurry images where `variance_of_laplacian < 100.0`.
4. **Exposure & Contrast Gate**:
   - Dark threshold: Rejects if mean luminance `< 30.0` (severe underexposure).
   - Bright threshold: Rejects if mean luminance `> 225.0` (severe overexposure/flash glare).
5. **Illumination Correction**: Optional Shades-of-Gray colour constancy algorithm to normalize skin tones across changing ambient lighting.
6. **Tensor Normalization**: Standard RGB ImageNet transform:
   - Size: `224 × 224`
   - Mean: `[0.485, 0.456, 0.406]`
   - Std: `[0.229, 0.224, 0.225]`

If the quality gate flags an image as `low_quality` or `invalid`, the model **abstains immediately** and does not output an arbitrary or forced prediction.

---

## 4. Exact Drop-In Contract for Custom Trained Models

When replacing the mock model with your own trained deep learning model, adhere to this contract:

### Model Specifications
- **Framework**: PyTorch (`torch.nn.Module`, TorchScript `.pt`, or state dict `.pth`) or ONNX.
- **Input Shape**: `[Batch_Size, 3, 224, 224]` (Float32 tensor, RGB channel order).
- **Output Shape**: `[Batch_Size, Num_Classes]` (Logits or Softmax probabilities).
- **Labels File**: `labels.json` containing an ordered list of class identifiers matching the output indices.

### Drop-in Checklist for Adding Your Model
1. Place your exported weights into `ai/weights/` (e.g. `ai/weights/skin_classifier.pt`).
2. Place your class names mapping in `ai/weights/labels.json`:
   ```json
   ["actinic_keratosis", "basal_cell_carcinoma", "benign_keratosis", "dermatofibroma", "melanoma", "melanocytic_nevus", "vascular_lesion"]
   ```
3. Update `.env`:
   ```ini
   AI_MODE=real
   SCREENING_MODEL_PATH=ai/weights/skin_classifier.pt
   SCREENING_LABELS_PATH=ai/weights/labels.json
   SCREENING_ABSTAIN_THRESHOLD=0.75
   ```
4. Verify by running the automated AI test suite:
   ```bash
   pytest tests/test_ai.py -v
   ```

---

## 5. Dataset & Hardware Discrepancy Notice

> [!WARNING]
> **Domain Shift Warning & Clinical Scope**:
> Public benchmark datasets such as **HAM10000** or **ISIC** comprise high-resolution dermatoscopic images taken with calibrated optical dermatoscopes with polarized immersion fluid.
>
> In contrast, the **ESP32-CAM** utilizes an unpolarized OV2640/OV3660 CMOS sensor with plastic lens elements, fixed focus, and direct white LED illumination. Consequently:
> - Direct inference on raw ESP32-CAM captures using models trained purely on dermatoscope datasets exhibits significant domain shift.
> - Model performance **cannot be considered validated** until the network has been fine-tuned and tested on genuine ESP32-CAM skin images.
> - Public dataset licenses (e.g., CC BY-NC 4.0 for HAM10000) restrict commercial use; confirm all license terms prior to clinical translation.

---

## 6. Regulatory & Clinical Safety Disclaimer

This system is an **exploratory research prototype** designed to evaluate low-cost IoT screening feasibility. It is **NOT** a certified medical device, does not provide medical diagnoses, and cannot substitute for evaluation by a qualified dermatologist or physician.
