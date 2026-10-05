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

  if (loading) return <p className="loading">Loading environment configuration…</p>;

  return (
    <div>
      <div className="editorial-kicker">System Configuration · Runtime Parameters</div>

      <h1 className="editorial-title">Settings</h1>

      <p className="editorial-subtitle">
        Host server environment variables, active daemon endpoints, and diagnostic parameters.
      </p>

      <hr className="rule-heavy" />

      <div className="card-heavy" style={{ padding: "2.5rem", marginBottom: "2rem" }}>
        <h3 style={{ textTransform: "uppercase", marginBottom: "1rem" }}>
          Environment Configuration Matrix
        </h3>
        <p style={{ color: "var(--color-muted-text)", fontSize: "0.9rem", marginBottom: "1.5rem" }}>
          Runtime configuration parameters are managed via the root <code>.env</code> file.
          Modify environment keys and restart the application daemon to apply changes.
        </p>

        {h && (
          <table style={{ margin: 0 }}>
            <thead>
              <tr>
                <th style={{ width: "260px" }}>Parameter Key</th>
                <th>Active Runtime Value</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(h).map(([k, v]) => (
                <tr key={k}>
                  <td>
                    <code style={{ fontFamily: "var(--font-mono)", fontWeight: 700 }}>{k}</code>
                  </td>
                  <td style={{ fontFamily: "var(--font-mono)" }}>{String(v)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="disclaimer">
        <strong>Regulatory Governance Notice:</strong> This is a research prototype for skin screening.
        It is NOT a medical device, diagnostic tool, or regulatory-approved system.
        All results are preliminary screening indications only. Never rely on this system for clinical decisions
        without qualified medical oversight.
      </div>
    </div>
  );
}
