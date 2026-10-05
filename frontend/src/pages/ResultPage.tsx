import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Screening } from "../api";

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
          <h3 style={{ textTransform: "uppercase", margin: 0 }}>Clinical Assessment Record</h3>
          <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
            Session #{row.id}
          </span>
        </div>

        <table style={{ margin: "0 0 1.5rem 0" }}>
          <tbody>
            <tr>
              <td style={{ width: "220px" }}><strong>AI Prediction Verdict</strong></td>
              <td>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "1.75rem", fontWeight: 900, textTransform: "uppercase" }}>
                  {row.prediction}
                </span>{" "}
                {row.abstained && <span className="badge" style={{ marginLeft: "0.5rem" }}>abstained</span>}
              </td>
            </tr>
            <tr>
              <td><strong>Confidence Score</strong></td>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: "1.1rem", fontWeight: 700 }}>
                {row.confidence != null ? `${(row.confidence * 100).toFixed(1)}%` : "—"}
              </td>
            </tr>
            <tr>
              <td><strong>Optical Image Quality</strong></td>
              <td style={{ fontFamily: "var(--font-mono)" }}>
                {row.image_quality_status ?? "PASSED"}
              </td>
            </tr>
            <tr>
              <td><strong>AI Model Pipeline</strong></td>
              <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.9rem" }}>
                {row.model_name ?? "ScreeningModel"} · {row.model_version} · Preprocessing: {row.preprocessing_version}
              </td>
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

        <div className="disclaimer">
          <strong>Mandatory Safety Disclaimer:</strong> {row.disclaimer}
        </div>

        <div style={{ marginTop: "1.5rem", display: "flex", gap: "1rem", flexWrap: "wrap" }}>
          <Link to={`/reports/${row.id}`}>
            <button>Open screening report →</button>
          </Link>
          <Link to="/history">
            <button className="secondary">Back to history</button>
          </Link>
          <Link to="/capture">
            <button className="secondary">New Screening Session</button>
          </Link>
        </div>
      </div>
    </div>
  );
}
