import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Patient } from "../api";

export default function Patients() {
  const [rows, setRows] = useState<Patient[]>([]);
  const [name, setName] = useState("");
  const [search, setSearch] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = (q?: string) => {
    setLoading(true);
    api.patients.list(q).then(setRows).catch((e: Error) => setErr(e.message)).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, []);

  const handleSearch = () => load(search || undefined);

  return (
    <div>
      <h2>Patients</h2>
      <p className="info">Synthetic / demo identities only. Patient IDs are auto-generated.</p>
      {err && <p className="error">{err}</p>}
      {success && <p className="success">{success}</p>}

      <div className="card">
        <h3>Register new patient</h3>
        <div className="form-row">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Display name"
            aria-label="Patient display name"
          />
          <button
            disabled={!name.trim()}
            onClick={() => {
              setErr(null);
              setSuccess(null);
              api.patients
                .create({ display_name: name.trim() })
                .then((p) => {
                  setSuccess(`Registered ${p.patient_code}: ${p.display_name}`);
                  setName("");
                  load();
                })
                .catch((e: Error) => setErr(e.message));
            }}
          >
            Register
          </button>
        </div>
      </div>

      <div className="card">
        <h3>Search</h3>
        <div className="form-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or code…"
            aria-label="Search patients"
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          />
          <button className="secondary" onClick={handleSearch}>Search</button>
          {search && <button className="secondary" onClick={() => { setSearch(""); load(); }}>Clear</button>}
        </div>
      </div>

      {loading ? (
        <p className="loading">Loading patients…</p>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <h3>No patients found</h3>
          <p>{search ? "Try a different search term." : "Register a patient above to get started."}</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link to={`/patients/${p.id}`}>{p.patient_code}</Link>
                </td>
                <td>{p.display_name}</td>
                <td style={{ color: "var(--color-text-subtle)", fontSize: "0.85rem" }}>
                  {p.notes || "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
