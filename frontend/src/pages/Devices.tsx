import { useState } from "react";
import { api, type DeviceStatus } from "../api";

const DEVICE = "DEVICE_001";

export default function Devices() {
  const [st, setSt] = useState<DeviceStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  return (
    <div>
      <h2>Device Connection</h2>
      <p className="info">
        ESP32-CAM connects over Wi-Fi. In simulation mode this uses the in-process virtual device.
      </p>
      {err && <p className="error">{err}</p>}
      {success && <p className="success">{success}</p>}

      <div className="card">
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            disabled={loading}
            onClick={() => {
              setLoading(true);
              setErr(null);
              setSuccess(null);
              api.devices
                .connect(DEVICE)
                .then((s) => { setSt(s); setSuccess("Device connected."); })
                .catch((e: Error) => setErr(e.message))
                .finally(() => setLoading(false));
            }}
          >
            {loading ? "Connecting…" : "Connect"}
          </button>
          <button
            className="secondary"
            onClick={() => {
              api.devices.disconnect(DEVICE).then(() => {
                setSt(null);
                setSuccess("Device disconnected.");
              });
            }}
          >
            Disconnect
          </button>
        </div>
      </div>

      {st && (
        <div className="card">
          <p><strong>State:</strong> <span className="badge">{st.state}</span></p>
          <p><strong>Firmware:</strong> {st.firmware_version ?? "—"}</p>
          <p><strong>OLED:</strong> {st.display_state ?? "—"}</p>
          <p><strong>Mode:</strong> {st.mode}</p>
        </div>
      )}
    </div>
  );
}
