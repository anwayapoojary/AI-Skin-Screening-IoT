import { useEffect, useState } from "react";
import { api, type DeviceStatus, type SensorRow } from "../api";

const DEVICE = "DEVICE_001";

export default function DeviceStatusPage() {
  const [st, setSt] = useState<DeviceStatus | null>(null);
  const [sensors, setSensors] = useState<SensorRow[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = () => {
    api.devices
      .status(DEVICE)
      .then(setSt)
      .catch((e: Error) => setErr(e.message))
      .finally(() => setLoading(false));
    api.devices.sensors(DEVICE).then(setSensors).catch(() => setSensors([]));
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, []);

  if (loading) return <p className="loading">Loading device status…</p>;

  return (
    <div>
      <h2>Device Status</h2>
      {err && <p className="error">{err}</p>}
      {st ? (
        <div className="card">
          <table>
            <tbody>
              <tr><td><strong>Device ID</strong></td><td>{st.device_id}</td></tr>
              <tr><td><strong>Mode</strong></td><td><span className="badge">{st.mode}</span></td></tr>
              <tr><td><strong>Connection</strong></td>
                <td>
                  <span className={`badge ${st.connected ? "success" : "error"}`}>
                    {st.connected ? "Connected" : "Disconnected"}
                  </span>{" "}
                  State: {st.state}
                </td>
              </tr>
              <tr><td><strong>Camera</strong></td><td>{st.camera_status}</td></tr>
              <tr><td><strong>Sensors</strong></td><td>{st.sensor_status} (none in BOM)</td></tr>
              <tr><td><strong>Communication</strong></td><td>{st.communication_status}</td></tr>
              <tr><td><strong>Firmware</strong></td><td>{st.firmware_version ?? "—"}</td></tr>
              <tr><td><strong>Protocol</strong></td><td>{st.protocol_version}</td></tr>
              <tr><td><strong>OLED (0.96″)</strong></td><td>{st.display_state ?? "—"}</td></tr>
              <tr><td><strong>Button</strong></td><td>{st.button ?? "—"}</td></tr>
              <tr><td><strong>Flash LED</strong></td><td>{st.flash ?? "—"}</td></tr>
              <tr><td><strong>Last communication</strong></td><td>{st.last_communication ?? "—"}</td></tr>
              <tr><td><strong>Power / battery</strong></td><td>Not in BOM — not measured</td></tr>
            </tbody>
          </table>
        </div>
      ) : (
        <div className="empty-state">
          <h3>No device data</h3>
          <p>Connect the device first.</p>
        </div>
      )}

      {sensors.length > 0 && (
        <div className="card">
          <h3>Sensor interfaces</h3>
          {sensors.map((s) => (
            <p key={s.name}>
              <strong>{s.name}:</strong>{" "}
              <span className="badge">{s.status}</span>
              {s.value != null && ` ${s.value}`}
            </p>
          ))}
        </div>
      )}
    </div>
  );
}
