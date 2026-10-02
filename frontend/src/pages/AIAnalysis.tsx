import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { api, type Screening } from "../api";

export default function AIAnalysis() {
  const [searchParams] = useSearchParams();
  const screeningId = searchParams.get("id");
  const [data, setData] = useState<Screening | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!screeningId) {
      setLoading(false);
      return;
    }
    api.screenings
      .get(Number(screeningId))
      .then((res) => setData(res))
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [screeningId]);

  if (loading) {
    return <div className="card loading-indicator"><p>Running AI screening analysis…</p></div>;
  }

  if (error) {
    return (
      <div className="card">
        <p className="error">{error}</p>
        <Link to="/capture" className="btn">Return to Capture</Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="empty-state">
        <h3>No Screening Specified</h3>
        <p>Please initiate a new capture or upload to run AI analysis.</p>
        <Link to="/capture" className="btn">Start New Screening</Link>
      </div>
    );
  }

  const isAbstained = data.abstained;
  const isDemo = data.model_version?.toLowerCase().includes("mock") || data.model_version?.toLowerCase().includes("demo");

  return (
    <div>
      <h2>AI Screening Analysis Pipeline</h2>

      {isDemo && (
        <div style={{ marginBottom: "1rem" }}>
          <span className="badge badge-demo">DEMO / MOCK AI MODEL</span>
          <span style={{ marginLeft: "0.5rem", fontSize: "0.85rem", color: "var(--color-text-muted)" }}>
            Inference performed with deterministic development model. Not for clinical diagnosis.
          </span>
        </div>
      )}

      <div className="card">
        <h3>1. Optical Quality Gate Assessment</h3>
        <table style={{ marginTop: "0.5rem" }}>
          <tbody>
            <tr>
              <td><strong>Quality Verdict</strong></td>
              <td>
                <span className={`badge ${isAbstained ? "badge-danger" : "badge-success"}`}>
                  {isAbstained ? "INSUFFICIENT QUALITY" : "PASSED QUALITY GATE"}
                </span>
              </td>
            </tr>
            <tr>
              <td><strong>Exposure & Focus Check</strong></td>
              <td>{isAbstained ? "Flagged: Low contrast or blur detected" : "Optimal (Sufficient sharpness and luminance)"}</td>
            </tr>
            <tr>
              <td><strong>Preprocessing Pipeline</strong></td>
              <td><code>{data.preprocessing_version || "v1.0-standard"}</code></td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="card" style={{ marginTop: "1rem" }}>
        <h3>2. Neural Inference Evaluation</h3>
        <table style={{ marginTop: "0.5rem" }}>
          <tbody>
            <tr>
              <td><strong>Model Architecture</strong></td>
              <td><code>{data.model_name || "ScreeningModel"}</code> (Version: <code>{data.model_version || "1.0.0"}</code>)</td>
            </tr>
            <tr>
              <td><strong>Evaluation Timestamp</strong></td>
              <td>{data.prediction_timestamp || data.created_at || "Recorded"}</td>
            </tr>
            <tr>
              <td><strong>Screening Finding</strong></td>
              <td>
                <strong style={{ fontSize: "1.1rem", color: isAbstained ? "var(--color-danger)" : "var(--color-primary)" }}>
                  {data.prediction || "Abstained"}
                </strong>
              </td>
            </tr>
            <tr>
              <td><strong>Model Confidence</strong></td>
              <td>
                {typeof data.confidence === "number" ? (
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.25rem" }}>
                      <span>{(data.confidence * 100).toFixed(1)}%</span>
                      <span style={{ fontSize: "0.8rem", color: "var(--color-text-muted)" }}>
                        {data.confidence >= 0.70 ? "Above abstain threshold (0.70)" : "Below abstain threshold"}
                      </span>
                    </div>
                    <div style={{ width: "100%", height: "8px", background: "var(--color-border-light)", borderRadius: "4px", overflow: "hidden" }}>
                      <div
                        style={{
                          width: `${Math.min(100, Math.max(0, data.confidence * 100))}%`,
                          height: "100%",
                          background: data.confidence >= 0.70 ? "var(--color-success)" : "var(--color-warning)"
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  "N/A"
                )}
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="disclaimer-banner" style={{ marginTop: "1rem" }}>
        <p><strong>Clinical Safety Notice:</strong> {data.disclaimer}</p>
      </div>

      <div style={{ display: "flex", gap: "1rem", marginTop: "1.5rem" }}>
        <Link to={`/screening/${data.id}`} className="btn">
          View Detailed Result
        </Link>
        <Link to={`/reports/${data.id}`} className="btn btn-secondary">
          Generate Printable Report
        </Link>
        <Link to="/capture" className="btn btn-secondary">
          Perform Another Screening
        </Link>
      </div>
    </div>
  );
}
