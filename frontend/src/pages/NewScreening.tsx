import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { api, type Patient, type Screening, type ScreeningSource } from "../api";

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
  const [source, setSource] = useState<ScreeningSource>("upload");

  useEffect(() => {
    api.patients
      .list()
      .then((p) => {
        setPatients(p);
        if (preselect) setPid(Number(preselect));
        else if (p[0]) setPid(p[0].id);
      })
      .catch((e: Error) => setErr(e.message));
  }, [preselect]);

  const go = (s: Screening) => nav(`/screening/${s.id}`);

  const runDevice = async () => {
    if (pid === "") return;
    setBusy(true);
    setErr(null);
    setPhase("Step 03 / 04: Hardware triggering → optical transfer → AI neural evaluation…");
    try {
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
    setPhase("Creating screening record…");
    try {
      const created = await api.screenings.create(Number(pid), source);
      setPhase("Uploading image to the shared analysis pipeline…");
      await api.screenings.uploadTo(created.id, file, source);
      setPhase("Running model analysis and saving result…");
      const s = await api.screenings.analyze(created.id);
      go(s);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
      setPhase("");
    }
  };

  const selectedPatient = patients.find((p) => p.id === Number(pid));
  const handleFileChange = (selected: File | undefined) => {
    if (!selected) {
      setFile(null);
      return;
    }
    if (!["image/jpeg", "image/png"].includes(selected.type)) {
      setErr("Choose a JPEG or PNG image.");
      setFile(null);
      return;
    }
    if (selected.size > 10 * 1024 * 1024) {
      setErr("Image exceeds the 10 MB limit.");
      setFile(null);
      return;
    }
    setErr(null);
    setFile(selected);
  };

  return (
    <div>
      <div className="editorial-kicker">Clinical Procedure · Standardized Examination Flow</div>

      <h1 className="editorial-title">
        New<br />Screening
      </h1>

      <p className="editorial-subtitle">
        Follow the standardized 4-phase clinical protocol to examine a patient skin lesion.
      </p>

      {err && <div className="notice-error">{err}</div>}
      {phase && (
        <div className="notice-editorial">
          <div className="notice-header">
            <span>Clinical Pipeline Status</span>
            <span>PROCESSING</span>
          </div>
          <p>{phase}</p>
        </div>
      )}

      <hr className="rule-heavy" />

      {patients.length === 0 ? (
        <div className="empty-state">
          <h3>No Patients Enrolled</h3>
          <p>Please register a patient before starting a screening examination.</p>
          <Link to="/patients">
            <button>Register Patient First →</button>
          </Link>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "2.5rem" }}>
          {/* Step 01: Patient Association */}
          <div className="card-heavy" style={{ padding: "2rem", margin: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", fontWeight: 700 }}>
                01 PATIENT IDENTIFICATION
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-muted-text)" }}>
                PHASE 1 OF 4
              </span>
            </div>
            <hr style={{ margin: "1rem 0" }} />
            <p style={{ color: "var(--color-muted-text)", fontSize: "0.95rem", marginBottom: "1rem" }}>
              Select the subject from the active registry to associate clinical telemetry and results.
            </p>

            <div style={{ display: "flex", gap: "1rem", alignItems: "center", flexWrap: "wrap" }}>
              <select
                value={pid}
                onChange={(e) => setPid(Number(e.target.value))}
                aria-label="Select Patient"
                style={{ maxWidth: "400px" }}
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.patient_code} — {p.display_name}
                  </option>
                ))}
              </select>

              {selectedPatient && (
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                  Selected ID: <strong>{selectedPatient.patient_code}</strong>
                </div>
              )}
            </div>
          </div>

          {/* Step 02: Image Acquisition */}
          <div className="card-heavy" style={{ padding: "2rem", margin: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", fontWeight: 700 }}>
                02 IMAGE ACQUISITION
              </div>
              <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-muted-text)" }}>
                PHASE 2 OF 4
              </span>
            </div>
            <hr style={{ margin: "1rem 0" }} />
            <p style={{ color: "var(--color-muted-text)", fontSize: "0.95rem", marginBottom: "1.5rem" }}>
              Capture directly through the ESP32-CAM optical sensor or supply an existing photograph.
            </p>

            <div className="grid-2">
              <label>
                Image source
                <select
                  value={source}
                  onChange={(event) => setSource(event.target.value as ScreeningSource)}
                  aria-label="Image source"
                >
                  <option value="upload">Upload</option>
                  <option value="wifi">Wi-Fi device upload</option>
                  <option value="usb">USB device upload</option>
                  <option value="simulated">Simulated device</option>
                </select>
              </label>
              <div className="card" style={{ padding: "1.5rem", margin: 0 }}>
                <h4 style={{ marginBottom: "0.5rem" }}>Hardware Device Trigger</h4>
                <p style={{ fontSize: "0.85rem", color: "var(--color-muted-text)", marginBottom: "1.25rem" }}>
                  Capture through the configured device gateway. The simulator works without hardware.
                </p>
                <button
                  disabled={busy || pid === ""}
                  onClick={runDevice}
                  style={{ width: "100%" }}
                >
                  {busy ? "Executing…" : "CAPTURE WITH DEVICE →"}
                </button>
              </div>

              <div className="card" style={{ padding: "1.5rem", margin: 0 }}>
                <h4 style={{ marginBottom: "0.5rem" }}>File Upload</h4>
                <p style={{ fontSize: "0.85rem", color: "var(--color-muted-text)", marginBottom: "1rem" }}>
                  Submit JPEG/PNG image from local storage.
                </p>
                <input
                  type="file"
                  accept="image/jpeg,image/png"
                  onChange={(e) => handleFileChange(e.target.files?.[0])}
                  style={{ marginBottom: "1rem", padding: "0.5rem" }}
                />
                <button
                  className="secondary"
                  disabled={busy || pid === "" || !file}
                  onClick={runUpload}
                  style={{ width: "100%" }}
                >
                  {busy ? "Executing…" : "ANALYZE UPLOADED IMAGE →"}
                </button>
              </div>
            </div>
          </div>

          {/* Step 03 & 04: Analysis and Result Overview */}
          <div className="grid-2">
            <div className="card" style={{ padding: "1.5rem", margin: 0, opacity: 0.8 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                03 AI ANALYSIS PIPELINE
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--color-muted-text)" }}>
                Automatic execution of optical quality gate (blur, exposure, contrast) followed by
                multi-class classification inference.
              </p>
            </div>

            <div className="card" style={{ padding: "1.5rem", margin: 0, opacity: 0.8 }}>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", fontWeight: 700, marginBottom: "0.5rem" }}>
                04 RESULT & REPORTING
              </div>
              <p style={{ fontSize: "0.85rem", color: "var(--color-muted-text)" }}>
                Instant presentation of screening verdict, confidence breakdown, safety disclaimer,
                and exportable printable clinical report.
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
