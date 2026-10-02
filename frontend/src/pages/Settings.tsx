import { useEffect, useState } from "react";
import { api } from "../api";

export default function Settings() {
  const [h, setH] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.health()
      .then((x) => setH(x as Record<string, unknown>))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="loading">Loading settings…</p>;

  return (
    <div>
      <h2>Settings / About</h2>
      <div className="card">
        <p style={{ color: "var(--color-text-subtle)", fontSize: "0.9rem" }}>
          DEVICE_MODE and AI_MODE are server environment variables. Edit <code>.env</code> and restart the backend to change them.
        </p>
        {h && (
          <table>
            <tbody>
              {Object.entries(h).map(([k, v]) => (
                <tr key={k}>
                  <td><strong>{k}</strong></td>
                  <td>{String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      <div className="disclaimer">
        This is a research prototype for skin screening. It is NOT a medical device, diagnostic tool, or regulatory-approved system.
        All results are screening indications only. Never rely on this system for clinical decisions without qualified clinical oversight.
      </div>
    </div>
  );
}
