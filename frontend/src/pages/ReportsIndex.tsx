import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Screening } from "../api";

export default function ReportsIndex() {
  const [rows, setRows] = useState<Screening[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.screenings.list().then(setRows).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading">Loading reports…</p>;

  return (
    <div>
      <h2>Reports</h2>
      <p className="warn">Screening reports only — not medical certificates or diagnoses.</p>
      {rows.length === 0 ? (
        <div className="empty-state">
          <h3>No reports available</h3>
          <p>Run a screening first to generate a report.</p>
        </div>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Report</th>
              <th>Patient</th>
              <th>Result</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s.id}>
                <td><Link to={`/reports/${s.id}`}>Report #{s.id}</Link></td>
                <td>{s.patient_id}</td>
                <td>
                  {s.prediction}
                  {s.abstained && <span className="badge warn" style={{ marginLeft: 4 }}>abstained</span>}
                </td>
                <td style={{ fontSize: "0.85rem" }}>
                  {s.created_at ? new Date(s.created_at).toLocaleString() : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
