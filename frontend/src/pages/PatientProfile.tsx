import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Patient, type Screening } from "../api";

export default function PatientProfile() {
  const { id } = useParams();
  const pid = Number(id);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [rows, setRows] = useState<Screening[]>([]);
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    api.patients
      .get(pid)
      .then((p) => {
        setPatient(p);
        setEditName(p.display_name);
        setEditNotes(p.notes || "");
      })
      .catch((e: Error) => setErr(e.message));
    api.screenings.list(pid).then(setRows).catch(() => {});
  }, [pid]);

  if (err && !patient) return <div className="notice-error">{err}</div>;
  if (!patient) return <p className="loading">Loading patient file…</p>;

  const handleSave = () => {
    api.patients
      .update(pid, { display_name: editName, notes: editNotes })
      .then((p) => {
        setPatient(p);
        setEditing(false);
        setSuccess("Patient record successfully updated.");
      })
      .catch((e: Error) => setErr(e.message));
  };

  return (
    <div>
      <div className="editorial-kicker">
        Patient Record · File ID: {patient.patient_code}
      </div>

      <h1 className="editorial-title">{patient.display_name}</h1>

      <p className="editorial-subtitle">
        Clinical dossier, historical dermatological screenings, and observation records.
      </p>

      {err && <div className="notice-error">{err}</div>}
      {success && <div className="notice-editorial">{success}</div>}

      <hr className="rule-heavy" />

      {/* Patient Clinical Info Block */}
      <div className="card-heavy" style={{ padding: "2.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.5rem" }}>
          <h3 style={{ textTransform: "uppercase", margin: 0 }}>Clinical Identity Details</h3>
          <span className="badge" style={{ fontSize: "0.8rem", padding: "0.4rem 0.8rem" }}>
            {patient.patient_code}
          </span>
        </div>

        {editing ? (
          <div>
            <div className="form-row">
              <label style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", width: "100%", textTransform: "uppercase" }}>
                Patient Full Name
              </label>
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Full name"
                aria-label="Patient Name"
              />
            </div>
            <div className="form-row">
              <label style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", width: "100%", textTransform: "uppercase" }}>
                Clinical Observation Notes
              </label>
              <textarea
                value={editNotes}
                onChange={(e) => setEditNotes(e.target.value)}
                placeholder="Enter clinical notes, lesion location, medical history…"
                rows={4}
                style={{ width: "100%" }}
                aria-label="Clinical Notes"
              />
            </div>
            <div style={{ display: "flex", gap: "1rem", marginTop: "1rem" }}>
              <button onClick={handleSave}>Save Record Changes</button>
              <button className="secondary" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div>
            <table style={{ margin: "0 0 1.5rem 0" }}>
              <tbody>
                <tr>
                  <td style={{ width: "200px" }}><strong>Identifier Code</strong></td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{patient.patient_code}</td>
                </tr>
                <tr>
                  <td><strong>Display Name</strong></td>
                  <td><strong>{patient.display_name}</strong></td>
                </tr>
                <tr>
                  <td><strong>Observations / Notes</strong></td>
                  <td style={{ color: patient.notes ? "inherit" : "var(--color-muted-text)" }}>
                    {patient.notes || "No notes entered for this patient file."}
                  </td>
                </tr>
              </tbody>
            </table>

            <div style={{ display: "flex", gap: "1rem" }}>
              <button className="secondary" onClick={() => setEditing(true)}>
                Edit Patient Record
              </button>
              <Link to={`/screening/new?patient=${patient.id}`}>
                <button>Initiate Screening for Patient →</button>
              </Link>
            </div>
          </div>
        )}
      </div>

      <hr className="rule-thin" />

      {/* Historical Screenings for Patient */}
      <div style={{ marginTop: "2rem" }}>
        <h3 style={{ textTransform: "uppercase", marginBottom: "1rem" }}>
          Screening History for Patient
        </h3>

        {rows.length === 0 ? (
          <div className="empty-state">
            <h3>No Screenings on File</h3>
            <p>No optical examinations have been recorded for this patient yet.</p>
            <Link to={`/screening/new?patient=${patient.id}`}>
              <button>Capture First Screening Image →</button>
            </Link>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th>Screening ID</th>
                <th>AI Prediction</th>
                <th>Confidence</th>
                <th>Model</th>
                <th>Recorded Date</th>
                <th style={{ textAlign: "right" }}>Report</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link
                      to={`/screening/${s.id}`}
                      style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}
                    >
                      #{s.id}
                    </Link>
                  </td>
                  <td>
                    <strong>{s.prediction}</strong>
                    {s.abstained && (
                      <span className="badge" style={{ marginLeft: "0.5rem" }}>
                        Abstained
                      </span>
                    )}
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>
                    {s.confidence != null ? `${(s.confidence * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                    {s.model_version || "MockModel"}
                  </td>
                  <td style={{ fontSize: "0.85rem" }}>
                    {s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link
                      to={`/reports/${s.id}`}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.8rem",
                        textTransform: "uppercase",
                      }}
                    >
                      Report →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
