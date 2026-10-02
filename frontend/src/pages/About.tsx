export default function About() {
  return (
    <div>
      <h2>About</h2>
      <div className="card">
        <p>
          <strong>AI Skin Screening Device</strong> — research prototype using ESP32-CAM based image capture,
          FastAPI backend, mock/real AI model, and React operator UI.
        </p>
        <p>
          Hardware kit: ESP32-CAM, 0.96″ OLED, push button, white LED flash, resistors, breadboard, 5V supply, FTDI.
          Development uses a protocol-compatible simulator until hardware is received and verified.
        </p>
      </div>
      <div className="disclaimer">
        This is NOT a medical device certification, diagnosis system, or clinical decision tool.
        Screening indications only — not a substitute for professional medical evaluation.
        Medication reminders are entered by authorized persons and are never auto-prescribed from AI output.
      </div>
    </div>
  );
}
