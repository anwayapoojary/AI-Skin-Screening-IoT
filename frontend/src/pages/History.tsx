import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type Screening } from "../api";

export default function History() {
  const [rows, setRows] = useState<Screening[]>([]);
  useEffect(() => {
    api.screenings.list().then(setRows);
  }, []);
  return (
    <div>
      <h2>Screening history</h2>
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Patient</th>
            <th>Result</th>
            <th>Conf</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id}>
              <td>
                <Link to={`/screening/${s.id}`}>{s.id}</Link>
              </td>
              <td>{s.patient_id}</td>
              <td>{s.prediction}</td>
              <td>{s.confidence}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
