import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, SCREENING_DISCLAIMER, type DeviceLive } from "../api";

function formatLastSeen(value: string | null): string {
  if (!value) return "No heartbeat received";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
}

export default function DeviceStatusPage() {
  const [device, setDevice] = useState<DeviceLive | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [capturePending, setCapturePending] = useState(false);
  const [captureMessage, setCaptureMessage] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const response = await api.devices.live();
      setDevice(response.devices.find((item) => item.online) ?? response.devices[0] ?? null);
      setError(null);
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 3000);
    return () => clearInterval(timer);
  }, [refresh]);

  const requestCapture = async () => {
    if (!device?.device_id || !device.online) return;
    setCapturePending(true);
    setCaptureMessage(null);
    try {
      await api.devices.requestCapture(device.device_id);
      setCaptureMessage("Capture request sent to the USB bridge.");
    } catch (reason: unknown) {
      setCaptureMessage(reason instanceof Error ? reason.message : String(reason));
    } finally {
      setCapturePending(false);
    }
  };

  const result = device?.latest_result;

  return (
    <div>
      <div className="editorial-kicker">Live USB Serial · Heartbeat window 10 seconds</div>
      <h1 className="editorial-title">Device Status</h1>
      <p className="editorial-subtitle">
        Live ESP32-CAM connection and latest screening result.
      </p>

      {loading && <p className="loading" role="status">Checking for a connected device…</p>}
      {error && (
        <div className="notice-error" role="alert">
          Could not load live device status: {error}{" "}
          <button className="secondary" onClick={() => void refresh()}>Retry</button>
        </div>
      )}

      {!loading && !error && !device && (
        <div className="empty-state" role="status">
          <h3>No device connected</h3>
          <p>Connect the ESP32-CAM through its FT232RL adapter and start the serial bridge.</p>
        </div>
      )}

      {device && (
        <>
          <section aria-label="Device status" className="card" style={{ padding: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
              <div>
                <div className="editorial-kicker">Device identifier</div>
                <strong>{device.device_id}</strong>
              </div>
              <span className={`badge ${device.online ? "success" : "info"}`}>
                {device.online ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
            {!device.online && (
              <p role="status" style={{ marginBottom: 0 }}>
                No heartbeat has arrived recently. The device is offline or the bridge is disconnected.
              </p>
            )}
            <table style={{ marginTop: "1.25rem" }}>
              <tbody>
                <tr><td><strong>Transport</strong></td><td>{device.transport}</td></tr>
                <tr><td><strong>COM port</strong></td><td>{device.port || "Unavailable"}</td></tr>
                <tr><td><strong>Last seen</strong></td><td>{formatLastSeen(device.last_seen)}</td></tr>
                <tr><td><strong>Firmware</strong></td><td>{device.firmware || "Unknown"}</td></tr>
                <tr><td><strong>Device state</strong></td><td>{device.status}</td></tr>
              </tbody>
            </table>
            <button onClick={() => void requestCapture()} disabled={!device.online || capturePending}>
              {capturePending ? "Requesting…" : "Capture now"}
            </button>
            {captureMessage && <p role="status">{captureMessage}</p>}
          </section>

          <section aria-label="Latest screening result" className="card" style={{ padding: "1.5rem", marginTop: "1.5rem" }}>
            <div className="editorial-kicker">Latest screening result</div>
            {!result ? (
              <div className="empty-state">
                <h3>No screening result yet</h3>
                <p>Press the device button or request a capture when the device is online.</p>
              </div>
            ) : (
              <div style={{ display: "flex", gap: "1.5rem", flexWrap: "wrap", alignItems: "flex-start" }}>
                {result.image_url && (
                  <img
                    src={result.image_url}
                    alt={`Image for screening ${result.screening_id}`}
                    style={{ maxWidth: "320px", width: "100%", maxHeight: "280px", objectFit: "contain" }}
                  />
                )}
                <div>
                  <h2 style={{ marginTop: 0 }}>{result.class || "Result unavailable"}</h2>
                  {result.confidence !== null && Number.isFinite(result.confidence) && (
                    <p>Model confidence: {(result.confidence * 100).toFixed(1)}%</p>
                  )}
                  {result.uncertain && <p className="notice-warning">The model marked this result as uncertain.</p>}
                  {result.is_mock && <span className="badge warn">MOCK AI</span>}
                  <p>{formatLastSeen(result.created_at)}</p>
                  <p className="notice-warning">{SCREENING_DISCLAIMER}</p>
                </div>
              </div>
            )}
          </section>
        </>
      )}

      <div style={{ marginTop: "1.5rem" }}>
        <Link to="/">← Return to Dashboard</Link>
      </div>
    </div>
  );
}
