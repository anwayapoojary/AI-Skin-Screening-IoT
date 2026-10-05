import { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
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

    // Client-side MIME and size checks
    const validMimes = ["image/jpeg", "image/png"];
    if (!validMimes.includes(f.type)) {
      setFileValidation({ ok: false, msg: `MIME type '${f.type}' is not supported. Use JPEG or PNG.` });
    } else if (f.size > 10 * 1024 * 1024) {
      setFileValidation({ ok: false, msg: `File size ${(f.size / (1024 * 1024)).toFixed(1)}MB exceeds 10MB limit.` });
    } else {
      setFileValidation({ ok: true, msg: `Valid image file: ${(f.size / 1024).toFixed(1)} KB` });
    }
  };

  const handleCaptureDevice = async () => {
    if (selectedPid === "") return;
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg("Triggering hardware capture sequence (OV2640 sensor + strobe)…");
    try {
      await api.devices.connect("DEVICE_001");
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
    setStatusMsg("Uploading and validating lesion image frame…");
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
      <div className="editorial-kicker">Optical Sensor Acquisition · Telemetry Protocol v1.0</div>

      <h1 className="editorial-title">
        Capture<br />or<br />Upload
      </h1>

      <p className="editorial-subtitle">
        Acquire optical dermatological frames via the physical/virtual ESP32-CAM device or submit
        standardized digital macro photographs for automated neural network screening.
      </p>

      {errorMsg && <div className="notice-error">{errorMsg}</div>}
      {statusMsg && (
        <div className="notice-editorial">
          <div className="notice-header">
            <span>Sensor Gateway Status</span>
            <span>TRANSMITTING</span>
          </div>
          <p>{statusMsg}</p>
        </div>
      )}

      {patients.length === 0 ? (
        <div className="empty-state">
          <h3>No Registered Patients</h3>
          <p>You must register a patient profile before initiating an image acquisition session.</p>
          <Link to="/patients">
            <button>Register Patient First →</button>
          </Link>
        </div>
      ) : (
        <div>
          {/* Patient Selection Row */}
          <div className="card-heavy" style={{ padding: "1.5rem 2rem", marginBottom: "2rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <label
                  htmlFor="patient-select"
                  style={{
                    fontFamily: "var(--font-mono)",
                    fontSize: "0.8rem",
                    textTransform: "uppercase",
                    letterSpacing: "0.1em",
                    display: "block",
                    marginBottom: "0.5rem",
                  }}
                >
                  Associated Patient Record
                </label>
                <select
                  id="patient-select"
                  value={selectedPid}
                  onChange={(e) => setSelectedPid(Number(e.target.value))}
                  style={{ maxWidth: "420px" }}
                >
                  {patients.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.patient_code} — {p.display_name}
                    </option>
                  ))}
                </select>
              </div>
              <Link to="/patients" className="ghost" style={{ fontSize: "0.85rem", textTransform: "uppercase", fontFamily: "var(--font-mono)" }}>
                + Register New Patient
              </Link>
            </div>
          </div>

          <hr className="rule-heavy" />

          {/* Main Capture Frame & Inputs */}
          <div className="grid-2">
            {/* Visual Frame Area */}
            <div>
              <h3 style={{ textTransform: "uppercase", marginBottom: "1rem" }}>Optical Frame Input</h3>
              <div
                className="camera-frame-box"
                style={{
                  border: "3px solid #000000",
                  backgroundColor: previewUrl ? "#000000" : "var(--color-surface-muted)",
                  minHeight: "360px",
                }}
              >
                {previewUrl ? (
                  <img src={previewUrl} alt="Screening lesion preview" style={{ objectFit: "contain" }} />
                ) : (
                  <div style={{ textAlign: "center", padding: "2rem" }}>
                    <div className="camera-frame-crosshair" style={{ top: "calc(50% - 20px)", left: "calc(50% - 20px)" }} />
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem", fontWeight: 700, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: "40px" }}>
                      CAMERA INPUT
                    </div>
                    <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-muted-text)", marginTop: "0.5rem" }}>
                      ESP32-CAM / IMAGE UPLOAD
                    </div>
                  </div>
                )}
              </div>

              {previewUrl && (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "0.75rem" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
                    {selectedFile ? `${selectedFile.name} (${(selectedFile.size / 1024).toFixed(1)} KB)` : "Preview active"}
                  </span>
                  <button
                    className="ghost"
                    onClick={() => {
                      setSelectedFile(null);
                      setPreviewUrl(null);
                      setFileValidation(null);
                    }}
                    style={{ fontSize: "0.75rem" }}
                  >
                    Clear preview
                  </button>
                </div>
              )}
            </div>

            {/* Acquisition Methods Panel */}
            <div style={{ display: "flex", flexDirection: "column", gap: "2rem" }}>
              {/* Method A: Hardware Capture */}
              <div className="card-heavy" style={{ padding: "2rem", margin: 0 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-muted-text)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                  Method 01
                </div>
                <h3 style={{ textTransform: "uppercase", margin: "0 0 0.5rem 0" }}>
                  Hardware Sensor Capture
                </h3>
                <p style={{ fontSize: "0.9rem", color: "var(--color-muted-text)", marginBottom: "1.5rem" }}>
                  Trigger the physical ESP32-CAM (or virtual simulator) to strobe the white flash LED,
                  focus, and transmit an uncompressed frame over USB/WebSocket.
                </p>

                <button
                  id="btn-hardware-capture"
                  disabled={busy || selectedPid === ""}
                  onClick={handleCaptureDevice}
                  style={{ width: "100%" }}
                >
                  {busy ? "Capturing…" : "CAPTURE IMAGE →"}
                </button>
              </div>

              {/* Method B: File Upload */}
              <div className="card" style={{ padding: "2rem", margin: 0 }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-muted-text)", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                  Method 02
                </div>
                <h3 style={{ textTransform: "uppercase", margin: "0 0 0.5rem 0" }}>
                  Upload Lesion Image
                </h3>
                <p style={{ fontSize: "0.9rem", color: "var(--color-muted-text)", marginBottom: "1.5rem" }}>
                  Submit an existing high-resolution dermascopic JPEG or PNG image from laboratory archives
                  (maximum file size 10MB).
                </p>

                <div style={{ marginBottom: "1.25rem" }}>
                  <input
                    id="image-file-input"
                    type="file"
                    accept="image/jpeg,image/png"
                    onChange={handleFileChange}
                    style={{ padding: "0.5rem" }}
                  />
                </div>

                {fileValidation && (
                  <div
                    style={{
                      fontFamily: "var(--font-mono)",
                      fontSize: "0.8rem",
                      padding: "0.75rem",
                      border: "1px solid #000000",
                      backgroundColor: "var(--color-surface-muted)",
                      marginBottom: "1.25rem",
                    }}
                  >
                    {fileValidation.msg}
                  </div>
                )}

                <button
                  id="btn-upload-submit"
                  className="secondary"
                  disabled={busy || !selectedFile || !fileValidation?.ok}
                  onClick={handleUploadSubmit}
                  style={{ width: "100%" }}
                >
                  {busy ? "Uploading…" : "UPLOAD IMAGE →"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
