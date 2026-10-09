import { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, SCREENING_DISCLAIMER, type Screening } from "../api";

export default function History() {
  const [rows, setRows] = useState<Screening[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [compare, setCompare] = useState<number[]>([]);

  useEffect(() => {
    api.screenings
      .list()
      .then(setRows)
      .catch((reason: Error) => setError(reason.message))
      .finally(() => setLoading(false));
  }, []);

  const toggleCompare = (id: number) => {
    setCompare((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.length < 2 ? [...prev, id] : prev
    );
  };

  const compareRows = compare.map((id) => rows.find((r) => r.id === id)).filter(Boolean) as Screening[];

  if (loading) return <p className="loading">Loading screening history archive…</p>;
  if (error) return <div className="notice-error" role="alert">{error}</div>;

  return (
    <div>
      <div className="editorial-kicker">Clinical Archive · Longitudinal Tracking</div>

      <h1 className="editorial-title">History</h1>

      <p className="editorial-subtitle">
        Archival records of completed dermatological screenings with multi-session side-by-side
        comparative analysis.
      </p>

      <hr className="rule-heavy" />

      {/* Side-by-Side Comparison Module */}
      {compareRows.length > 0 && (
        <div className="card-heavy" style={{ padding: "2rem", marginBottom: "2.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" }}>
            <h3 style={{ textTransform: "uppercase", margin: 0 }}>
              Longitudinal Comparison ({compareRows.length}/2)
            </h3>
            <button className="ghost" onClick={() => setCompare([])} style={{ fontSize: "0.8rem" }}>
              Clear comparison
            </button>
          </div>

          <div className="grid-2">
            {compareRows.map((s, idx) => (
              <div key={s.id} className="card" style={{ padding: "1.5rem", margin: 0, backgroundColor: "var(--color-surface-muted)" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                  Record {idx + 1} · Case #{s.id}
                </div>
                <table style={{ margin: "0.5rem 0" }}>
                  <tbody>
                    <tr>
                      <td><strong>Patient</strong></td>
                      <td>{s.patient_code || s.patient_id}</td>
                    </tr>
                    <tr>
                      <td><strong>Prediction</strong></td>
                      <td>
                        <strong>{s.uncertain ? "Uncertain, needs review" : s.prediction}</strong>
                        {s.is_mock === true && <span className="badge warn">Mock AI</span>}
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Confidence</strong></td>
                      <td style={{ fontFamily: "var(--font-mono)" }}>
                        {s.confidence != null ? `${(s.confidence * 100).toFixed(1)}%` : "—"}
                      </td>
                    </tr>
                    <tr>
                      <td><strong>Model version</strong></td>
                      <td>{s.model_version || "—"}</td>
                    </tr>
                    <tr>
                      <td><strong>Date</strong></td>
                      <td style={{ fontSize: "0.85rem" }}>
                        {s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}
                      </td>
                    </tr>
                  </tbody>
                </table>
                <Link to={`/screening/${s.id}`}>
                  <button className="secondary" style={{ width: "100%", marginTop: "0.5rem", fontSize: "0.75rem" }}>
                    View Complete Case #{s.id} →
                  </button>
                </Link>
              </div>
            ))}
          </div>
        </div>
      )}

      {rows.length === 0 ? (
        <div className="empty-state">
          <h3>No screenings yet</h3>
          <p>Run a screening from the <Link to="/screening/new">New Screening</Link> page to populate this archive.</p>
          <Link to="/screening/new">
            <button>Start First Screening →</button>
          </Link>
        </div>
      ) : (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" }}>
            <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", color: "var(--color-muted-text)", margin: 0 }}>
              Select checkboxes to compare up to 2 examinations side-by-side.
            </p>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
              Total Screenings: {rows.length}
            </span>
          </div>

          <table>
            <thead>
              <tr>
                <th style={{ width: "40px", textAlign: "center" }}>Compare</th>
                <th style={{ width: "80px" }}>ID</th>
                <th>Patient</th>
                <th>Screening Verdict</th>
                <th>Confidence</th>
                <th>Model Version</th>
                <th>Probabilities</th>
                <th>Timestamp</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((s) => (
                <Fragment key={s.id}>
                <tr>
                  <td style={{ textAlign: "center" }}>
                    <input
                      type="checkbox"
                      checked={compare.includes(s.id)}
                      onChange={() => toggleCompare(s.id)}
                      disabled={!compare.includes(s.id) && compare.length >= 2}
                      aria-label={`Compare screening ${s.id}`}
                      style={{ width: "18px", height: "18px", minHeight: "unset", cursor: "pointer" }}
                    />
                  </td>
                  <td>
                    <Link to={`/screening/${s.id}`} style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>
                      #{s.id}
                    </Link>
                  </td>
                  <td>
                    <strong>{s.patient_code || `PAT-${s.patient_id}`}</strong>
                  </td>
                  <td>
                    <strong>{s.uncertain ? "Uncertain, needs review" : s.prediction}</strong>
                    {s.is_mock === true && <span className="badge warn" style={{ marginLeft: "0.5rem" }}>Mock AI</span>}
                    {s.top3?.map((item) => (
                      <div key={item.label} style={{ fontSize: "0.75rem" }}>
                        {item.name}: {(item.probability * 100).toFixed(1)}%
                      </div>
                    ))}
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>
                    {s.confidence != null ? `${(s.confidence * 100).toFixed(1)}%` : "—"}
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                    {s.model_version || "—"}
                  </td>
                  <td style={{ fontSize: "0.75rem" }}>
                    {Object.entries(s.probabilities ?? {})
                      .map(([label, probability]) => `${label} ${(probability * 100).toFixed(1)}%`)
                      .join(" · ") || "—"}
                  </td>
                  <td style={{ fontSize: "0.85rem" }}>
                    {s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}
                  </td>
                  <td style={{ textAlign: "right" }}>
                    <div style={{ display: "inline-flex", gap: "0.75rem" }}>
                      <Link to={`/screening/${s.id}`} style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", textTransform: "uppercase" }}>
                        View
                      </Link>
                      <Link to={`/reports/${s.id}`} style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", textTransform: "uppercase" }}>
                        Report
                      </Link>
                    </div>
                  </td>
                </tr>
                <tr key={`disclaimer-${s.id}`}>
                  <td colSpan={9} className="disclaimer">
                    {SCREENING_DISCLAIMER}
                  </td>
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
