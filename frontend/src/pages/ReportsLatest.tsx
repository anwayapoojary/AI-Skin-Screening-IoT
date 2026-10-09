import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api";

export default function ReportsLatest() {
  const nav = useNavigate();

  useEffect(() => {
    api.screenings
      .list()
      .then((rows) => {
        if (rows.length > 0) {
          nav(`/reports/${rows[0].id}`, { replace: true });
        } else {
          nav("/reports", { replace: true });
        }
      })
      .catch(() => {
        nav("/reports", { replace: true });
      });
  }, [nav]);

  return <p className="loading">Resolving latest clinical screening report…</p>;
}
