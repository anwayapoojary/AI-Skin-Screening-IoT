import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Screening } from "../api";

export default function ResultPage() {
  const { id } = useParams();
  const [row, setRow] = useState<Screening | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.screenings.get(Number(id)).then(setRow).catch((e: Error) => setErr(e.message));
  }, [id]);

  if (err) return <p className="error">{err}</p>;
  if (!row) return <p className="loading">Loading result…</p>;

  return (
    <div>
      <h2>Screening Result</h2>
      <div className="card">
        <p>
          <strong>Prediction:</strong>{" "}
          <span style={{ fontSize: "1.1rem", fontWeight: 700 }}>{row.prediction}</span>{" "}
          {row.abstained && <span className="badge warn">abstained</span>}
        </p>
        <p><strong>Confidence:</strong> {row.confidence != null ? (row.confidence * 100).toFixed(1) + "%" : "—"}</p>
        <p><strong>Image quality:</strong> {row.image_quality_status ?? "—"}</p>
        <p><strong>AI model:</strong> {row.model_name ?? "—"} · {row.model_version} · Prep: {row.preprocessing_version}</p>
        <p><strong>Firmware:</strong> {row.device_firmware_version ?? "—"}</p>
        <p><strong>Timestamp:</strong> {row.prediction_timestamp ? new Date(row.prediction_timestamp).toLocaleString() : row.created_at ? new Date(row.created_at).toLocaleString() : "—"}</p>

        <div className="disclaimer">
          ⚠️ {row.disclaimer}
        </div>

        <div style={{ marginTop: "1rem", display: "flex", gap: "0.5rem" }}>
          <Link to={`/reports/${row.id}`}><button>Open screening report</button></Link>
          <Link to="/history"><button className="secondary">Back to history</button></Link>
        </div>
      </div>
    </div>
  );
}
