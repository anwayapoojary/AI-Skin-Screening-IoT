import { NavLink, useSearchParams } from "react-router-dom";
import History from "./History";
import Reminders from "./Reminders";
import ReportsIndex from "./ReportsIndex";

const TABS = [
  { id: "history", label: "History" },
  { id: "reports", label: "Reports" },
  { id: "reminders", label: "Reminders" },
] as const;

export default function Records() {
  const [params] = useSearchParams();
  const raw = params.get("tab");
  const tab = raw === "reports" || raw === "reminders" ? raw : "history";

  return (
    <div>
      <nav className="records-tabs" aria-label="Records sections">
        {TABS.map((item) => (
          <NavLink
            key={item.id}
            to={`/records?tab=${item.id}`}
            className={tab === item.id ? "active" : undefined}
          >
            {item.label}
          </NavLink>
        ))}
      </nav>
      {tab === "reports" ? <ReportsIndex /> : tab === "reminders" ? <Reminders /> : <History />}
    </div>
  );
}
