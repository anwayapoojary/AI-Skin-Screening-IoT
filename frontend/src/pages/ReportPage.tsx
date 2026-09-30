import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type Report } from "../api";

export default function ReportPage() {
  const { id } = useParams();
  const [r, setR] = useState<Report | null>(null);
  useEffect(() => {
    api.reports.get(Number(id)).then(setR);
  }, [id]);
  if (!r) return <p>Loading…</p>;
  return (
    <div>
      <h2>{r.title}</h2>
      <div className="card">
        <p>Patient: {r.patient_display_name} ({r.patient_code})</p>
        <p>Screening ID: {r.screening_id}</p>
        <p>Date: {r.date}</p>
        <p>Device ID: {r.device_id}</p>
        <p>
          Result: {r.prediction} · confidence {r.confidence} {r.abstained ? "(abstained)" : ""}
        </p>
        <p>AI model: {r.model_version} · firmware: {r.firmware_version}</p>
        <p>Image quality: {r.image_quality_status}</p>
        <p className="warn">{r.disclaimer}</p>
      </div>
    </div>
  );
}
