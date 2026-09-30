import { useEffect, useState } from "react";
import { api, type Patient, type Reminder } from "../api";

export default function Reminders() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [rows, setRows] = useState<Reminder[]>([]);
  const [pid, setPid] = useState<number | "">("");
  const [medicine, setMedicine] = useState("");
  const [dosage, setDosage] = useState("");
  const [freq, setFreq] = useState("once daily");
  const [time, setTime] = useState("09:00");
  const [start, setStart] = useState("2026-01-01");

  const load = () => api.reminders.list().then(setRows);
  useEffect(() => {
    api.patients.list().then((p) => {
      setPatients(p);
      if (p[0]) setPid(p[0].id);
    });
    load();
  }, []);

  return (
    <div>
      <h2>Medicine reminders</h2>
      <p className="warn">Authorized instructions only — never auto-prescribed from AI output.</p>
      <div className="card">
        <select value={pid} onChange={(e) => setPid(Number(e.target.value))}>
          {patients.map((p) => (
            <option key={p.id} value={p.id}>
              {p.display_name}
            </option>
          ))}
        </select>
        <input value={medicine} onChange={(e) => setMedicine(e.target.value)} placeholder="Medicine" />
        <input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="Dosage text" />
        <input value={freq} onChange={(e) => setFreq(e.target.value)} placeholder="Frequency" />
        <input value={time} onChange={(e) => setTime(e.target.value)} placeholder="Time" />
        <input value={start} onChange={(e) => setStart(e.target.value)} placeholder="Start date" />
        <button
          onClick={() => {
            if (pid === "") return;
            api.reminders
              .create({
                patient_id: Number(pid),
                medicine,
                dosage_text: dosage,
                frequency: freq,
                reminder_time: time,
                start_date: start,
                end_date: null,
                notes: null,
              })
              .then(load);
          }}
        >
          Add reminder
        </button>
      </div>
      <ul>
        {rows.map((r) => (
          <li key={r.id}>
            {r.medicine} {r.dosage_text} @ {r.reminder_time} ({r.frequency})
          </li>
        ))}
      </ul>
    </div>
  );
}
