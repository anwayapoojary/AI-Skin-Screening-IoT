import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, type Patient, type Screening } from "../api";

export default function NewScreening() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const preselect = searchParams.get("patient");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [pid, setPid] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    api.patients.list().then((p) => {
      setPatients(p);
      if (preselect) setPid(Number(preselect));
      else if (p[0]) setPid(p[0].id);
    });
  }, [preselect]);

  const go = (s: Screening) => nav(`/screening/${s.id}`);

  const runDevice = async () => {
    if (pid === "") return;
    setBusy(true);
    setErr(null);
    setPhase("Connecting device → capture → transfer → AI analysis…");
    try {
      await api.devices.connect("DEVICE_001");
      const s = await api.screenings.runDevice(Number(pid));
      go(s);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      setPhase("");
    }
  };

  const runUpload = async () => {
    if (pid === "" || !file) return;
    setBusy(true);
    setErr(null);
    setPhase("Uploading image → quality check → AI analysis…");
    try {
      const s = await api.screenings.upload(Number(pid), file);
      go(s);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      setPhase("");
    }
  };

  return (
    <div>
      <h2>New Screening</h2>
      <p className="info">
        Workflow: select patient → choose capture method → quality check → AI analysis → result.
      </p>
      {err && <p className="error">{err}</p>}
      {phase && <p className="info">{phase}</p>}

      {patients.length === 0 ? (
        <div className="empty-state">
          <h3>No patients registered</h3>
          <p>Register a patient on the <a href="/patients">Patients page</a> first.</p>
        </div>
      ) : (
        <>
          <div className="card">
            <h3>1. Select patient</h3>
            <div className="form-row">
              <select value={pid} onChange={(e) => setPid(Number(e.target.value))} aria-label="Select patient">
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.patient_code} — {p.display_name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="card">
            <h3>2a. Device capture (simulator)</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--color-text-subtle)" }}>
              Virtual ESP32-CAM: OLED states, flash pulse, simulated image.
            </p>
            <button disabled={busy} onClick={runDevice}>
              {busy ? "Processing…" : "Capture from virtual camera"}
            </button>
          </div>

          <div className="card">
            <h3>2b. Upload image (development)</h3>
            <p style={{ fontSize: "0.85rem", color: "var(--color-text-subtle)" }}>
              Upload a skin image from your computer. Same AI pipeline.
            </p>
            <div className="form-row">
              <input type="file" accept="image/png,image/jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
              <button disabled={busy || !file} onClick={runUpload}>
                {busy ? "Analyzing…" : "Analyze uploaded image"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
