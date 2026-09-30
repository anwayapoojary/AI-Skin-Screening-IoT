import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, type Patient, type Screening } from "../api";

export default function NewScreening() {
  const nav = useNavigate();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [pid, setPid] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

  useEffect(() => {
    api.patients.list().then((p) => {
      setPatients(p);
      if (p[0]) setPid(p[0].id);
    });
  }, []);

  const go = (s: Screening) => nav(`/screening/${s.id}`);

  const runDevice = async () => {
    if (pid === "") return;
    setBusy(true);
    setErr(null);
    setPhase("Connecting device → capture → transfer → mock AI…");
    try {
      await api.devices.connect("DEVICE_001");
      const s = await api.screenings.runDevice(Number(pid));
      go(s);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const runUpload = async () => {
    if (pid === "" || !file) return;
    setBusy(true);
    setErr(null);
    setPhase("Computer image → same AI pipeline…");
    try {
      const s = await api.screenings.upload(Number(pid), file);
      go(s);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div>
      <h2>New screening</h2>
      <p>Workflow: patient → device ready → capture (virtual CAM or file) → quality → AI → result.</p>
      {err && <p className="error">{err}</p>}
      {phase && <p>{phase}</p>}
      <div className="card">
        <label>
          Patient{" "}
          <select value={pid} onChange={(e) => setPid(Number(e.target.value))}>
            {patients.map((p) => (
              <option key={p.id} value={p.id}>
                {p.patient_code} — {p.display_name}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="card">
        <h3>Device mode (simulator)</h3>
        <p>Virtual ESP32-CAM, OLED states, flash pulse, no invented sensor values.</p>
        <button disabled={busy} onClick={runDevice}>
          Capture from virtual camera
        </button>
      </div>
      <div className="card">
        <h3>Development mode (computer image)</h3>
        <input type="file" accept="image/png,image/jpeg" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
        <button disabled={busy || !file} onClick={runUpload}>
          Analyze uploaded image
        </button>
      </div>
    </div>
  );
}
