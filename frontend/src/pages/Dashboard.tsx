import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type DeviceStatus, type Patient, type Screening } from "../api";

export default function Dashboard() {
  const [health, setHealth] = useState<Record<string, unknown> | null>(null);
  const [status, setStatus] = useState<DeviceStatus | null>(null);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [screenings, setScreenings] = useState<Screening[]>([]);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.health(), api.patients.list(), api.screenings.list(), api.devices.status("DEVICE_001")])
      .then(([h, p, s, st]) => {
        setHealth(h as Record<string, unknown>);
        setPatients(p);
        setScreenings(s);
        setStatus(st);
      })
      .catch((e: Error) => setErr(e.message));
  }, []);

  return (
    <div>
      <h2>Dashboard</h2>
      <p className="warn">
        Simulation mode until the ESP32-CAM kit is received and tested. Results are not diagnoses.
      </p>
      {err && <p className="error">{err}</p>}
      <div className="card">
        <h3>System</h3>
        <p>
          Mode: <span className="badge">{String(health?.device_mode)}</span> AI:{" "}
          <span className="badge">{String(health?.ai_mode)}</span>
        </p>
        <p>
          Device state: <span className="badge">{status?.state ?? "—"}</span> OLED:{" "}
          {status?.display_state ?? "—"}
        </p>
      </div>
      <div className="card">
        <p>
          Demo patients: {patients.length} · Screenings: {screenings.length}
        </p>
        <Link to="/screening/new">Start screening</Link>
      </div>
    </div>
  );
}
