# Research Framework & Experimental Methodology

This document outlines the academic paper structure and reproducible benchmarking methodology for evaluating the IoT skin screening device. In accordance with clinical research ethics, **no fabricated metrics, hypothetical accuracy scores, or unverified patient data are included**.

---

## 1. Paper Title & Structural Outline

**Tentative Title**: *Design and Evaluation of a Low-Cost Embedded IoT System with Edge-Guided Optical Quality Verification for Pre-Clinical Skin Lesion Screening*

### Abstract Outline
- **Background**: Limited access to specialized dermatological expertise in low-resource settings.
- **Objective**: Propose an open, edge-guided IoT acquisition pipeline using ESP32-CAM and decoupled cloud/local inference.
- **Methodology**: Integration of optical quality gates (blur, exposure, contrast) with uncertainty-aware deep learning classifiers.
- **Key Findings**: *(To be completed upon empirical testing with physical hardware and collected validation sets)*.

### Sections
1. **Introduction & Clinical Need**
   - Disparity in access to dermatologist triage.
   - Contrast between high-end digital dermatoscope setups and field-deployable IoT devices.
2. **System Architecture**
   - Embedded firmware architecture (ESP32-CAM, I2C OLED, synchronous white LED strobe).
   - Bidirectional WebSocket protocol and state machine.
   - Decoupled FastAPI backend and clinical dashboard.
3. **Optical Quality Gating Pipeline**
   - Laplacian variance for focus assessment.
   - Luminance histogram bounds for glare and underexposure mitigation.
   - Colour constancy adjustment.
4. **Model Architecture & Uncertainty Quantification**
   - Convolutional / Vision Transformer backbone.
   - Abstention mechanisms for low-confidence or out-of-distribution inputs.
5. **Experimental Results & Discussion**
   - Optical resolution and latency benchmarks.
   - Classification performance across lesion classes.
6. **Ethical Considerations & Regulatory Limitations**
   - Patient privacy and data sovereignty.
   - Prototype classification as investigational aid rather than medical diagnostic device.

---

## 2. Empty Experiment Benchmarking Templates

Use these standardized schemas to record empirical findings once hardware testing commences.

### Table A: Hardware Latency & Power Benchmarks (Template)

| Stage | Duration (ms) | Peak Current (mA) | Supply Voltage (V) | Notes |
|-------|---------------|-------------------|--------------------|-------|
| Boot & Wi-Fi Association | `[Pending HW]` | `[Pending HW]` | `[Pending HW]` | DHCP lease time included |
| WebSocket Handshake | `[Pending HW]` | `[Pending HW]` | `[Pending HW]` | Token verification |
| Exposure Settle & Flash Pulse | `[Pending HW]` | `[Pending HW]` | `[Pending HW]` | Synchronous LED flash |
| SVGA JPEG Capture | `[Pending HW]` | `[Pending HW]` | `[Pending HW]` | OV2640 framebuffer grab |
| Base64 Frame Transfer | `[Pending HW]` | `[Pending HW]` | `[Pending HW]` | Over 2.4 GHz 802.11n |
| Backend Preprocessing Gate | `[Pending HW]` | N/A (Server) | N/A | OpenCV Laplacian & Luminance |
| Neural Network Inference | `[Pending HW]` | N/A (Server) | N/A | PyTorch model evaluation |
| **Total Round-Trip Latency** | `[Pending HW]` | — | — | Trigger to Result Available |

---

### Table B: Model Diagnostic Performance Matrix (Template)

*Note: Populate only after training and evaluating on an ethically approved, test-split dataset.*

| Lesion Class | Support (N) | Sensitivity (Recall) | Specificity | Precision | F1-Score | AUC-ROC |
|--------------|-------------|----------------------|-------------|-----------|----------|---------|
| Actinic Keratosis (AKIEC) | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Basal Cell Carcinoma (BCC) | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Benign Keratosis (BKL) | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Dermatofibroma (DF) | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Melanocytic Nevus (NV) | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Melanoma (MEL) | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Vascular Lesion (VASC) | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| **Macro Average** | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` | `[ ]` |

---

### Table C: Optical Quality Gate Ablation Study (Template)

| Test Condition | Total Images | Passed Quality Gate | Correctly Filtered (Defective) | False Rejections |
|----------------|--------------|---------------------|--------------------------------|------------------|
| Optimal Lighting (Strobe) | `[ ]` | `[ ]` | N/A | `[ ]` |
| Defocused / Hand Shake | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Severe Glare / Flash Halo | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Ambient Underexposure | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
| Low Resolution (<96px) | `[ ]` | `[ ]` | `[ ]` | `[ ]` |
