# Project Status & Verification Matrix

**Project:** AI-Powered Low-Cost Health Screening Device  
**System Type:** Screening Support Instrument (Not a diagnostic device)  
**Safety Notice:** *Screening support only, not a diagnosis. Consult a doctor.*  
**Date:** 2026-10-08  

---

## 1. Feature Implementation & Verification Status

| Feature / Subsystem | Scope | Status | Verification Detail |
|---|---|---|---|
| **Dashboard UI** | 4 blocks: summary cards, quick actions & search, reminders & status mini-card, notices bar | **TESTED** | Verified via Vitest DOM tests with empty/loaded/error states |
| **Patients Management** | List, search, create, update, detail view | **TESTED** | Pytest CRUD tests and Vitest UI tests passed |
| **Guided Screening Flow** | Patient selection → capture/upload/simulated → AI analysis → Result view | **TESTED** | Full flow tested in pytest (`test_api_e2e.py`) & Vitest |
| **Records & Archive** | Multi-tab view: Screening History, Clinical Reports, Medication Reminders | **TESTED** | Verified tab switching and data loading via Vitest |
| **System Gear Menu** | Device transport, Live telemetry, Model Info, Settings, About | **TESTED** | Route redirects and component rendering verified |
| **Mock AI Engine** | Deterministic heuristics, uncertain thresholds, disclaimer compliance | **TESTED** | 88 pytest tests passing with mock backend |
| **Real TorchScript Engine** | EfficientNet-B0 inference on CPU, bilinear 224x224 RGB, softmax, top-3 | **TESTED** | `test_inference.py` loaded `model.pt`, verified shape `(1, 7)`, sum to 1.0 |
| **Uncertainty Rule** | Confidence < 0.50 triggers `uncertain: true` ("Uncertain, needs review") | **TESTED** | Boundary tests verify threshold at 0.50 |
| **Input Validation** | Corrupt images, non-images, and payloads >10MB rejected with 4xx | **TESTED** | Pytest quality gate and upload rejection tests passed |
| **Device Transport (Simulated)** | In-memory frame generator and WebSocket telemetry | **TESTED** | Automated pytest tests passing |
| **Device Transport (Wi-Fi/HTTP)** | Multipart upload to `/api/device/upload` with Bearer token authentication | **TESTED** | Pytest transport and token rejection tests passed |
| **Device Transport (USB Serial)** | Framed binary protocol with start marker, length, CRC32, and retry in `scripts/usb_bridge.py` | **TESTED** | Pytest serial transport and CRC32 tests passed |
| **Device Command Queue** | Capture, set_mode, flash allowlist; polling & ack lifecycle | **TESTED** | Lifecycle tested in pytest |
| **ESP32-CAM Firmware (Wi-Fi)** | Arduino/C++ firmware with HTTP upload & WebSocket fallback | **NOT TESTED** | Hardware not connected; PlatformIO CLI not on host |
| **ESP32-CAM Firmware (USB Serial)**| Framed 921600 baud binary UART with CRC32 | **NOT TESTED** | Physical serial hardware not attached |
| **Physical Strobe / LED / Button** | GPIO4 strobe, GPIO12 indicator, GPIO13 button, SSD1306 OLED | **NOT TESTED** | Requires physical breadboard bench setup |
| **Docker Compose Services** | Backend API + Frontend Nginx containers | **NOT TESTED** | Docker engine/CLI not installed in host test environment |
| **End-to-End Browser Automation** | Full headless browser workflow via Playwright | **NOT TESTED** | Browser automation driver not installed; Vitest DOM testing substituted |

---

## 2. Model Metrics (Read Directly from `ai/models/metrics.json`)

> **Note:** These metrics reflect offline model evaluation on the HAM10000 benchmark split by `lesion_id` (70% train / 15% validation / 15% test). Never fabricated.

* **Architecture:** `efficientnet_b0` (ImageNet pretrained, fine-tuned)
* **Dataset Split:** Partitioned strictly by `lesion_id` (70 / 15 / 15)
* **Dataset Sizes:** 7,002 Train | 1,519 Validation | 1,494 Test
* **Test Accuracy:** **74.77%** (`0.747657`)
* **Test Macro-F1:** **61.61%** (`0.616140`)
* **Best Validation Macro-F1:** **66.19%** (`0.661889`)
* **Test Cross-Entropy Loss:** **0.6650** (`0.664998`)
* **Training Duration:** 11 epochs (~4.8 minutes)

### Per-Class Performance Summary

| Class Code | Condition / Name | Recall | Precision | F1-Score | Test Support |
|---|---|---|---|---|---|
| **akiec** | Actinic keratoses and intraepithelial carcinoma | 52.38% | 70.21% | 0.6000 | 63 |
| **bcc** | Basal cell carcinoma | 80.88% | 65.48% | 0.7237 | 68 |
| **bkl** | Benign keratosis-like lesions | 72.37% | 58.82% | 0.6490 | 152 |
| **df** | Dermatofibroma | 42.86% | 15.79% | 0.2308 | 7 |
| **mel** | Melanoma | 66.31% | 40.79% | 0.5051 | 187 |
| **nv** | Melanocytic nevi | 77.51% | 94.03% | 0.8498 | 996 |
| **vasc** | Vascular lesions | 95.24% | 62.50% | 0.7547 | 21 |
| **Macro Average** | Across all 7 classes | **69.65%** | **58.23%** | **61.61%** | 1,494 |
| **Weighted Average** | Weighted by class support | **74.77%** | **80.67%** | **76.57%** | 1,494 |

---

## 3. Known Limitations

1. **Dermoscopic vs. Clinical Sensor Gap:** The model was trained exclusively on dermoscopic imagery from HAM10000. It has **not** been clinically validated or fine-tuned on non-dermoscopic, fixed-focus images from the ESP32-CAM OV2640 sensor.
2. **Severe Class Imbalance:** Classes such as `df` (7 test samples) and `vasc` (21 test samples) suffer from small sample sizes, leading to noisy recall and lower precision metrics.
3. **Skin-Tone Diversity:** HAM10000 predominantly features Fitzpatrick skin types I–III. Generalization across darker skin phenotypes (Fitzpatrick IV–VI) is unverified and requires targeted data collection.
4. **Hardware Not Physically Connected:** Real embedded hardware loop could not be physically exercised in this CI environment; verified via simulation and serial framing unit tests.
5. **No Production Authentication:** System operates with prototype authentication (`AUTH_ENABLED=false`). Production deployments must integrate OpenID Connect/OAuth2 and role-based access control.

---

## 4. Next Steps & Recommendations

1. **Consented Data Collection:** Collect an ethical, IRB-approved dataset of skin lesion photographs captured directly using the ESP32-CAM optical sensor.
2. **Domain Adaptation & Fine-Tuning:** Retrain or fine-tune the EfficientNet-B0 network on combined dermoscopic and ESP32-CAM images with representative skin tone distributions.
3. **Hardware Bench Verification:** Flash firmware onto physical ESP32-CAM modules using PlatformIO, test the TP4056/boost battery power supply and 470µF decoupling capacitor under strobe flash transients.
4. **Clinical Partnership:** Conduct prospective clinical observational studies under physician supervision before considering diagnostic trials.
