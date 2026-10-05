import { useState } from "react";
import { Link } from "react-router-dom";
import { api, type DeviceStatus } from "../api";

const DEVICE = "DEVICE_001";

export default function Devices() {
  const [st, setSt] = useState<DeviceStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div>
      <div className="editorial-kicker">Edge Architecture · Instrument Controller</div>

      <h1 className="editorial-title">Device</h1>

      <p className="editorial-subtitle">
        Physical ESP32-CAM optical sensor node or virtual software simulator bridge.
      </p>

      <div className="notice-editorial">
        <div className="notice-header">
          <span>Interface Protocol</span>
          <span>WEBSOCKET & DIRECT USB SERIAL</span>
        </div>
        <p>
          Physical ESP32-CAM communicates over local Wi-Fi or direct USB Serial COM port.
          In simulation mode, this utilizes the in-process virtual sensor emulator.
        </p>
      </div>

      {err && <div className="notice-error">{err}</div>}
      {success && <div className="notice-editorial">{success}</div>}

      <hr className="rule-heavy" />

      {/* Control Console */}
      <div className="card-heavy" style={{ padding: "2rem", marginBottom: "2rem" }}>
        <h3 style={{ textTransform: "uppercase", marginBottom: "1rem" }}>
          Instrument Session Control
        </h3>
        <p style={{ color: "var(--color-muted-text)", fontSize: "0.95rem", marginBottom: "1.5rem" }}>
          Initiate or terminate active WebSocket session with device identifier: <code>{DEVICE}</code>
        </p>

        <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <button
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setErr(null);
              setSuccess(null);
              api.devices
                .connect(DEVICE)
                .then((s) => {
                  setSt(s);
                  setSuccess("Device handshake acknowledged. Gateway active.");
                })
                .catch((e: Error) => setErr(e.message))
                .finally(() => setLoading(false));
            }}
          >
            {loading ? "INITIALIZING…" : "CONNECT INSTRUMENT →"}
          </button>
          <button
            className="secondary"
            onClick={() => {
              api.devices.disconnect(DEVICE).then(() => {
                setSt(null);
                setSuccess("Device session terminated.");
              });
            }}
          >
            DISCONNECT
          </button>
          <Link to="/devices/live">
            <button className="secondary">
              OPEN LIVE TELEMETRY →
            </button>
          </Link>
        </div>
      </div>

      {/* Technical Device Specification */}
      <div className="card" style={{ padding: "2.5rem" }}>
        <h3 style={{ textTransform: "uppercase", marginBottom: "1.5rem" }}>
          Device Information & Specifications
        </h3>

        <table style={{ margin: 0 }}>
          <tbody>
            <tr>
              <td style={{ width: "240px" }}><strong>HARDWARE ARCHITECTURE</strong></td>
              <td style={{ fontFamily: "var(--font-mono)" }}>ESP32-CAM (AI-Thinker Node)</td>
            </tr>
            <tr>
              <td><strong>OPTICAL SENSOR</strong></td>
              <td style={{ fontFamily: "var(--font-mono)" }}>OmniVision OV2640 2.0 Megapixel</td>
            </tr>
            <tr>
              <td><strong>DISPLAY MODULE</strong></td>
              <td style={{ fontFamily: "var(--font-mono)" }}>SSD1306 0.96″ Monochrome OLED (I2C)</td>
            </tr>
            <tr>
              <td><strong>STROBE ILLUMINATION</strong></td>
              <td style={{ fontFamily: "var(--font-mono)" }}>GPIO4 High-Power Flash LED</td>
            </tr>
            <tr>
              <td><strong>PHYSICAL TRIGGER</strong></td>
              <td style={{ fontFamily: "var(--font-mono)" }}>GPIO13 Push-to-Make Debounced Button</td>
            </tr>
            <tr>
              <td><strong>FIRMWARE STATE MACHINE</strong></td>
              <td style={{ fontFamily: "var(--font-mono)" }}>
                {st?.state ? st.state.toUpperCase() : "STANDBY / READY"}
              </td>
            </tr>
            <tr>
              <td><strong>FIRMWARE BUILD</strong></td>
              <td style={{ fontFamily: "var(--font-mono)" }}>
                {st?.firmware_version ?? "1.0.0-dual"}
              </td>
            </tr>
            <tr>
              <td><strong>GATEWAY COMM STATUS</strong></td>
              <td style={{ fontFamily: "var(--font-mono)" }}>
                {st?.connected ? "CONNECTED (ONLINE)" : "DISCONNECTED / SIMULATION"}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
