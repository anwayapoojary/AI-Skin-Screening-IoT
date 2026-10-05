import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Screening } from "../api";

export default function ReportsIndex() {
  const [rows, setRows] = useState<Screening[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.screenings.list().then(setRows).finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading">Loading clinical report index…</p>;

  return (
    <div>
      <div className="editorial-kicker">Clinical Dossiers · Documentation Archive</div>

      <h1 className="editorial-title">Reports</h1>

      <p className="editorial-subtitle">
        Official clinical documentation and diagnostic preliminary screening summaries.
      </p>

      <div className="notice-editorial">
        <div className="notice-header">
          <span>Regulatory Notice</span>
          <span>SCREENING REPORTS ONLY</span>
        </div>
        <p>
          Screening reports only — not medical certificates or diagnostic statements.
          All findings require qualified dermatological evaluation before medical action.
        </p>
      </div>

      <hr className="rule-heavy" />

      {rows.length === 0 ? (
        <div className="empty-state">
          <h3>No reports available</h3>
          <p>Execute an optical screening to automatically compile and generate clinical reports.</p>
          <Link to="/screening/new">
            <button>Initiate Screening →</button>
          </Link>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" }}>
            <h3 style={{ textTransform: "uppercase", margin: 0 }}>Compiled Documents</h3>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
              Total Records: {rows.length}
            </span>
          </div>

          <table>
            <thead>
              <tr>
                <th style={{ width: "160px" }}>Document Reference</th>
                <th>Patient Code</th>
                <th>Screening Verdict</th>
                <th>Date Compiled</th>
                <th style={{ textAlign: "right" }}>Open Document</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <tr key={s.id}>
                  <td>
                    <Link
                      to={`/reports/${s.id}`}
                      style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}
                    >
                      Report #{s.id}
                    </Link>
                  </td>
                  <td>
                    <strong>{s.patient_code || `PAT-${s.patient_id}`}</strong>
                  </td>
                  <td>
                    <strong>{s.prediction}</strong>
                    {s.abstained && <span className="badge" style={{ marginLeft: 8 }}>abstained</span>}
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
                      View Report →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
