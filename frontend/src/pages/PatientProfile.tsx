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
    api.patients.get(pid).then((p) => {
      setPatient(p);
      setEditName(p.display_name);
      setEditNotes(p.notes || "");
    }).catch((e: Error) => setErr(e.message));
    api.screenings.list(pid).then(setRows).catch(() => {});
  }, [pid]);

  if (err && !patient) return <p className="error">{err}</p>;
  if (!patient) return <p className="loading">Loading…</p>;

  const handleSave = () => {
    api.patients.update(pid, { display_name: editName, notes: editNotes })
      .then((p) => {
        setPatient(p);
        setEditing(false);
        setSuccess("Patient updated.");
      })
      .catch((e: Error) => setErr(e.message));
  };

  return (
    <div>
      <h2>{patient.display_name}</h2>
      {err && <p className="error">{err}</p>}
      {success && <p className="success">{success}</p>}

      <div className="card">
        <p><strong>Code:</strong> {patient.patient_code}</p>
        {editing ? (
          <>
            <div className="form-row">
              <input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Name" />
            </div>
            <div className="form-row">
              <textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Notes" rows={3} style={{ width: "100%" }} />
            </div>
            <button onClick={handleSave}>Save</button>{" "}
            <button className="secondary" onClick={() => setEditing(false)}>Cancel</button>
          </>
        ) : (
          <>
            <p><strong>Notes:</strong> {patient.notes || "—"}</p>
            <button className="secondary" onClick={() => setEditing(true)}>Edit</button>
          </>
        )}
      </div>

      <div className="card">
        <Link to={`/screening/new?patient=${pid}`}>
          <button>New screening</button>
        </Link>
      </div>

      <h3>Screening history</h3>
      {rows.length === 0 ? (
        <div className="empty-state">
          <h3>No screenings</h3>
          <p>Start a screening for this patient above.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr><th>ID</th><th>Result</th><th>Confidence</th><th>Model</th><th>Date</th></tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td><Link to={`/screening/${s.id}`}>#{s.id}</Link></td>
                <td>
                  {s.prediction}{" "}
                  {s.abstained && <span className="badge warn">abstained</span>}
                </td>
                <td>{s.confidence != null ? (s.confidence * 100).toFixed(1) + "%" : "—"}</td>
                <td style={{ fontSize: "0.8rem", color: "var(--color-text-subtle)" }}>{s.model_version}</td>
                <td style={{ fontSize: "0.8rem" }}>{s.created_at ? new Date(s.created_at).toLocaleString() : "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
