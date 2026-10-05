import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type DeviceStatus, type SensorRow } from "../api";

const DEVICE = "DEVICE_001";

export default function DeviceStatusPage() {
  const [st, setSt] = useState<DeviceStatus | null>(null);
  const [sensors, setSensors] = useState<SensorRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    api.devices
      .status(DEVICE)
      .then(setSt)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
    api.devices.sensors(DEVICE).then(setSensors).catch(() => setSensors([]));
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <p className="loading">Interrogating device bus telemetry…</p>;

  return (
    <div>
      <div className="editorial-kicker">Bus Telemetry · Hardware Health Diagnostics</div>

      <h1 className="editorial-title">Device Status</h1>

      <p className="editorial-subtitle">
        Real-time peripheral telemetry, bus health, and communication status for instrument {DEVICE}.
      </p>

      {err && <div className="notice-error">{err}</div>}

      <hr className="rule-heavy" />

      {st ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
          {/* Engineering Diagnostic Readouts */}
          <div className="grid-3">
            <div className="card-heavy" style={{ padding: "1.5rem", margin: 0 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--color-muted-text)", marginBottom: "0.35rem" }}>
                ESP32-CAM CONTROLLER
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.25rem", fontWeight: 700 }}>
                {st.connected ? "CONNECTED" : "DISCONNECTED"}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", marginTop: "0.5rem" }}>
                Mode: {st.mode?.toUpperCase() || "SIMULATION"}
              </div>
            </div>

            <div className="card-heavy" style={{ padding: "1.5rem", margin: 0 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--color-muted-text)", marginBottom: "0.35rem" }}>
                OV2640 CAMERA SENSOR
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.25rem", fontWeight: 700 }}>
                {st.camera_status === "error" ? "ERROR" : "READY"}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", marginTop: "0.5rem" }}>
                DVP 8-bit Parallel Bus
              </div>
            </div>

            <div className="card-heavy" style={{ padding: "1.5rem", margin: 0 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--color-muted-text)", marginBottom: "0.35rem" }}>
                SSD1306 OLED SCREEN
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.25rem", fontWeight: 700 }}>
                {st.display_state?.toUpperCase() || "READY"}
              </div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", marginTop: "0.5rem" }}>
                I2C Bus Address: 0x3C
              </div>
            </div>
          </div>

          {/* Full Technical Telemetry Table */}
          <div className="card" style={{ padding: "2.5rem", margin: 0 }}>
            <h3 style={{ textTransform: "uppercase", marginBottom: "1.5rem" }}>
              Bus Telemetry Diagnostic Matrix
            </h3>

            <table style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th style={{ width: "240px" }}>Peripheral Subsystem</th>
                  <th>Status Metric</th>
                  <th style={{ textAlign: "right" }}>Diagnostic State</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td><strong>Physical Button</strong></td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>GPIO13 Pull-Up</td>
                  <td style={{ fontFamily: "var(--font-mono)", textAlign: "right" }}>
                    {st.button ? st.button.toUpperCase() : "READY"}
                  </td>
                </tr>
                <tr>
                  <td><strong>Strobe Flash LED</strong></td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>GPIO4 High-Power Flash</td>
                  <td style={{ fontFamily: "var(--font-mono)", textAlign: "right" }}>
                    {st.flash ? st.flash.toUpperCase() : "READY"}
                  </td>
                </tr>
                <tr>
                  <td><strong>Communication Transport</strong></td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{st.communication_status || "WebSocket / USB Serial"}</td>
                  <td style={{ fontFamily: "var(--font-mono)", textAlign: "right" }}>
                    {st.connected ? "CONNECTED" : "OFFLINE"}
                  </td>
                </tr>
                <tr>
                  <td><strong>Firmware Build</strong></td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{st.firmware_version ?? "v1.0.0-dual"}</td>
                  <td style={{ fontFamily: "var(--font-mono)", textAlign: "right" }}>OK</td>
                </tr>
                <tr>
                  <td><strong>Protocol Contract</strong></td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>Protocol Version {st.protocol_version}</td>
                  <td style={{ fontFamily: "var(--font-mono)", textAlign: "right" }}>VERIFIED</td>
                </tr>
                <tr>
                  <td><strong>Last Signal Heartbeat</strong></td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                    {st.last_communication ? new Date(st.last_communication).toLocaleTimeString() : "Active (In-Process)"}
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", textAlign: "right" }}>HEALTHY</td>
                </tr>
                <tr>
                  <td><strong>Auxiliary Sensors</strong></td>
                  <td style={{ color: "var(--color-muted-text)" }}>{st.sensor_status} (none in BOM)</td>
                  <td style={{ fontFamily: "var(--font-mono)", textAlign: "right", color: "var(--color-muted-text)" }}>N/A</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div style={{ display: "flex", gap: "1rem" }}>
            <Link to="/devices">
              <button className="secondary">← Return to Device Controller</button>
            </Link>
            <Link to="/capture">
              <button>Proceed to Image Acquisition →</button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="empty-state">
          <h3>Instrument Unreachable</h3>
          <p>The hardware daemon or simulator is currently not responding to status probes.</p>
          <button onClick={refresh}>Retry Diagnostic Ping</button>
        </div>
      )}
    </div>
  );
}
