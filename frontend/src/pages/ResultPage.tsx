import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, SCREENING_DISCLAIMER, type Screening } from "../api";

export default function ResultPage() {
  const { id } = useParams();
  const [row, setRow] = useState<Screening | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.screenings
      .get(Number(id))
      .then(setRow)
      .catch((e: Error) => setErr(e.message));
  }, [id]);

  if (err) return <div className="notice-error">{err}</div>;
  if (!row) return <p className="loading">Loading screening result…</p>;

  return (
    <div>
      <div className="editorial-kicker">
        Examination Finding · Case #{row.id} · Subject {row.patient_code || row.patient_id}
      </div>

      <h1 className="editorial-title">
        Screening<br />Result
      </h1>

      <p className="editorial-subtitle">
        Automated image evaluation and clinical telemetry from optical screening session.
      </p>

      <hr className="rule-heavy" />

      <div className="card-heavy" style={{ padding: "2.5rem" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.5rem" }}>
          <h3 style={{ textTransform: "uppercase", margin: 0 }}>Screening Result</h3>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
            Session #{row.id}
          </span>
        </div>

        <table style={{ margin: "0 0 1.5rem 0" }}>
          <tbody>
            <tr>
              <td style={{ width: "220px" }}><strong>Screening indication</strong></td>
              <td>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 900, textTransform: "uppercase" }}>
                  {row.uncertain || row.abstained
                    ? "Uncertain, needs review"
                    : row.top_name || row.prediction}
                </span>{" "}
                {row.is_mock === true && (
                  <span className="badge warn" style={{ marginLeft: "0.5rem" }}>Mock AI</span>
                )}
              </td>
            </tr>
            <tr>
              <td><strong>Confidence Score</strong></td>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: "1.1rem", fontWeight: 700 }}>
                {row.confidence != null ? `${(row.confidence * 100).toFixed(1)}%` : "—"}
              </td>
            </tr>
            <tr>
              <td><strong>AI Model Pipeline</strong></td>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem" }}>
                {row.model_name ?? "ScreeningModel"} · {row.model_version} · Preprocessing: {row.preprocessing_version}
              </td>
            </tr>
            <tr>
              <td><strong>Image source</strong></td>
              <td>{row.source || row.image_source}</td>
            </tr>
            <tr>
              <td><strong>Image quality</strong></td>
              <td>{row.image_quality_status ?? "—"}</td>
            </tr>
            <tr>
              <td><strong>Firmware Telemetry</strong></td>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem" }}>
                {row.device_firmware_version ?? "v1.0.0"}
              </td>
            </tr>
            <tr>
              <td><strong>Evaluation Timestamp</strong></td>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem" }}>
                {row.prediction_timestamp
                  ? new Date(row.prediction_timestamp).toLocaleString()
                  : row.created_at
                  ? new Date(row.created_at).toLocaleString()
                  : "—"}
              </td>
            </tr>
          </tbody>
        </table>

        {(row.uncertain || row.abstained) && (
          <div className="notice-editorial" role="status">
            Uncertain, needs review. Do not treat this result as a confident class prediction.
          </div>
        )}

        <section aria-label="Top three screening probabilities" style={{ margin: "1.5rem 0" }}>
          <h4>Top 3 screening probabilities</h4>
          {row.top3?.map((item) => (
            <div key={item.label} style={{ marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem" }}>
                <span>{item.name}</span>
                <strong>{(item.probability * 100).toFixed(1)}%</strong>
              </div>
              <div
                role="progressbar"
                aria-label={`${item.name} probability`}
                aria-valuenow={item.probability * 100}
                aria-valuemin={0}
                aria-valuemax={100}
                style={{ height: "8px", background: "var(--color-surface-soft)", border: "1px solid var(--color-border)" }}
              >
                <div style={{ width: `${Math.min(100, item.probability * 100)}%`, height: "100%", background: "var(--color-accent)" }} />
              </div>
            </div>
          ))}
        </section>

        <div className="disclaimer">
          <strong>Screening safety notice:</strong> {SCREENING_DISCLAIMER}
        </div>

        <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <Link to={`/reports/${row.id}`}>
            <button>Open screening report →</button>
          </Link>
          <Link to="/records">
            <button className="secondary">Back to records</button>
          </Link>
          <Link to="/screening/new">
            <button className="secondary">New Screening Session</button>
          </Link>
        </div>
      </div>
    </div>
  );
}
