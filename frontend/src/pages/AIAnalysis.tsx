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
    return <p className="loading">Executing neural screening pipeline…</p>;
  }

  if (error) {
    return (
      <div className="card-heavy" style={{ backgroundColor: "#000000", color: "#FFFFFF", padding: "2rem" }}>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.12em", marginBottom: "0.5rem" }}>
          ANALYSIS PIPELINE ERROR
        </div>
        <p style={{ color: "#FFFFFF", margin: "1rem 0" }}>{error}</p>
        <Link to="/capture">
          <button style={{ backgroundColor: "#FFFFFF", color: "#000000", borderColor: "#FFFFFF" }}>
            Return to Capture
          </button>
        </Link>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="empty-state">
        <h3>No Screening Session Specified</h3>
        <p>Please initiate a new capture or file upload to evaluate AI screening telemetry.</p>
        <Link to="/capture">
          <button>Start New Screening Session →</button>
        </Link>
      </div>
    );
  }

  const isAbstained = data.abstained;
  const isDemo =
    data.model_version?.toLowerCase().includes("mock") ||
    data.model_version?.toLowerCase().includes("demo");

  return (
    <div>
      <div className="editorial-kicker">Neural Inference · Model Evaluation Protocol</div>

      <h1 className="editorial-title">
        AI<br />Analysis
      </h1>

      <p className="editorial-subtitle">
        Automated classification telemetry, optical quality validation, and confidence scores
        derived from convolutional neural networks.
      </p>

      {isDemo && (
        <div className="notice-editorial">
          <div className="notice-header">
            <span>Model Execution Environment</span>
            <span>DEMO / MOCK MODEL</span>
          </div>
          <p>
            Inference performed with deterministic development model. Results are for software testing
            and demonstration purposes only — not for clinical diagnosis.
          </p>
        </div>
      )}

      <hr className="rule-heavy" />

      {/* Main Analysis Display Grid */}
      <div className="grid-2" style={{ marginBottom: "2.5rem" }}>
        {/* Left Column: Image & Optical Quality Gate */}
        <div>
          <div className="card-heavy" style={{ padding: "2rem", margin: 0 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", textTransform: "uppercase", marginBottom: "0.5rem" }}>
              01 Optical Frame Assessment
            </div>
            <h3 style={{ textTransform: "uppercase", marginBottom: "1rem" }}>Quality Gate</h3>

            {data.image_path ? (
              <div
                className="camera-frame-box"
                style={{
                  border: "2px solid #000000",
                  aspectRatio: "4 / 3",
                  marginBottom: "1.5rem",
                  backgroundColor: "#000000",
                }}
              >
                <img
                  src={`/${data.image_path}`}
                  alt="Assessed dermatological lesion"
                  style={{ objectFit: "contain", width: "100%", height: "100%" }}
                  onError={(e) => {
                    // Fallback to text box if file server path is relative
                    (e.target as HTMLElement).style.display = "none";
                  }}
                />
              </div>
            ) : (
              <div
                className="camera-frame-box"
                style={{
                  border: "2px solid #000000",
                  backgroundColor: "var(--color-surface-muted)",
                  padding: "2rem",
                  textAlign: "center",
                  marginBottom: "1.5rem",
                }}
              >
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.8rem", textTransform: "uppercase" }}>
                  Digital Lesion Frame Captured
                </div>
              </div>
            )}

            <table style={{ margin: 0 }}>
              <tbody>
                <tr>
                  <td><strong>Quality Gate Verdict</strong></td>
                  <td style={{ fontFamily: "var(--font-mono)", textAlign: "right" }}>
                    <span className="badge" style={{ fontWeight: 700 }}>
                      {isAbstained ? "INSUFFICIENT QUALITY" : "PASSED GATE"}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td><strong>Exposure & Sharpness</strong></td>
                  <td style={{ textAlign: "right", color: "var(--color-muted-text)", fontSize: "0.85rem" }}>
                    {isAbstained ? "Flagged: Low contrast or blur" : "Optimal (Clear margins)"}
                  </td>
                </tr>
                <tr>
                  <td><strong>Preprocessing Pipeline</strong></td>
                  <td style={{ fontFamily: "var(--font-mono)", textAlign: "right", fontSize: "0.85rem" }}>
                    {data.preprocessing_version || "v1.0-standard"}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Screening Finding & Confidence */}
        <div>
          <div className="card-heavy" style={{ padding: "2.5rem", margin: 0, height: "100%", boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", textTransform: "uppercase", marginBottom: "0.5rem" }}>
                02 Neural Inference Evaluation
              </div>
              <h3 style={{ textTransform: "uppercase", margin: 0 }}>Screening Result</h3>

              <hr style={{ margin: "1.5rem 0" }} />

              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-muted-text)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
                  SCREENING INDICATION
                </div>
                <div style={{ fontFamily: "var(--font-display)", fontSize: "2rem", fontWeight: 900, textTransform: "uppercase", lineHeight: 1.1 }}>
                  {data.prediction || "Abstained"}
                </div>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-muted-text)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
                  MODEL ARCHITECTURE & VERSION
                </div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.95rem" }}>
                  {data.model_name || "ScreeningModel"} · {data.model_version || "v1.0.0"}
                </div>
              </div>

              <div style={{ marginBottom: "1.5rem" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-muted-text)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
                    CONFIDENCE SCORE
                  </span>
                  <span style={{ fontFamily: "var(--font-mono)", fontSize: "1.25rem", fontWeight: 700 }}>
                    {typeof data.confidence === "number" ? `${(data.confidence * 100).toFixed(1)}%` : "N/A"}
                  </span>
                </div>

                {typeof data.confidence === "number" && (
                  <div style={{ width: "100%", height: "8px", border: "1px solid #000000", backgroundColor: "var(--color-surface-muted)" }}>
                    <div
                      style={{
                        width: `${Math.min(100, Math.max(0, data.confidence * 100))}%`,
                        height: "100%",
                        backgroundColor: "#000000",
                      }}
                    />
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-muted-text)", textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
                  CLINICAL RECOMMENDATION
                </div>
                <p style={{ fontSize: "0.95rem" }}>
                  {isAbstained
                    ? "Re-acquire image under improved lighting conditions with clean focal distance."
                    : data.confidence && data.confidence > 0.8
                    ? "Document findings in clinical registry and schedule standard routine dermatological review."
                    : "Observation recommended. Repeat screening in 4 weeks to evaluate lesion evolution."}
                </p>
              </div>
            </div>

            <div style={{ marginTop: "2rem" }}>
              <div className="disclaimer" style={{ margin: "1rem 0" }}>
                <strong>IMPORTANT:</strong> {data.disclaimer}
              </div>
            </div>
          </div>
        </div>
      </div>

      <hr className="rule-thin" />

      {/* Action Buttons */}
      <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginTop: "1.5rem" }}>
        <Link to={`/screening/${data.id}`}>
          <button>View Full Result Dossier →</button>
        </Link>
        <Link to={`/reports/${data.id}`}>
          <button className="secondary">Generate Printable Clinical Report</button>
        </Link>
        <Link to="/capture">
          <button className="secondary">Perform Another Screening</button>
        </Link>
      </div>
    </div>
  );
}
