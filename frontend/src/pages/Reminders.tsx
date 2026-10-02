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
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.reminders.list().then(setRows).finally(() => setLoading(false));
  };

  useEffect(() => {
    api.patients.list().then((p) => {
      setPatients(p);
      if (p[0]) setPid(p[0].id);
    });
    load();
  }, []);

  const active = rows.filter((r) => r.is_active);
  const completed = rows.filter((r) => !r.is_active);

  return (
    <div>
      <h2>Medicine Reminders</h2>
      <p className="warn">Entered by an authorized person only — never auto-prescribed from AI output.</p>
      {err && <p className="error">{err}</p>}
      {success && <p className="success">{success}</p>}

      <div className="card">
        <h3>Add reminder</h3>
        <div className="form-row">
          <select value={pid} onChange={(e) => setPid(Number(e.target.value))} aria-label="Patient">
            {patients.map((p) => (
              <option key={p.id} value={p.id}>{p.display_name}</option>
            ))}
          </select>
          <input value={medicine} onChange={(e) => setMedicine(e.target.value)} placeholder="Medicine" />
          <input value={dosage} onChange={(e) => setDosage(e.target.value)} placeholder="Dosage" />
        </div>
        <div className="form-row">
          <input value={freq} onChange={(e) => setFreq(e.target.value)} placeholder="Frequency" />
          <input type="time" value={time} onChange={(e) => setTime(e.target.value)} />
          <input type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          <button
            disabled={pid === "" || !medicine.trim() || !dosage.trim()}
            onClick={() => {
              if (pid === "") return;
              setErr(null);
              setSuccess(null);
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
                .then(() => {
                  setSuccess("Reminder added.");
                  setMedicine("");
                  setDosage("");
                  load();
                })
                .catch((e: Error) => setErr(e.message));
            }}
          >
            Add
          </button>
        </div>
      </div>

      {loading ? (
        <p className="loading">Loading reminders…</p>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <h3>No reminders</h3>
          <p>Add a reminder above.</p>
        </div>
      ) : (
        <>
          <h3>Active ({active.length})</h3>
          {active.length === 0 ? (
            <p style={{ color: "var(--color-text-subtle)" }}>No active reminders.</p>
          ) : (
            <table>
              <thead><tr><th>Medicine</th><th>Dosage</th><th>Time</th><th>Frequency</th><th>Actions</th></tr></thead>
              <tbody>
                {active.map((r) => (
                  <tr key={r.id}>
                    <td>{r.medicine}</td>
                    <td>{r.dosage_text}</td>
                    <td>{r.reminder_time}</td>
                    <td>{r.frequency}</td>
                    <td>
                      <button className="secondary" style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem" }}
                        onClick={() => api.reminders.update(r.id, { is_active: false }).then(load)}>
                        Deactivate
                      </button>{" "}
                      <button className="danger" style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem" }}
                        onClick={() => api.reminders.delete(r.id).then(load)}>
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {completed.length > 0 && (
            <>
              <h3 style={{ marginTop: "1rem" }}>Deactivated ({completed.length})</h3>
              <table>
                <thead><tr><th>Medicine</th><th>Dosage</th><th>Time</th><th>Actions</th></tr></thead>
                <tbody>
                  {completed.map((r) => (
                    <tr key={r.id} style={{ opacity: 0.6 }}>
                      <td>{r.medicine}</td>
                      <td>{r.dosage_text}</td>
                      <td>{r.reminder_time}</td>
                      <td>
                        <button className="secondary" style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem" }}
                          onClick={() => api.reminders.update(r.id, { is_active: true }).then(load)}>
                          Reactivate
                        </button>{" "}
                        <button className="danger" style={{ fontSize: "0.8rem", padding: "0.25rem 0.5rem" }}
                          onClick={() => api.reminders.delete(r.id).then(load)}>
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </>
          )}
        </>
      )}
    </div>
  );
}
