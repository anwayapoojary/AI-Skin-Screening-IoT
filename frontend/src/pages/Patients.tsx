import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Patient } from "../api";

export default function Patients() {
  const [rows, setRows] = useState<Patient[]>([]);
  const [code, setCode] = useState("DEMO-");
  const [name, setName] = useState("");
  const [err, setErr] = useState<string | null>(null);

  const load = () => api.patients.list().then(setRows).catch((e: Error) => setErr(e.message));
  useEffect(() => {
    load();
  }, []);

  return (
    <div>
      <h2>Patients</h2>
      <p className="warn">Synthetic / demo identities only.</p>
      {err && <p className="error">{err}</p>}
      <div className="card">
        <input value={code} onChange={(e) => setCode(e.target.value)} placeholder="Patient ID" />{" "}
        <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" />{" "}
        <button
          onClick={() =>
            api.patients
              .create({ patient_code: code, display_name: name })
              .then(load)
              .catch((e: Error) => setErr(e.message))
          }
        >
          Register
        </button>
      </div>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Code</th>
            <th>Name</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>
                <Link to={`/patients/${p.id}`}>{p.patient_code}</Link>
              </td>
              <td>{p.display_name}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
