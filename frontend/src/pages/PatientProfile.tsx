import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { api, type Patient, type Screening } from "../api";

export default function PatientProfile() {
  const { id } = useParams();
  const pid = Number(id);
  const [patient, setPatient] = useState<Patient | null>(null);
  const [rows, setRows] = useState<Screening[]>([]);

  useEffect(() => {
    api.patients.get(pid).then(setPatient);
    api.screenings.list(pid).then(setRows);
  }, [pid]);

  if (!patient) return <p>Loading…</p>;
  return (
    <div>
      <h2>{patient.display_name}</h2>
      <p>Code: {patient.patient_code}</p>
      <Link to="/screening/new">New screening</Link>
      <h3>History</h3>
      <ul>
        {rows.map((s) => (
          <li key={s.id}>
            <Link to={`/screening/${s.id}`}>
              #{s.id} {s.prediction} ({s.confidence})
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
