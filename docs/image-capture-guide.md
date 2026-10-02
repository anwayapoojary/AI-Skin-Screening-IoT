# Image Capture & Clinical Screening Protocol Guide

Achieving consistent, reproducible image quality is critical for reliable automated skin lesion screening. The ESP32-CAM optical system requires strict adherence to standardized capture protocols.

---

## 1. Physical Framing & Distance

| Parameter | Specification | Recommendation |
|-----------|---------------|----------------|
| **Working Distance** | 8 – 15 cm | Maintain fixed standoff distance to ensure lesion is in focus |
| **Centering** | Center of frame | Lesion should occupy between 30% and 70% of total image area |
| **Angle of Attack** | 10° – 15° oblique | Slight angle prevents direct specular glare from the flash LED |
| **Stability** | Braced / Steady | Rest the operator's hand against the patient's adjacent intact skin |

---

## 2. Illumination & Lighting Management

1. **Avoid Direct Sunlight / Harsh Point Sources**: High dynamic range scenes cause sensor saturation and clipping.
2. **Synchronized White LED Strobe**: Provides repeatable, consistent spectral power distribution across scans.
3. **Specular Reflection Mitigation**:
   - Shiny or oily skin generates bright reflection spots that trip the overexposure gate (mean luminance > 225).
   - Gently dab dry with a clean matte tissue prior to imaging.

---

## 3. Lens Adjustment for OV2640

The OV2640 sensor module arrives glued with a fixed infinity-to-meter focus.
- To focus on lesions at **10 cm**:
  1. Use small needle-nose pliers or tweezers to break the glue bead around the lens threads.
  2. Rotate the lens bezel **counter-clockwise** by approximately 90° to 180°.
  3. Verify sharpness using bring-up sketch `bringup/06_camera_test.ino` while viewing skin texture.

---

## 4. Quality Gate Protocol Workflow

```
[Trigger Capture]
       │
       ▼
[Image Decoded] ──── (Invalid / Corrupted) ────► [Abstain: Prompt Recapture]
       │
       ▼
[Dimension Check: min_side >= 96px] ──── (Failed) ────► [Abstain: Frame Too Small]
       │
       ▼
[Laplacian Focus Check: Var >= 100.0] ──── (Blurry) ────► [Abstain: Blurry / Out of Focus]
       │
       ▼
[Luminance Gate: 30.0 <= Mean <= 225.0] ──── (Dark/Glare) ────► [Abstain: Exposure Error]
       │
       ▼
[Passed Quality Gate] ────► [Neural Inference Execution]
```

When an image fails any step, the system does not guess or force a diagnosis: it transparently logs the optical fault and prompts the operator to adjust distance or lighting for a clean recapture.
