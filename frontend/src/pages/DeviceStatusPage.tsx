import { useEffect, useState } from "react";
import { api, type DeviceStatus, type SensorRow } from "../api";

const DEVICE = "DEVICE_001";

export default function DeviceStatusPage() {
  const [st, setSt] = useState<DeviceStatus | null>(null);
  const [sensors, setSensors] = useState<SensorRow[]>([]);
  const [err, setErr] = useState<string | null>(null);

  const refresh = () => {
    api.devices
      .status(DEVICE)
      .then(setSt)
      .catch((e: Error) => setErr(e.message));
    api.devices.sensors(DEVICE).then(setSensors).catch(() => setSensors([]));
  };

  useEffect(() => {
    refresh();
    const t = setInterval(refresh, 3000);
    return () => clearInterval(t);
  }, []);

  return (
    <div>
      <h2>Live device status</h2>
      {err && <p className="error">{err}</p>}
      {st && (
        <div className="card">
          <p>Device ID: {st.device_id}</p>
          <p>Mode: {st.mode}</p>
          <p>Connection / state: {st.connected ? "connected" : "no"} · {st.state}</p>
          <p>Camera: {st.camera_status}</p>
          <p>Sensors: {st.sensor_status} (none in BOM)</p>
          <p>Comms: {st.communication_status}</p>
          <p>Firmware: {st.firmware_version} · protocol {st.protocol_version}</p>
          <p>OLED (0.96"): {st.display_state}</p>
          <p>Button: {st.button ?? "—"} · Flash: {st.flash ?? "—"}</p>
          <p>Last communication: {st.last_communication}</p>
          <p>Power / battery: not in BOM — not shown as a measurement</p>
        </div>
      )}
      <div className="card">
        <h3>Sensor interfaces</h3>
        {sensors.map((s) => (
          <p key={s.name}>
            {s.name}: {s.status}
            {s.value == null ? " (no value)" : ` ${s.value}`}
          </p>
        ))}
      </div>
    </div>
  );
}
