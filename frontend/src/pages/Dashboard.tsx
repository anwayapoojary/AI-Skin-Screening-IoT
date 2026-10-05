import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type DeviceStatus, type Patient, type Screening } from "../api";

export default function Dashboard() {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboardData = () => {
    setLoading(true);
    setErr(null);
    Promise.all([
      api.health(),
      api.patients.list(),
      api.screenings.list(),
      api.devices.status("DEVICE_001"),
    ])
      .then(([h, p, s, st]) => {
        setHealth(h as Record<string, unknown>);
        setPatients(p);
        setScreenings(s);
        setStatus(st);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  if (loading) {
    return <p className="loading">Loading dashboard…</p>;
  }

  return (
    <div>
      <div className="editorial-kicker">
        AI Skin Screening · Clinical Screening Interface · Protocol v1.0
      </div>

      <h1 className="editorial-title">
        Screening<br />Dashboard
      </h1>

      <p className="editorial-subtitle">
        A non-diagnostic AI-assisted skin screening instrument for preliminary visual assessment
        and clinical queue management.
      </p>

      {/* Monochrome Editorial Simulation Notice */}
      <div className="notice-editorial">
        <div className="notice-header">
          <span>Operating Mode Notice</span>
          <span>SIMULATION MODE</span>
        </div>
        <p>
          Simulation mode until the ESP32-CAM kit is received and tested. Results are screening
          indications only — not diagnoses. Screening results shown in simulation mode are for
          software testing only and are not diagnoses.
        </p>
      </div>

      {/* Monochrome System Error Handling */}
      {err && (
        <div className="card-heavy" style={{ backgroundColor: "#000000", color: "#FFFFFF", padding: "1.5rem 2rem" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.15em", marginBottom: "0.5rem" }}>
            SYSTEM ERROR
          </div>
          <hr style={{ borderColor: "#FFFFFF", margin: "0.5rem 0 1rem 0" }} />
          <p style={{ color: "#FFFFFF", margin: "0 0 1rem 0" }}>
            The screening service could not be reached: {err}
          </p>
          <button
            onClick={fetchDashboardData}
            style={{ backgroundColor: "#FFFFFF", color: "#000000", borderColor: "#FFFFFF" }}
          >
            Retry Connection
          </button>
        </div>
      )}

      <hr className="rule-heavy" />

      {/* Technical Status Grid */}
      <div style={{ marginBottom: "2.5rem" }}>
        <h4 style={{ marginBottom: "1rem" }}>System Status</h4>
        <div className="grid-4">
          <div className="card" style={{ padding: "1.25rem", margin: 0 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--color-muted-text)", marginBottom: "0.5rem" }}>
              DEVICE CONTROLLER
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.1rem", fontWeight: 700 }}>
              {status?.connected ? "CONNECTED" : String(health?.device_mode ?? "SIMULATION").toUpperCase()}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", marginTop: "0.5rem" }}>
              State: {status?.state ?? "READY"}
            </div>
          </div>

          <div className="card" style={{ padding: "1.25rem", margin: 0 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--color-muted-text)", marginBottom: "0.5rem" }}>
              AI INFERENCE ENGINE
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.1rem", fontWeight: 700 }}>
              {String(health?.ai_mode ?? "READY").toUpperCase()}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", marginTop: "0.5rem" }}>
              {health?.ai_mode === "mock" ? "DEMO / MOCK MODEL" : "PyTorch Model"} · {screenings[0]?.model_version ?? "no screenings yet"}
            </div>
          </div>

          <div className="card" style={{ padding: "1.25rem", margin: 0 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--color-muted-text)", marginBottom: "0.5rem" }}>
              OPTICAL CAMERA
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.1rem", fontWeight: 700 }}>
              {status?.camera_status?.toUpperCase() ?? "READY"}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", marginTop: "0.5rem" }}>
              OV2640 2MP Sensor
            </div>
          </div>

          <div className="card" style={{ padding: "1.25rem", margin: 0 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--color-muted-text)", marginBottom: "0.5rem" }}>
              OLED DISPLAY
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "1.1rem", fontWeight: 700 }}>
              {status?.display_state ? status.display_state.toUpperCase() : "READY"}
            </div>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", marginTop: "0.5rem" }}>
              SSD1306 0.96″ I2C
            </div>
          </div>
        </div>
      </div>

      <hr className="rule-thin" />

      {/* Clinical Queue & Statistics Section */}
      <div className="grid-2">
        <div className="card-heavy" style={{ padding: "2rem" }}>
          <h3 style={{ textTransform: "uppercase", marginBottom: "1rem" }}>Clinical Screening Queue</h3>
          {patients.length === 0 && screenings.length === 0 ? (
            <div className="empty-state" style={{ margin: "1rem 0" }}>
              <h3>No data yet</h3>
              <p>Register a patient and run a screening to get started.</p>
            </div>
          ) : (
            <div style={{ marginBottom: "1.5rem" }}>
              <table style={{ margin: "0 0 1rem 0" }}>
                <tbody>
                  <tr>
                    <td><strong>Active Patients</strong></td>
                    <td style={{ fontFamily: "var(--font-mono)", textAlign: "right", fontWeight: 700 }}>
                      {patients.length}
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Completed Screenings</strong></td>
                    <td style={{ fontFamily: "var(--font-mono)", textAlign: "right", fontWeight: 700 }}>
                      {screenings.length}
                    </td>
                  </tr>
                  <tr>
                    <td><strong>Latest Model Version</strong></td>
                    <td style={{ fontFamily: "var(--font-mono)", textAlign: "right" }}>
                      {screenings[0]?.model_version ?? "No screenings yet"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          )}

          <div style={{ display: "flex", gap: "1rem" }}>
            <Link to="/screening/new">
              <button>Start screening →</button>
            </Link>
            <Link to="/patients">
              <button className="secondary">Patient Directory</button>
            </Link>
          </div>
        </div>

        <div className="card" style={{ padding: "2rem" }}>
          <h3 style={{ textTransform: "uppercase", marginBottom: "1rem" }}>Quick Actions</h3>
          <p style={{ color: "var(--color-muted-text)", fontSize: "0.95rem", marginBottom: "1.5rem" }}>
            Initiate automated optical examination, examine longitudinal skin lesion comparisons,
            or inspect hardware telemetry.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <Link to="/capture" style={{ textDecoration: "none" }}>
              <button className="secondary" style={{ width: "100%", justifyContent: "space-between" }}>
                <span>Capture / Upload Lesion Image</span>
                <span>→</span>
              </button>
            </Link>
            <Link to="/history" style={{ textDecoration: "none" }}>
              <button className="secondary" style={{ width: "100%", justifyContent: "space-between" }}>
                <span>Screening History & Compare</span>
                <span>→</span>
              </button>
            </Link>
            <Link to="/devices/live" style={{ textDecoration: "none" }}>
              <button className="secondary" style={{ width: "100%", justifyContent: "space-between" }}>
                <span>Hardware Telemetry Stream</span>
                <span>→</span>
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
