export default function About() {
  return (
    <div>
      <div className="editorial-kicker">Research Monograph · Engineering Specification</div>

      <h1 className="editorial-title">
        AI<br />Skin<br />Screening
      </h1>

      <div style={{ fontFamily: "var(--font-mono)", fontSize: "1rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "1.5rem" }}>
        Low-Cost AI-Assisted Skin Screening Device
      </div>

      <p className="editorial-subtitle">
        An edge-cloud internet-of-things clinical prototype combining accessible microcontroller
        hardware, deterministic quality gating, and deep convolutional neural networks for
        dermatological triaging.
      </p>

      <hr className="rule-heavy" />

      {/* Project Architecture Monograph */}
      <div className="grid-2" style={{ marginBottom: "2.5rem" }}>
        <div className="card-heavy" style={{ padding: "2rem", margin: 0 }}>
          <h3 style={{ textTransform: "uppercase", marginBottom: "1rem" }}>
            Hardware System (Edge Node)
          </h3>
          <p style={{ fontSize: "0.95rem", lineHeight: 1.6, color: "var(--color-muted-text)" }}>
            The physical capture unit is designed around the <strong>AI-Thinker ESP32-CAM</strong> board
            featuring an OmniVision OV2640 2-megapixel image sensor, internal SRAM/PSRAM buffer,
            I2C SSD1306 0.96″ status OLED, hardware trigger switch (GPIO13), and synchronized
            white LED flash illumination (GPIO4).
          </p>
          <hr className="rule-thin" />
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
            Dual-Mode Communication: Wi-Fi WebSocket (Protocol v1.0) & Direct USB UART
          </div>
        </div>

        <div className="card-heavy" style={{ padding: "2rem", margin: 0 }}>
          <h3 style={{ textTransform: "uppercase", marginBottom: "1rem" }}>
            Neural Inference Pipeline
          </h3>
          <p style={{ fontSize: "0.95rem", lineHeight: 1.6, color: "var(--color-muted-text)" }}>
            Images undergo an automated three-tier <strong>Optical Quality Gate</strong> checking focus
            sharpness via Laplacian variance, luminance thresholds (avoiding under/over-exposure),
            and minimum dimensions prior to feeding convolutional neural models (EfficientNet/ResNet
            trained on dermatological lesion corpuses).
          </p>
          <hr className="rule-thin" />
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
            Safe Abstention: Unreliable or blurry frames trigger automated re-examination requests
          </div>
        </div>
      </div>

      {/* Hardware BOM Specifications */}
      <div className="card" style={{ padding: "2.5rem", marginBottom: "2rem" }}>
        <h3 style={{ textTransform: "uppercase", marginBottom: "1.5rem" }}>
          Physical Bill of Materials (BOM)
        </h3>

        <table style={{ margin: 0 }}>
          <thead>
            <tr>
              <th style={{ width: "220px" }}>Subsystem</th>
              <th>Component Specification</th>
              <th style={{ width: "160px" }}>Interface</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Microcontroller</strong></td>
              <td>Espressif ESP32-S with 4MB PSRAM</td>
              <td>Wi-Fi 802.11 b/g/n / UART</td>
            </tr>
            <tr>
              <td><strong>Optical Sensor</strong></td>
              <td>OmniVision OV2640 2MP Camera Sensor</td>
              <td>DVP 8-bit Parallel</td>
            </tr>
            <tr>
              <td><strong>Display Unit</strong></td>
              <td>0.96″ SSD1306 Monochrome OLED Screen</td>
              <td>I2C (SDA: GPIO14, SCL: GPIO15)</td>
            </tr>
            <tr>
              <td><strong>Strobe Illumination</strong></td>
              <td>High-Power White Surface-Mount LED</td>
              <td>GPIO4 Strobe Output</td>
            </tr>
            <tr>
              <td><strong>Operator Trigger</strong></td>
              <td>Tactile Momentary Push Button</td>
              <td>GPIO13 (Internal Pull-Up)</td>
            </tr>
            <tr>
              <td><strong>Power Delivery</strong></td>
              <td>External 5V 2A DC Supply</td>
              <td>Regulated 5V Rail</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Ethical & Regulatory Disclaimer */}
      <div className="disclaimer">
        <strong>CLINICAL SAFETY & REGULATORY ADVISORY:</strong> This system is an engineering research prototype.
        It is NOT certified as a medical device, diagnosis apparatus, or clinical decision instrument.
        All AI outputs constitute preliminary screening indications only and must never replace formal clinical examination
        by licensed medical professionals. Medication schedules are strictly managed by authorized clinical personnel
        and are never auto-prescribed by the automated system.
      </div>
    </div>
  );
}
