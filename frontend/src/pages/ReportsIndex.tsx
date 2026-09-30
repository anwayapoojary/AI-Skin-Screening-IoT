import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Screening } from "../api";

export default function ReportsIndex() {
  const [rows, setRows] = useState<Screening[]>([]);
  useEffect(() => {
    api.screenings.list().then(setRows);
  }, []);
  return (
    <div>
      <h2>Reports</h2>
      <p>Screening reports only — not medical certificates.</p>
      <ul>
        {rows.map((s) => (
          <li key={s.id}>
            <Link to={`/reports/${s.id}`}>Report #{s.id}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
