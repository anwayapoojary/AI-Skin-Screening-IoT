import { useState } from "react";
import { api, type DeviceStatus } from "../api";

const DEVICE = "DEVICE_001";

export default function Devices() {
  const [st, setSt] = useState<DeviceStatus | null>(null);
  const [err, setErr] = useState<string | null>(null);
  return (
    <div>
      <h2>Device connection</h2>
      <p>ESP32-CAM will join over Wi-Fi. Today this talks to the in-process simulator.</p>
      {err && <p className="error">{err}</p>}
      <button
        onClick={() =>
          api.devices
            .connect(DEVICE)
            .then(setSt)
            .catch((e: Error) => setErr(e.message))
        }
      >
        Connect
      </button>
      <button className="secondary" onClick={() => api.devices.disconnect(DEVICE).then(() => setSt(null))}>
        Disconnect
      </button>
      {st && (
        <div className="card">
          <p>State: {st.state}</p>
          <p>Firmware: {st.firmware_version}</p>
          <p>OLED: {st.display_state}</p>
        </div>
      )}
    </div>
  );
}
