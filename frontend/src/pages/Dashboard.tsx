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

  useEffect(() => {
    Promise.all([api.health(), api.patients.list(), api.screenings.list(), api.devices.status("DEVICE_001")])
      .then(([h, p, s, st]) => {
        setHealth(h as Record<string, unknown>);
        setPatients(p);
        setScreenings(s);
        setStatus(st);
      })
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading">Loading dashboard…</p>;

  return (
    <div>
      <h2>Dashboard</h2>
      <p className="warn">
        Simulation mode until the ESP32-CAM kit is received and tested. Results are screening indications only — not diagnoses.
      </p>
      {err && <p className="error">{err}</p>}

      <div className="card">
        <h3>System</h3>
        <p>
          Device mode: <span className="badge">{String(health?.device_mode ?? "—")}</span>{" "}
          AI mode: <span className="badge">{String(health?.ai_mode ?? "—")}</span>{" "}
          {health?.ai_mode === "mock" && <span className="badge warn">DEMO / MOCK MODEL</span>}
        </p>
        <p>
          AI model version:{" "}
          <span className="badge">{screenings[0]?.model_version ?? "no screenings yet"}</span>
        </p>
        <p>
          Device state: <span className="badge">{status?.state ?? "—"}</span>{" "}
          OLED: {status?.display_state ?? "—"}
        </p>
      </div>

      <div className="card">
        {patients.length === 0 && screenings.length === 0 ? (
          <div className="empty-state">
            <h3>No data yet</h3>
            <p>Register a patient and run a screening to get started.</p>
          </div>
        ) : (
          <p>
            Patients: <strong>{patients.length}</strong> · Screenings: <strong>{screenings.length}</strong>
          </p>
        )}
        <Link to="/screening/new">
          <button style={{ marginTop: "0.5rem" }}>Start screening</button>
        </Link>
      </div>
    </div>
  );
}
