import { useEffect, useState } from "react";
import { api } from "../api";

export default function Settings() {
  const [h, setH] = useState<Record<string, unknown> | null>(null);
  useEffect(() => {
    api.health().then((x) => setH(x as Record<string, unknown>));
  }, []);
  return (
    <div>
      <h2>Settings</h2>
      <div className="card">
        <p>DEVICE_MODE and AI_MODE are server environment variables.</p>
        <pre>{JSON.stringify(h, null, 2)}</pre>
      </div>
    </div>
  );
}
