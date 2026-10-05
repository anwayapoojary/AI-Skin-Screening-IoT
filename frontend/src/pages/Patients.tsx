import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Patient } from "../api";

export default function Patients() {
  const [rows, setRows] = useState<Patient[]>([]);
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [search, setSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = (q?: string) => {
    setLoading(true);
    api.patients
      .list(q)
      .then(setRows)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
  }, []);

  const handleSearch = () => load(search || undefined);

  return (
    <div>
      <div className="editorial-kicker">Clinical Registry · Patient Cohort</div>

      <h1 className="editorial-title">Patients</h1>

      <p className="editorial-subtitle">
        Registry of enrolled individuals. Patient identifiers are sequentially auto-generated
        (PAT-001 format) to maintain clinical anonymization standards.
      </p>

      {err && <div className="notice-error">{err}</div>}
      {success && <div className="notice-editorial">{success}</div>}

      <hr className="rule-heavy" />

      {/* Patient Registration & Search Section */}
      <div className="grid-2" style={{ marginBottom: "2.5rem" }}>
        <div className="card-heavy" style={{ padding: "2rem", margin: 0 }}>
          <h3 style={{ textTransform: "uppercase", marginBottom: "1rem" }}>
            Register New Patient
          </h3>
          <p style={{ fontSize: "0.9rem", color: "var(--color-muted-text)", marginBottom: "1.25rem" }}>
            Enter patient display name and initial clinical notes. System generates sequential ID.
          </p>

          <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Display name"
              aria-label="Patient display name"
            />
            <input
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Clinical observation notes (optional)"
              aria-label="Patient notes"
            />
            <button
              disabled={!name.trim()}
              onClick={() => {
                setErr(null);
                setSuccess(null);
                api.patients
                  .create({ display_name: name.trim(), notes: notes.trim() || undefined })
                  .then((p) => {
                    setSuccess(`Registered ${p.patient_code}: ${p.display_name}`);
                    setName("");
                    setNotes("");
                    load();
                  })
                  .catch((e: Error) => setErr(e.message));
              }}
            >
              Register Patient →
            </button>
          </div>
        </div>

        <div className="card" style={{ padding: "2rem", margin: 0 }}>
          <h3 style={{ textTransform: "uppercase", marginBottom: "1rem" }}>
            Filter Registry
          </h3>
          <p style={{ fontSize: "0.9rem", color: "var(--color-muted-text)", marginBottom: "1.25rem" }}>
            Query the active records by patient identifier code or patient name.
          </p>

          <div style={{ display: "flex", gap: "0.75rem", marginBottom: "1rem" }}>
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or code…"
              aria-label="Search patients"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
            <button className="secondary" onClick={handleSearch} style={{ flexShrink: 0 }}>
              Search
            </button>
          </div>
          {search && (
            <button
              className="ghost"
              onClick={() => {
                setSearch("");
                load();
              }}
            >
              Clear filter
            </button>
          )}
        </div>
      </div>

      <hr className="rule-thin" />

      {/* Patient Records Editorial Table */}
      <div style={{ marginTop: "2rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" }}>
          <h3 style={{ textTransform: "uppercase", margin: 0 }}>Patient Records</h3>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--color-muted-text)" }}>
            Total Cohort: {rows.length}
          </span>
        </div>

        {loading ? (
          <p className="loading">Loading patients…</p>
        ) : rows.length === 0 ? (
          <div className="empty-state">
            <h3>No patients found</h3>
            <p>{search ? "Try a different search query." : "Register a patient above to get started."}</p>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ width: "140px" }}>ID / Code</th>
                <th>Patient Name</th>
                <th>Clinical Notes</th>
                <th style={{ width: "140px", textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((p) => (
                <tr key={p.id}>
                  <td>
                    <Link
                      to={`/patients/${p.id}`}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontWeight: 700,
                        textDecoration: "underline",
                      }}
                    >
                      {p.patient_code}
                    </Link>
                  </td>
                  <td>
                    <strong style={{ fontFamily: "var(--font-body)", fontSize: "1.05rem" }}>
                      {p.display_name}
                    </strong>
                  </td>
                  <td style={{ color: "var(--color-muted-text)", fontSize: "0.9rem" }}>
                    {p.notes || "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <Link
                      to={`/patients/${p.id}`}
                      style={{
                        fontFamily: "var(--font-mono)",
                        fontSize: "0.8rem",
                        textTransform: "uppercase",
                      }}
                    >
                      View File →
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
