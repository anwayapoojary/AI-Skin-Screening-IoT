import { useEffect, useState } from "react";
import { api, type Patient, type Reminder } from "../api";

export default function Reminders() {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [rows, setRows] = useState<Reminder[]>([]);
  const [pid, setPid] = useState<number | "">("");
  const [medicine, setMedicine] = useState("");
  const [dosage, setDosage] = useState("");
  const [freq, setFreq] = useState("Twice daily");
  const [time, setTime] = useState("09:00");
  const [start, setStart] = useState("2026-10-05");
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    api.reminders
      .list()
      .then(setRows)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    api.patients
      .list()
      .then((p) => {
        setPatients(p);
        if (p[0]) setPid(p[0].id);
      })
      .catch(() => {});
    load();
  }, []);

  const active = rows.filter((r) => r.is_active);
  const completed = rows.filter((r) => !r.is_active);

  return (
    <div>
      <div className="editorial-kicker">Clinical Regimen · Prescription Schedule</div>

      <h1 className="editorial-title">Reminders</h1>

      <p className="editorial-subtitle">
        Supervised medication reminders and post-screening dermatological care schedules.
      </p>

      <div className="notice-editorial">
        <div className="notice-header">
          <span>Authorization Policy</span>
          <span>HUMAN SUPERVISION REQUIRED</span>
        </div>
        <p>
          Entered by an authorized person only — never auto-prescribed from AI output.
          All dosage adjustments must be directly verified by a licensed clinician.
        </p>
      </div>

      {err && <div className="notice-error">{err}</div>}
      {success && <div className="notice-editorial">{success}</div>}

      <hr className="rule-heavy" />

      {/* Add Reminder Form */}
      <div className="card-heavy" style={{ padding: "2rem", marginBottom: "2.5rem" }}>
        <h3 style={{ textTransform: "uppercase", marginBottom: "1rem" }}>
          Schedule Medication Reminder
        </h3>

        <div className="form-row">
          <div style={{ flex: 1, minWidth: "220px" }}>
            <label style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "0.35rem" }}>
              Patient
            </label>
            <select value={pid} onChange={(e) => setPid(Number(e.target.value))} aria-label="Patient">
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.patient_code} — {p.display_name}
                </option>
              ))}
            </select>
          </div>

          <div style={{ flex: 2, minWidth: "220px" }}>
            <label style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "0.35rem" }}>
              Prescription / Medicine
            </label>
            <input
              value={medicine}
              onChange={(e) => setMedicine(e.target.value)}
              placeholder="e.g. Hydrocortisone cream 1%"
              aria-label="Medicine"
            />
          </div>

          <div style={{ flex: 2, minWidth: "220px" }}>
            <label style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "0.35rem" }}>
              Dosage Instructions
            </label>
            <input
              value={dosage}
              onChange={(e) => setDosage(e.target.value)}
              placeholder="e.g. Apply thin layer"
              aria-label="Dosage"
            />
          </div>
        </div>

        <div className="form-row" style={{ alignItems: "flex-end" }}>
          <div style={{ flex: 1, minWidth: "160px" }}>
            <label style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "0.35rem" }}>
              Frequency
            </label>
            <input
              value={freq}
              onChange={(e) => setFreq(e.target.value)}
              placeholder="e.g. Twice daily"
              aria-label="Frequency"
            />
          </div>

          <div style={{ flex: 1, minWidth: "140px" }}>
            <label style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "0.35rem" }}>
              Reminder Time
            </label>
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              aria-label="Time"
            />
          </div>

          <div style={{ flex: 1, minWidth: "160px" }}>
            <label style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", textTransform: "uppercase", display: "block", marginBottom: "0.35rem" }}>
              Start Date
            </label>
            <input
              type="date"
              value={start}
              onChange={(e) => setStart(e.target.value)}
              aria-label="Start Date"
            />
          </div>

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
                  setSuccess("Reminder schedule logged.");
                  setMedicine("");
                  setDosage("");
                  load();
                })
                .catch((e: Error) => setErr(e.message));
            }}
          >
            Add Reminder Schedule →
          </button>
        </div>
      </div>

      <hr className="rule-thin" />

      {/* Active & Deactivated Reminders Tables */}
      {loading ? (
        <p className="loading">Loading clinical schedules…</p>
      ) : rows.length === 0 ? (
        <div className="empty-state">
          <h3>No Reminders Configured</h3>
          <p>Schedule a prescription or follow-up examination reminder using the form above.</p>
        </div>
      ) : (
        <div>
          <div style={{ marginBottom: "2.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" }}>
              <h3 style={{ textTransform: "uppercase", margin: 0 }}>
                Active Schedules ({active.length})
              </h3>
            </div>

            {active.length === 0 ? (
              <p style={{ color: "var(--color-muted-text)" }}>No active schedules.</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Dosage</th>
                    <th>Scheduled Time</th>
                    <th>Frequency</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {active.map((r) => (
                    <tr key={r.id}>
                      <td><strong>{r.medicine}</strong></td>
                      <td>{r.dosage_text}</td>
                      <td style={{ fontFamily: "var(--font-mono)" }}>{r.reminder_time}</td>
                      <td>{r.frequency}</td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                          <button
                            className="secondary"
                            style={{ fontSize: "0.75rem", padding: "0.4rem 0.75rem", minHeight: "36px" }}
                            onClick={() => api.reminders.update(r.id, { is_active: false }).then(load)}
                          >
                            Deactivate
                          </button>
                          <button
                            className="ghost"
                            style={{ fontSize: "0.75rem", padding: "0.4rem 0.75rem" }}
                            onClick={() => api.reminders.delete(r.id).then(load)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          {completed.length > 0 && (
            <div>
              <h3 style={{ textTransform: "uppercase", marginBottom: "1rem" }}>
                Deactivated Schedules ({completed.length})
              </h3>
              <table>
                <thead>
                  <tr>
                    <th>Medicine</th>
                    <th>Dosage</th>
                    <th>Time</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {completed.map((r) => (
                    <tr key={r.id} style={{ opacity: 0.6 }}>
                      <td>{r.medicine}</td>
                      <td>{r.dosage_text}</td>
                      <td style={{ fontFamily: "var(--font-mono)" }}>{r.reminder_time}</td>
                      <td style={{ textAlign: "right" }}>
                        <div style={{ display: "inline-flex", gap: "0.5rem" }}>
                          <button
                            className="secondary"
                            style={{ fontSize: "0.75rem", padding: "0.4rem 0.75rem", minHeight: "36px" }}
                            onClick={() => api.reminders.update(r.id, { is_active: true }).then(load)}
                          >
                            Reactivate
                          </button>
                          <button
                            className="ghost"
                            style={{ fontSize: "0.75rem", padding: "0.4rem 0.75rem" }}
                            onClick={() => api.reminders.delete(r.id).then(load)}
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
