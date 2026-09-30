import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Screening } from "../api";

export default function ResultPage() {
  const { id } = useParams();
  const [row, setRow] = useState<Screening | null>(null);
  useEffect(() => {
    api.screenings.get(Number(id)).then(setRow);
  }, [id]);
  if (!row) return <p>Loading…</p>;
  return (
    <div>
      <h2>Screening result</h2>
      <div className="card">
        <p>
          Prediction: <strong>{row.prediction}</strong>{" "}
          {row.abstained && <span className="badge">abstained</span>}
        </p>
        <p>Confidence: {row.confidence}</p>
        <p>Quality: {row.image_quality_status}</p>
        <p>Model: {row.model_version} · Prep: {row.preprocessing_version}</p>
        <p>Firmware: {row.device_firmware_version}</p>
        <p className="warn">{row.disclaimer}</p>
        <Link to={`/reports/${row.id}`}>Open screening report</Link>
      </div>
    </div>
  );
}
