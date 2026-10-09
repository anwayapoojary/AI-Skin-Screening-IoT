# Model card: HAM10000 skin screening classifier

Screening support only. Not a diagnosis. Not a medical device.

## Data
- HAM10000 (dermoscopic images, 7 classes), 10015 images.
- Split by lesion_id (70/15/15, seed 42). HAM10000 has no patient id, so the same patient may appear in more than one split.

## Model
- EfficientNet-B0, ImageNet pretrained, fine-tuned, 224x224, class-weighted loss, AdamW, early stopping on val macro-F1.
- Smoke test run: False

## Results (test set, single evaluation)
- Macro-F1: 0.6161
- Accuracy: 0.7477
- Per-class recall: akiec 0.52, bcc 0.81, bkl 0.72, df 0.43, mel 0.66, nv 0.78, vasc 0.95

## Limitations
- Domain shift: trained on dermoscopic images; ESP32-CAM images look different, so results may not transfer.
- Strong class imbalance (melanocytic nevi dominate).
- Limited demographic diversity; mostly lighter skin types.
- Test set is small for rare classes, so per-class numbers are noisy.
- Not validated on images from the project device.