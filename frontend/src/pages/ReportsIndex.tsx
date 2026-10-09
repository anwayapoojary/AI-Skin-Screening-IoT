import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, SCREENING_DISCLAIMER, type Screening } from "../api";

export default function ReportsIndex() {
  const [rows, setRows] = useState<Screening[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.screenings
      .list()
      .then(setRows)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading">Loading clinical report index…</p>;
  if (error) return <div className="notice-error" role="alert">{error}</div>;

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
        <p>{SCREENING_DISCLAIMER}</p>
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
                <th>Screening Result</th>
                <th>Model Version</th>
                <th>Probabilities</th>
                <th>Date Compiled</th>
                <th style={{ textAlign: "right" }}>Open Document</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <Fragment key={s.id}>
                <tr>
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
                    <strong>{s.uncertain ? "Uncertain, needs review" : s.prediction}</strong>
                    {s.is_mock === true && <span className="badge warn" style={{ marginLeft: 8 }}>Mock AI</span>}
                  </td>
                  <td>{s.model_version || "—"}</td>
                  <td style={{ fontSize: "0.75rem" }}>
                    {Object.entries(s.probabilities ?? {})
                      .map(([label, probability]) => `${label} ${(probability * 100).toFixed(1)}%`)
                      .join(" · ") || "—"}
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
                <tr key={`safety-${s.id}`}>
                  <td colSpan={7} className="disclaimer">{SCREENING_DISCLAIMER}</td>
                </tr>
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
