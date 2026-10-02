import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { api, type Report } from "../api";

export default function ReportPage() {
  const { id } = useParams();
  const [r, setR] = useState<Report | null>(null);
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    api.reports.get(Number(id)).then(setR).catch((e: Error) => setErr(e.message));
  }, [id]);

  if (err) return <p className="error">{err}</p>;
  if (!r) return <p className="loading">Loading report…</p>;

  return (
    <div>
      <h2>{r.title}</h2>
      <div className="card">
        <table>
          <tbody>
            <tr><td><strong>Patient</strong></td><td>{r.patient_display_name} ({r.patient_code})</td></tr>
            <tr><td><strong>Screening ID</strong></td><td>{r.screening_id}</td></tr>
            <tr><td><strong>Date</strong></td><td>{r.date ? new Date(r.date).toLocaleString() : "—"}</td></tr>
            <tr><td><strong>Device</strong></td><td>{r.device_id ?? "—"}</td></tr>
            <tr><td><strong>Result</strong></td>
              <td>
                {r.prediction}{" "}
                {r.abstained && <span className="badge warn">abstained</span>}
                {r.confidence != null && ` (${(r.confidence * 100).toFixed(1)}%)`}
              </td>
            </tr>
            <tr><td><strong>AI model</strong></td><td>{r.model_name ?? "—"} · {r.model_version ?? "—"}</td></tr>
            <tr><td><strong>Firmware</strong></td><td>{r.firmware_version ?? "—"}</td></tr>
            <tr><td><strong>Image quality</strong></td><td>{r.image_quality_status ?? "—"}</td></tr>
          </tbody>
        </table>
        <div className="disclaimer">{r.disclaimer}</div>
      </div>
      <button className="no-print" onClick={() => window.print()}>Print / Save as PDF</button>
    </div>
  );
}
