import { useEffect, useState } from "react";
import { api, SCREENING_DISCLAIMER, type ModelInfo } from "../api";

function percent(value: number | undefined): string {
  return typeof value === "number" ? `${(value * 100).toFixed(2)}%` : "Not available";
}

export default function AIAnalysis() {
  const [model, setModel] = useState<ModelInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api.model
      .info()
      .then((modelInfo) => {
        if (!cancelled) setModel(modelInfo);
      })
      .catch((reason: Error) => {
        if (!cancelled) setError(reason.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) return <p className="loading">Loading model information…</p>;

  return (
    <div>
      <div className="editorial-kicker">Model information</div>
      <h1 className="editorial-title">Model Info</h1>
      <p className="editorial-subtitle">
        Metrics are read from ai/models/metrics.json at runtime. Screening support only, not a diagnosis.
      </p>

      {error && <div className="notice-error" role="alert">{error}</div>}
      {!error && !model && (
        <div className="empty-state">
          <h3>Model information unavailable</h3>
          <p>Metrics could not be loaded from the server.</p>
        </div>
      )}
      {model?.load_error && <div className="notice-error" role="alert">Model unavailable: {model.load_error}</div>}
      {model?.error && <div className="notice-error" role="alert">{model.error}</div>}

      {model && (
        <section className="card-heavy" style={{ padding: "2rem", marginBottom: "2rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: "1rem", flexWrap: "wrap" }}>
            <div>
              <div className="editorial-kicker">Active backend: {model.active_backend}</div>
              <h2 style={{ margin: "0.4rem 0" }}>{model.model_name || "Model metadata unavailable"}</h2>
              <p style={{ margin: 0 }}>Model version: {model.model_version || "Unavailable"}</p>
            </div>
            <div className="card" style={{ padding: "1rem", margin: 0 }}>
              <div>Test macro-F1</div>
              <strong>{percent(model.test_macro_f1)}</strong>
            </div>
          </div>
          {model.active_backend === "real" && !model.available && (
            <p className="notice-error" role="status">
              The selected real model did not load. Analysis requests will report an availability error.
            </p>
          )}
          {model.split_method && <p>Evaluation split: {model.split_method}</p>}
          <p className="notice-editorial">
            df and vasc have very few test images, so their recall numbers are noisy.
            Training used dermoscopic images; this model is not validated on ESP32-CAM
            images. Class imbalance and limited skin-tone diversity also apply.
          </p>

          <h3>Classes and test-set recall</h3>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr><th>Class</th><th>Recall</th><th>Test support</th></tr>
              </thead>
              <tbody>
                {(model.per_class ?? []).map((item) => (
                  <tr key={item.label}>
                    <td>{item.name} ({item.label})</td>
                    <td>{percent(item.recall)}</td>
                    <td>{item.support}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <h3>Model limitations</h3>
          <ul>{(model.limitations ?? []).map((item) => <li key={item}>{item}</li>)}</ul>
          {model.confusion_matrix_url && (
            <figure>
              <img
                src={model.confusion_matrix_url}
                alt="Confusion matrix from the model evaluation"
                style={{ maxWidth: "100%", height: "auto" }}
              />
              <figcaption>Confusion matrix from the supplied evaluation artifact.</figcaption>
            </figure>
          )}
          <div className="disclaimer">{SCREENING_DISCLAIMER}</div>
        </section>
      )}
    </div>
  );
}
