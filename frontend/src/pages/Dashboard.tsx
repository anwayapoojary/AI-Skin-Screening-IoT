import { useEffect, useState, useTransition } from "react";
import { Link } from "react-router-dom";
import {
  api,
  SCREENING_DISCLAIMER,
  type DashboardSummary,
  type DeviceLive,
  type Patient,
  type Reminder,
} from "../api";

function localDateString(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export default function Dashboard() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [deviceStatus, setDeviceStatus] = useState<DeviceLive | null>(null);
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [reminders, setReminders] = useState<Reminder[] | null>(null);
  const [patients, setPatients] = useState<Patient[] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Patient[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState<string | null>(null);
  const [reminderActionMsg, setReminderActionMsg] = useState<string | null>(null);
  const [reminderActionError, setReminderActionError] = useState<string | null>(null);

  const fetchDashboardData = async () => {
    setLoading(true);
    setErr(null);
    setSummary(null);
    setReminders(null);
    setPatients(null);

    const results = await Promise.allSettled([
      api.dashboard.summary(),
      api.reminders.list(),
      api.patients.list(),
    ]);
    const failures: string[] = [];
    const errorText = (reason: unknown) =>
      reason instanceof Error ? reason.message : String(reason);

    if (results[0].status === "fulfilled") {
      setSummary(results[0].value);
    } else {
      failures.push(errorText(results[0].reason));
    }
    if (results[1].status === "fulfilled") {
      setReminders(results[1].value);
    } else {
      failures.push(errorText(results[1].reason));
    }
    if (results[2].status === "fulfilled") {
      setPatients(results[2].value);
    } else {
      failures.push(errorText(results[2].reason));
    }

    setErr(failures.length > 0 ? failures.join("; ") : null);
    setLoading(false);
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    let cancelled = false;
    const refreshDevice = () => {
      api.devices
        .live()
        .then(({ devices }) => {
          if (!cancelled) {
            setDeviceStatus(devices.find((device) => device.online) ?? devices[0] ?? null);
            setDeviceError(null);
          }
        })
        .catch((reason: unknown) => {
          if (!cancelled) {
            setDeviceError(reason instanceof Error ? reason.message : String(reason));
          }
        });
    };
    refreshDevice();
    const timer = setInterval(refreshDevice, 3000);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  // Handle patient quick search
  useEffect(() => {
    const q = searchQuery.trim();
    if (!q) {
      setSearchResults([]);
      setIsSearching(false);
      setSearchError(null);
      return;
    }

    setIsSearching(true);
    setSearchError(null);
    let cancelled = false;

    api.patients
      .list(q)
      .then((res) => {
        if (!cancelled) {
          startTransition(() => {
            setSearchResults(res);
            setIsSearching(false);
          });
        }
      })
      .catch((reason: unknown) => {
        if (!cancelled) {
          setIsSearching(false);
          setSearchError(
            reason instanceof Error ? reason.message : String(reason),
          );
        }
      });

    return () => {
      cancelled = true;
    };
  }, [searchQuery]);

  const handleMarkReminderDone = async (reminderId: number) => {
    setReminderActionError(null);
    try {
      await api.reminders.complete(reminderId);
      setReminders((prev) =>
        prev?.map((r) => (r.id === reminderId ? { ...r, completed_today: true } : r)) ?? null
      );
      setReminderActionMsg(`Reminder #${reminderId} marked done for today.`);
      setTimeout(() => setReminderActionMsg(null), 4000);
    } catch (reason: unknown) {
      setReminderActionError(
        reason instanceof Error ? reason.message : String(reason),
      );
    }
  };

  if (loading) {
    return <p className="loading">Loading dashboard…</p>;
  }

  const today = localDateString(new Date());
  const activeReminders = reminders?.filter(
    (reminder) =>
      reminder.is_active && (!reminder.end_date || reminder.end_date >= today),
  ) ?? null;
  const modelBackend = summary?.model_backend ?? summary?.ai_mode;
  const isMockAI = modelBackend === "mock";
  const hasFailedUploads = (summary?.failed_uploads ?? 0) > 0;
  const hasPendingResults = (summary?.pending_results ?? 0) > 0;
  const latestDeviceResult = deviceStatus?.latest_result;

  // Format sync timestamp safely
  const formatSyncTime = (timestamp: string | null | undefined) => {
    if (!timestamp) return "No sync recorded";
    try {
      const d = new Date(timestamp);
      return isNaN(d.getTime()) ? timestamp : d.toLocaleString();
    } catch {
      return timestamp;
    }
  };

  return (
    <div>
      <div className="editorial-kicker">Clinical Overview · Telemetry Summary</div>

      <h1 className="editorial-title">
        Screening<br />Dashboard
      </h1>

      <p className="editorial-subtitle">
        Operational overview of patient admissions, optical hardware telemetry, neural inference, and care schedules.
      </p>

      {/* Error state with retry */}
      {err && (
        <div className="dashboard-error" role="alert">
          <div className="dashboard-error__title">System Error</div>
          <p className="dashboard-error__message">Dashboard data could not be loaded: {err}</p>
          <button className="dashboard-error__button" onClick={fetchDashboardData}>
            Retry Connection
          </button>
        </div>
      )}

      {/* 5. Notices bar */}
      <div className="notice-editorial" style={{ marginBottom: "2rem" }}>
        <div className="notice-header">
          <span>Clinical Safety Notice</span>
          <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
            {isMockAI && (
              <span className="badge warn" style={{ letterSpacing: "0.15em" }}>
                MOCK AI
              </span>
            )}
            <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem" }}>
              SCREENING SUPPORT ONLY
            </span>
          </div>
        </div>
        <p style={{ margin: "0.5rem 0" }}>
          {SCREENING_DISCLAIMER}
        </p>

        {isMockAI && (
          <p style={{ margin: "0.25rem 0 0 0", fontSize: "0.85rem", color: "var(--color-warning)" }}>
            The AI engine is currently operating with the synthetic mock model. Neural predictions are deterministic simulation values.
          </p>
        )}

        {/* Dynamic alerts for failed uploads or pending results */}
        {(hasFailedUploads || hasPendingResults) && (
          <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px dashed var(--color-border)" }}>
            {hasFailedUploads && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.4rem" }}>
                <span style={{ color: "var(--color-danger)", fontSize: "0.85rem" }}>
                  ⚠️ {summary?.failed_uploads} image upload(s) failed optical quality gates.
                </span>
                <Link to="/history" style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", textDecoration: "underline" }}>
                  Inspect in History →
                </Link>
              </div>
            )}
            {hasPendingResults && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: "var(--color-warning)", fontSize: "0.85rem" }}>
                  ⏳ {summary?.pending_results} screening result(s) pending neural evaluation.
                </span>
                <Link to="/history" style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", textDecoration: "underline" }}>
                  Review in History →
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      <hr className="rule-heavy" />

      {/* 1. Summary Cards Grid */}
      <div style={{ marginBottom: "2.5rem" }}>
        <h3 style={{ textTransform: "uppercase", marginBottom: "1rem" }}>
          Clinical Summary
        </h3>

        <div className="grid-4">
          {/* Summary Card 1: Total Patients */}
          <div className="card" style={{ padding: "1.5rem", margin: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--color-muted)", marginBottom: "0.5rem" }}>
                TOTAL PATIENTS
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", fontWeight: 700, lineHeight: 1 }}>
                {summary?.total_patients ?? "—"}
              </div>
              <p style={{ fontSize: "0.85rem", margin: "0.5rem 0 1rem 0" }}>
                {summary
                  ? summary.total_patients === 0
                    ? "No patients enrolled"
                    : "Enrolled patient profiles"
                  : "Patient total unavailable"}
              </p>
            </div>
            <Link to="/patients" style={{ textDecoration: "none" }}>
              <button className="secondary" style={{ width: "100%", fontSize: "0.72rem", padding: "0.45rem" }}>
                Patients Directory →
              </button>
            </Link>
          </div>

          {/* Summary Card 2: Screenings Today / This Week */}
          <div className="card" style={{ padding: "1.5rem", margin: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--color-muted)", marginBottom: "0.5rem" }}>
                SCREENINGS TODAY / WEEK
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem" }}>
                <span style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", fontWeight: 700, lineHeight: 1 }}>
                  {summary?.screenings_today ?? "—"}
                </span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "0.85rem", color: "var(--color-muted)" }}>
                  today
                </span>
              </div>
              <p style={{ fontSize: "0.85rem", margin: "0.5rem 0 1rem 0" }}>
                {summary
                  ? `${summary.screenings_this_week} screenings this week`
                  : "Screening totals unavailable"}
              </p>
            </div>
            <Link to="/history" style={{ textDecoration: "none" }}>
              <button className="secondary" style={{ width: "100%", fontSize: "0.72rem", padding: "0.45rem" }}>
                Screening History →
              </button>
            </Link>
          </div>

          {/* Summary Card 3: Pending Results */}
          <div className="card" style={{ padding: "1.5rem", margin: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--color-muted)", marginBottom: "0.5rem" }}>
                PENDING RESULTS
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", fontWeight: 700, lineHeight: 1 }}>
                {summary?.pending_results ?? "—"}
              </div>
              <p style={{ fontSize: "0.85rem", margin: "0.5rem 0 1rem 0" }}>
                {summary
                  ? summary.pending_results === 0
                    ? "All analyses completed"
                    : "Awaiting evaluation"
                  : "Pending results unavailable"}
              </p>
            </div>
            <Link to="/history" style={{ textDecoration: "none" }}>
              <button className="secondary" style={{ width: "100%", fontSize: "0.72rem", padding: "0.45rem" }}>
                Review Queue →
              </button>
            </Link>
          </div>

          {/* Summary Card 4: Upcoming Reminders */}
          <div className="card" style={{ padding: "1.5rem", margin: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.7rem", color: "var(--color-muted)", marginBottom: "0.5rem" }}>
                UPCOMING REMINDERS
              </div>
              <div style={{ fontFamily: "var(--font-display)", fontSize: "2.4rem", fontWeight: 700, lineHeight: 1 }}>
                {summary?.upcoming_reminders ?? "—"}
              </div>
              <p style={{ fontSize: "0.85rem", margin: "0.5rem 0 1rem 0" }}>
                {summary
                  ? summary.upcoming_reminders === 0
                    ? "No active regimens"
                    : "Active schedules configured"
                  : "Reminder total unavailable"}
              </p>
            </div>
            <Link to="/reminders" style={{ textDecoration: "none" }}>
              <button className="secondary" style={{ width: "100%", fontSize: "0.72rem", padding: "0.45rem" }}>
                Manage Reminders →
              </button>
            </Link>
          </div>
        </div>
      </div>

      <hr className="rule-thin" />

      {/* 2. Quick Actions + patient search */}
      <div className="card-heavy" style={{ padding: "2rem", marginBottom: "2.5rem" }}>
          <h3 style={{ textTransform: "uppercase", marginBottom: "0.5rem" }}>
            Quick Actions
          </h3>
          <p style={{ fontSize: "0.9rem", color: "var(--color-muted)", marginBottom: "1.5rem" }}>
            Fast-track clinical intake and patient examination workflows.
          </p>

          <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "1.5rem" }}>
            <Link to="/screening/new">
              <button>Start Screening →</button>
            </Link>
            <Link to="/patients">
              <button className="secondary">New Patient</button>
            </Link>
          </div>

          {/* Patient Search Bar */}
          <div>
            <label
              htmlFor="patient-search-input"
              style={{
                display: "block",
                fontFamily: "var(--font-mono)",
                fontSize: "0.72rem",
                textTransform: "uppercase",
                letterSpacing: "0.1em",
                marginBottom: "0.4rem",
              }}
            >
              Patient Search
            </label>
            <input
              id="patient-search-input"
              type="text"
              placeholder="Search by patient name or code (e.g. PAT-)..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Patient search bar"
              style={{ marginBottom: "0.75rem" }}
            />

            {isSearching && (
              <p style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", margin: 0 }}>
                Searching registry…
              </p>
            )}

            {searchQuery.trim() !== "" && !isSearching && searchResults.length === 0 && (
              searchError ? (
                <p role="alert" className="notice-error">
                  Patient search failed: {searchError}
                </p>
              ) : (
                <div className="empty-state" style={{ padding: "1rem", margin: "0.5rem 0" }}>
                  <p style={{ margin: 0, fontSize: "0.85rem" }}>
                    No patients found matching &ldquo;{searchQuery}&rdquo;.
                  </p>
                </div>
              )
            )}

            {searchResults.length > 0 && (
              <div
                style={{
                  maxHeight: "220px",
                  overflowY: "auto",
                  border: "1px solid var(--color-border)",
                  borderRadius: "var(--radius-sm)",
                  backgroundColor: "var(--color-surface)",
                  padding: "0.5rem",
                }}
              >
                {searchResults.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "0.5rem 0.6rem",
                      borderBottom: "1px solid var(--color-border-subtle, #EEEEEE)",
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "0.9rem" }}>{p.display_name}</strong>
                      <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-muted)" }}>
                        {p.patient_code}
                      </div>
                    </div>
                    <div style={{ display: "flex", gap: "0.5rem" }}>
                      <Link to={`/screening/new?patient=${p.id}`}>
                        <button
                          style={{
                            fontSize: "0.68rem",
                            padding: "0.3rem 0.6rem",
                            minHeight: "32px",
                          }}
                        >
                          Screen →
                        </button>
                      </Link>
                      <Link to={`/patients/${p.id}`}>
                        <button
                          className="ghost"
                          style={{
                            fontSize: "0.68rem",
                            padding: "0.3rem 0.5rem",
                            minHeight: "32px",
                          }}
                        >
                          Profile
                        </button>
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
      </div>

      <hr className="rule-thin" />

      {/* 3. Reminders panel + device/model mini-card */}
      <div className="grid-2" style={{ marginBottom: "2.5rem" }}>
        <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" }}>
          <div>
            <h3 style={{ textTransform: "uppercase", margin: 0 }}>
              Today&rsquo;s &amp; Upcoming Reminders
            </h3>
            <p style={{ fontSize: "0.85rem", color: "var(--color-muted)", margin: "0.25rem 0 0 0" }}>
              Active medication regimens and supervised clinical follow-up schedules.
            </p>
          </div>
          <Link to="/reminders" style={{ textDecoration: "none" }}>
            <button className="secondary" style={{ fontSize: "0.72rem", padding: "0.4rem 0.8rem" }}>
              Manage All Reminders →
            </button>
          </Link>
        </div>

        {reminderActionMsg && (
          <div className="notice-editorial" style={{ marginBottom: "1rem" }}>
            <p style={{ margin: 0 }}>{reminderActionMsg}</p>
          </div>
        )}
        {reminderActionError && (
          <div className="notice-error" role="alert" style={{ marginBottom: "1rem" }}>
            Could not complete reminder: {reminderActionError}
          </div>
        )}

        {activeReminders?.length === 0 ? (
          <div className="empty-state">
            <h3>No Upcoming Reminders</h3>
            <p>There are no active medication or post-screening reminders scheduled.</p>
            <Link to="/reminders">
              <button>Schedule Reminder →</button>
            </Link>
          </div>
        ) : activeReminders ? (
          <table>
            <thead>
              <tr>
                <th>Patient</th>
                <th>Prescription / Medicine</th>
                <th>Dosage</th>
                <th>Time &amp; Frequency</th>
                <th>Schedule</th>
                <th style={{ textAlign: "right" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {activeReminders.slice(0, 6).map((r) => {
                const patient = patients?.find((p) => p.id === r.patient_id);
                return (
                  <tr key={r.id}>
                    <td>
                      <strong>{patient?.display_name || `Patient #${r.patient_id}`}</strong>
                      {patient && (
                        <div style={{ fontFamily: "var(--font-mono)", fontSize: "0.75rem", color: "var(--color-muted)" }}>
                          {patient.patient_code}
                        </div>
                      )}
                    </td>
                    <td>
                      <strong>{r.medicine}</strong>
                    </td>
                    <td>{r.dosage_text}</td>
                    <td>
                      <span style={{ fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                        {r.reminder_time}
                      </span>
                      <span style={{ color: "var(--color-muted)", fontSize: "0.85rem", marginLeft: "0.4rem" }}>
                        · {r.frequency}
                      </span>
                    </td>
                    <td>
                      {r.start_date > today
                        ? `Starts ${r.start_date}`
                        : `Active since ${r.start_date}`}
                    </td>
                    <td style={{ textAlign: "right" }}>
                      {r.completed_today ? (
                        <span className="badge success">Done today</span>
                      ) : r.start_date > today ? (
                        <span className="badge info">Upcoming</span>
                      ) : (
                        <button
                          className="secondary"
                          onClick={() => handleMarkReminderDone(r.id)}
                          style={{
                            fontSize: "0.72rem",
                            padding: "0.35rem 0.7rem",
                            minHeight: "32px",
                          }}
                        >
                          Mark Done ✓
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="empty-state" role="status">
            <h3>Reminders unavailable</h3>
            <p>Reminder schedules could not be loaded. Retry the dashboard to check again.</p>
          </div>
        )}
        </div>

        <div className="card" style={{ padding: "2rem", margin: 0, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
              <h3 style={{ textTransform: "uppercase", margin: 0 }}>
                Device Status
              </h3>
              <span className={`badge ${deviceStatus?.online ? "success" : "info"}`}>
                {!deviceStatus
                  ? deviceError ? "ERROR" : "NO DEVICE"
                  : deviceStatus.online ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
            <p style={{ fontSize: "0.85rem", color: "var(--color-muted)", marginBottom: "1.25rem" }}>
              Active peripheral bus status and edge inference link.
            </p>

            <table style={{ margin: 0 }}>
              <tbody>
                <tr>
                  <td><strong>Device Identifier</strong></td>
                  <td style={{ fontFamily: "var(--font-mono)", textAlign: "right" }}>
                    {deviceStatus?.device_id || (deviceError ? "Unavailable" : "No device connected")}
                  </td>
                </tr>
                <tr>
                  <td><strong>Connection Link</strong></td>
                  <td style={{ fontFamily: "var(--font-mono)", textAlign: "right" }}>
                    {!deviceStatus ? "No device connected" : deviceStatus.online ? "Online" : "Offline"}
                  </td>
                </tr>
                <tr>
                  <td><strong>Transport / COM port</strong></td>
                  <td style={{ fontFamily: "var(--font-mono)", textAlign: "right" }}>
                    {deviceStatus
                      ? `${deviceStatus.transport} · ${deviceStatus.port || "port unavailable"}`
                      : "Unavailable"}
                  </td>
                </tr>
                <tr>
                  <td><strong>Firmware</strong></td>
                  <td style={{ fontFamily: "var(--font-mono)", textAlign: "right" }}>
                    {deviceStatus?.firmware || "Unavailable"}
                  </td>
                </tr>
                <tr>
                  <td><strong>Active AI Model</strong></td>
                  <td style={{ fontFamily: "var(--font-mono)", textAlign: "right" }}>
                    {summary?.active_ai_model || "Unavailable"}
                  </td>
                </tr>
                <tr>
                  <td><strong>Active backend</strong></td>
                  <td style={{ fontFamily: "var(--font-mono)", textAlign: "right" }}>
                    {modelBackend || "Unavailable"}
                  </td>
                </tr>
                <tr>
                  <td><strong>Model version</strong></td>
                  <td style={{ fontFamily: "var(--font-mono)", textAlign: "right", fontSize: "0.8rem" }}>
                    {summary?.model_version || "Unavailable"}
                  </td>
                </tr>
                <tr>
                  <td><strong>Last Sync Telemetry</strong></td>
                  <td style={{ fontFamily: "var(--font-mono)", textAlign: "right", fontSize: "0.8rem" }}>
                    {formatSyncTime(deviceStatus?.last_seen || summary?.last_sync)}
                  </td>
                </tr>
              </tbody>
            </table>
            {deviceError && <div className="notice-error" role="alert">{deviceError}</div>}
            {latestDeviceResult && (
              <div style={{ display: "flex", gap: "1rem", alignItems: "center", marginTop: "1rem" }}>
                {latestDeviceResult.image_url && (
                  <img
                    src={latestDeviceResult.image_url}
                    alt={`Screening image for result ${latestDeviceResult.screening_id}`}
                    style={{ width: "96px", height: "72px", objectFit: "cover", borderRadius: "4px" }}
                  />
                )}
                <div>
                  <strong>Latest screening result: {latestDeviceResult.class || "Unavailable"}</strong>
                  {latestDeviceResult.is_mock && <div className="editorial-kicker">Mock AI result</div>}
                  <div className="editorial-kicker">{SCREENING_DISCLAIMER}</div>
                </div>
              </div>
            )}
          </div>

          <div style={{ marginTop: "1.5rem" }}>
            <Link to="/devices/live" style={{ textDecoration: "none" }}>
              <button className="secondary" style={{ width: "100%" }}>
                Live Hardware Telemetry Stream →
              </button>
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
