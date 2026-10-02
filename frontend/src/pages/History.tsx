import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Screening } from "../api";

export default function History() {
  const [rows, setRows] = useState<Screening[]>([]);
  const [loading, setLoading] = useState(true);
  const [compare, setCompare] = useState<number[]>([]);

  useEffect(() => {
    api.screenings.list().then(setRows).finally(() => setLoading(false));
  }, []);

  const toggleCompare = (id: number) => {
    setCompare((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 2 ? [...prev, id] : prev
    );
  };

  const compareRows = compare.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as Screening[];

  if (loading) return <p className="loading">Loading history…</p>;

  return (
    <div>
      <h2>Screening History</h2>
      {rows.length === 0 ? (
        <div className="empty-state">
          <h3>No screenings yet</h3>
          <p>Run a screening from the <Link to="/screening/new">New Screening</Link> page.</p>
        </div>
      ) : (
        <>
          <p style={{ fontSize: "0.85rem", color: "var(--color-text-subtle)" }}>
            Select up to 2 screenings to compare.
          </p>
          <table>
            <thead>
              <tr>
                <th></th>
                <th>ID</th>
                <th>Patient</th>
                <th>Result</th>
                <th>Confidence</th>
                <th>Model</th>
                <th>Date</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <input
                      type="checkbox"
                      checked={compare.includes(s.id)}
                      onChange={() => toggleCompare(s.id)}
                      disabled={!compare.includes(s.id) && compare.length >= 2}
                      aria-label={`Compare screening ${s.id}`}
                    />
                  </td>
                  <td><Link to={`/screening/${s.id}`}>#{s.id}</Link></td>
                  <td>{s.patient_id}</td>
                  <td>
                    {s.prediction}
                    {s.abstained && <span className="badge warn" style={{ marginLeft: 4 }}>abstained</span>}
                  </td>
                  <td>{s.confidence != null ? (s.confidence * 100).toFixed(1) + "%" : "—"}</td>
                  <td style={{ fontSize: "0.8rem", color: "var(--color-text-subtle)" }}>{s.model_version}</td>
                  <td style={{ fontSize: "0.8rem" }}>
                    {s.created_at ? new Date(s.created_at).toLocaleString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {compareRows.length === 2 && (
            <div className="card" style={{ marginTop: "1rem" }}>
              <h3>Comparison</h3>
              <table>
                <thead>
                  <tr><th></th><th>Screening #{compareRows[0].id}</th><th>Screening #{compareRows[1].id}</th></tr>
                </thead>
                <tbody>
                  <tr><td><strong>Prediction</strong></td><td>{compareRows[0].prediction}</td><td>{compareRows[1].prediction}</td></tr>
                  <tr><td><strong>Confidence</strong></td><td>{compareRows[0].confidence != null ? (compareRows[0].confidence * 100).toFixed(1) + "%" : "—"}</td><td>{compareRows[1].confidence != null ? (compareRows[1].confidence * 100).toFixed(1) + "%" : "—"}</td></tr>
                  <tr><td><strong>Abstained</strong></td><td>{compareRows[0].abstained ? "Yes" : "No"}</td><td>{compareRows[1].abstained ? "Yes" : "No"}</td></tr>
                  <tr><td><strong>Model</strong></td><td>{compareRows[0].model_version}</td><td>{compareRows[1].model_version}</td></tr>
                  <tr><td><strong>Quality</strong></td><td>{compareRows[0].image_quality_status}</td><td>{compareRows[1].image_quality_status}</td></tr>
                  <tr><td><strong>Date</strong></td><td>{compareRows[0].created_at ? new Date(compareRows[0].created_at).toLocaleString() : "—"}</td><td>{compareRows[1].created_at ? new Date(compareRows[1].created_at).toLocaleString() : "—"}</td></tr>
                </tbody>
              </table>
              <button className="secondary" onClick={() => setCompare([])}>Clear comparison</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
