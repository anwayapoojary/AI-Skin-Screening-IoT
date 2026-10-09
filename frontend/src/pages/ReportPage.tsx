import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, SCREENING_DISCLAIMER, type Report } from "../api";

export default function ReportPage() {
  const { id } = useParams();
  const [r, setR] = useState<Report | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.reports
      .get(Number(id))
      .then(setR)
      .catch((e: Error) => setErr(e.message));
  }, [id]);

  if (err) return <div className="notice-error">{err}</div>;
  if (!r) return <p className="loading">Compiling clinical documentation dossier…</p>;

  return (
    <div>
      <div className="no-print">
        <div className="editorial-kicker">Clinical Dossier Export · Official Document Format</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <Link to="/reports" style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", textTransform: "uppercase" }}>
            ← Back to Report Index
          </Link>
          <button onClick={() => window.print()}>
            Print / Save as PDF
          </button>
        </div>
        <hr className="rule-heavy" />
      </div>

      {/* Formal Medical Document Container */}
      <div
        className="card-heavy"
        style={{
          padding: "3.5rem",
          maxWidth: "880px",
          margin: "0 auto 3rem auto",
          backgroundColor: "#FFFFFF",
          border: "3px solid #000000",
        }}
      >
        {/* Document Header */}
        <div style={{ borderBottom: "4px solid #000000", paddingBottom: "1.5rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", letterSpacing: "0.15em", textTransform: "uppercase", color: "var(--color-muted-text)", marginBottom: "0.35rem" }}>
                LABORATORY CLINICAL DOSSIER
              </div>
              <h1 style={{ fontFamily: "var(--font-display)", fontSize: "2.2rem", textTransform: "uppercase", margin: 0, fontWeight: 900 }}>
                {r.title || "AI Health Screening Report"}
              </h1>
            </div>
            <div style={{ textAlign: "right", fontFamily: "var(--font-mono)", fontSize: "0.8rem" }}>
              <div><strong>DOC REF:</strong> #{r.screening_id}</div>
              <div><strong>PROTOCOL:</strong> v1.0-STD</div>
            </div>
          </div>
        </div>

        {/* Patient Identification Metadata */}
        <div style={{ marginBottom: "2rem" }}>
          <h4 style={{ borderBottom: "1px solid #000000", paddingBottom: "0.5rem", marginBottom: "1rem" }}>
            Subject Identification
          </h4>
          <table style={{ margin: 0 }}>
            <tbody>
              <tr>
                <td style={{ width: "200px" }}><strong>Patient Full Name</strong></td>
                <td><strong>{r.patient_display_name}</strong></td>
                <td style={{ width: "160px" }}><strong>Subject Code</strong></td>
                <td style={{ fontFamily: "var(--font-mono)" }}>{r.patient_code}</td>
              </tr>
              <tr>
                <td><strong>Examination Date</strong></td>
                <td style={{ fontSize: "0.9rem" }}>
                  {r.date ? new Date(r.date).toLocaleString() : "—"}
                </td>
                <td><strong>Instrument ID</strong></td>
                <td style={{ fontFamily: "var(--font-mono)" }}>{r.device_id ?? "DEVICE_001"}</td>
              </tr>
            </tbody>
          </table>
        </div>

        {/* Screening Result & Clinical Assessment */}
        <div style={{ marginBottom: "2rem" }}>
          <h4 style={{ borderBottom: "1px solid #000000", paddingBottom: "0.5rem", marginBottom: "1rem" }}>
            Dermatological Screening Assessment
          </h4>
          <table style={{ margin: 0 }}>
            <tbody>
              <tr>
                <td style={{ width: "200px" }}><strong>Neural Model Finding</strong></td>
                <td>
                  <span style={{ fontFamily: "var(--font-display)", fontSize: "1.4rem", fontWeight: 900, textTransform: "uppercase" }}>
                    {r.uncertain ? "Uncertain, needs review" : r.top_name || r.prediction}
                  </span>{" "}
                  {r.is_mock === true && <span className="badge warn" style={{ marginLeft: "0.5rem" }}>Mock AI</span>}
                </td>
              </tr>
              <tr>
                <td><strong>Prediction Confidence</strong></td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: "1.05rem", fontWeight: 700 }}>
                  {r.confidence != null ? `${(r.confidence * 100).toFixed(1)}%` : "—"}
                </td>
              </tr>
              <tr>
                <td><strong>Image source</strong></td>
                <td>{r.source || "—"}</td>
              </tr>
              <tr>
                <td><strong>Optical Quality Status</strong></td>
                <td style={{ fontFamily: "var(--font-mono)" }}>
                  {r.image_quality_status ?? "PASSED"}
                </td>
              </tr>
              <tr>
                <td><strong>AI Model Pipeline</strong></td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                  {r.model_name ?? "ScreeningModel"} · {r.model_version ?? "v1.0.0"}
                </td>
              </tr>
              <tr>
                <td><strong>Firmware Build</strong></td>
                <td style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem" }}>
                  {r.firmware_version ?? "v1.0.0"}
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <section style={{ marginBottom: "2rem" }}>
          <h4>Class probabilities</h4>
          {Object.entries(r.probabilities ?? {}).map(([label, probability]) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--color-border)", padding: "0.35rem 0" }}>
              <span>{label}</span>
              <span>{(probability * 100).toFixed(1)}%</span>
            </div>
          ))}
        </section>

        <section style={{ marginBottom: "2rem" }}>
          <h4>Model limitations</h4>
          <ul>
            {(r.model_limitations ?? []).map((limitation) => <li key={limitation}>{limitation}</li>)}
          </ul>
          <p><strong>Not validated on device images.</strong></p>
        </section>

        {/* Mandatory Safety Notice Block */}
        <div
          style={{
            border: "2px solid #000000",
            padding: "1.5rem",
            backgroundColor: "var(--color-surface-muted)",
            marginTop: "2rem",
          }}
        >
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: "0.5rem" }}>
            MANDATORY CLINICAL SAFETY DISCLAIMER
          </div>
          <p style={{ margin: 0, fontStyle: "italic", fontSize: "0.9rem", lineHeight: 1.5, color: "var(--color-muted-text)" }}>
            {SCREENING_DISCLAIMER}
          </p>
        </div>

        {/* Signature Line */}
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "3.5rem", paddingTop: "1.5rem", borderTop: "1px solid var(--color-border-light)" }}>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-muted-text)" }}>
            Document generated automatically by AI Skin Screening System.
          </div>
          <div style={{ width: "220px", borderTop: "1px solid #000000", textAlign: "center", paddingTop: "0.5rem", fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
            Authorized Clinician Signature
          </div>
        </div>
      </div>
    </div>
  );
}
