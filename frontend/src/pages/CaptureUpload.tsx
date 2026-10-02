import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { api, type Patient } from "../api";

export default function CaptureUpload() {
  const nav = useNavigate();
  const [searchParams] = useSearchParams();
  const preselect = searchParams.get("patient");
  const [patients, setPatients] = useState<Patient[]>([]);
  const [selectedPid, setSelectedPid] = useState<number | "">("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [fileValidation, setFileValidation] = useState<{ ok: boolean; msg: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    api.patients.list().then((list) => {
      setPatients(list);
      if (preselect) setSelectedPid(Number(preselect));
      else if (list.length > 0) setSelectedPid(list[0].id);
    });
  }, [preselect]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) {
      setSelectedFile(null);
      setPreviewUrl(null);
      setFileValidation(null);
      return;
    }
    setSelectedFile(f);
    setPreviewUrl(URL.createObjectURL(f));

    // Client-side quick check
    const validMimes = ["image/jpeg", "image/png"];
    if (!validMimes.includes(f.type)) {
      setFileValidation({ ok: false, msg: `MIME type '${f.type}' is not supported. Use JPEG or PNG.` });
    } else if (f.size > 10 * 1024 * 1024) {
      setFileValidation({ ok: false, msg: `File size ${(f.size / (1024 * 1024)).toFixed(1)}MB exceeds 10MB limit.` });
    } else {
      setFileValidation({ ok: true, msg: `Valid image: ${(f.size / 1024).toFixed(1)} KB` });
    }
  };

  const handleCaptureDevice = async () => {
    if (selectedPid === "") return;
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg("Connecting to ESP32 device / virtual simulator…");
    try {
      await api.devices.connect("DEVICE_001");
      setStatusMsg("Triggering camera flash & capture…");
      const screening = await api.screenings.runDevice(Number(selectedPid));
      nav(`/analysis?id=${screening.id}`);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
      setStatusMsg("");
    }
  };

  const handleUploadSubmit = async () => {
    if (selectedPid === "" || !selectedFile) return;
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg("Uploading skin lesion image for validation…");
    try {
      const screening = await api.screenings.upload(Number(selectedPid), selectedFile);
      nav(`/analysis?id=${screening.id}`);
    } catch (err) {
      setErrorMsg((err as Error).message);
    } finally {
      setBusy(false);
      setStatusMsg("");
    }
  };

  return (
    <div>
      <h2>Capture / Upload Skin Lesion</h2>
      <p className="info">
        Acquire dermascopic or macro skin images via ESP32-CAM optical sensor or upload a standard JPEG/PNG image for screening.
      </p>

      {errorMsg && <p className="error">{errorMsg}</p>}
      {statusMsg && <p className="info">{statusMsg}</p>}

      {patients.length === 0 ? (
        <div className="empty-state">
          <h3>No Patients Available</h3>
          <p>Please register a patient before initiating a screening session.</p>
          <a href="/patients" className="btn">Register Patient</a>
        </div>
      ) : (
        <div className="grid-2" style={{ marginTop: "1rem" }}>
          <div className="card">
            <h3>1. Patient Association</h3>
            <div className="form-row">
              <label htmlFor="patient-select">Patient Record:</label>
              <select
                id="patient-select"
                value={selectedPid}
                onChange={(e) => setSelectedPid(Number(e.target.value))}
              >
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.patient_code} — {p.display_name}
                  </option>
                ))}
              </select>
            </div>

            <hr style={{ margin: "1.5rem 0", borderColor: "var(--color-border-light)" }} />

            <h3>Method A: Hardware Capture</h3>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
              Acquires image from ESP32-CAM with synchronized white LED flash illumination.
            </p>
            <button
              id="btn-hardware-capture"
              disabled={busy || selectedPid === ""}
              onClick={handleCaptureDevice}
              style={{ width: "100%", marginTop: "0.5rem" }}
            >
              {busy ? "Capturing…" : "Trigger Hardware / Virtual Capture"}
            </button>
          </div>

          <div className="card">
            <h3>Method B: File Upload</h3>
            <p style={{ fontSize: "0.875rem", color: "var(--color-text-muted)" }}>
              Supports standard JPEG or PNG photographs (Max: 10MB).
            </p>

            <div className="form-row">
              <label htmlFor="image-file-input">Select Image File:</label>
              <input
                id="image-file-input"
                type="file"
                accept="image/jpeg,image/png"
                onChange={handleFileChange}
              />
            </div>

            {fileValidation && (
              <p className={fileValidation.ok ? "success" : "error"} style={{ marginTop: "0.5rem" }}>
                {fileValidation.msg}
              </p>
            )}

            {previewUrl && (
              <div style={{ marginTop: "1rem", textAlign: "center" }}>
                <img
                  src={previewUrl}
                  alt="Lesion preview"
                  style={{ maxHeight: "200px", maxWidth: "100%", borderRadius: "var(--radius-sm)", border: "1px solid var(--color-border)" }}
                />
              </div>
            )}

            <button
              id="btn-upload-submit"
              disabled={busy || !selectedFile || !fileValidation?.ok}
              onClick={handleUploadSubmit}
              style={{ width: "100%", marginTop: "1rem" }}
            >
              {busy ? "Uploading…" : "Upload & Analyze Image"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
