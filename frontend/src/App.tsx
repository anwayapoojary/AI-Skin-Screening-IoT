import { Navigate, NavLink, Route, Routes, useLocation } from "react-router-dom";
import About from "./pages/About";
import AIAnalysis from "./pages/AIAnalysis";
import Dashboard from "./pages/Dashboard";
import DeviceStatusPage from "./pages/DeviceStatusPage";
import Devices from "./pages/Devices";
import NewScreening from "./pages/NewScreening";
import PatientProfile from "./pages/PatientProfile";
import Patients from "./pages/Patients";
import Records from "./pages/Records";
import ReportPage from "./pages/ReportPage";
import ResultPage from "./pages/ResultPage";
import ReportsLatest from "./pages/ReportsLatest";
import Settings from "./pages/Settings";

function GearMenu() {
  return (
    <details className="gear-menu">
      <summary aria-label="System menu">⚙</summary>
      <div className="gear-menu__list">
        <NavLink to="/devices">Device</NavLink>
        <NavLink to="/devices/live">Device Status</NavLink>
        <NavLink to="/model">Model Info</NavLink>
        <NavLink to="/settings">Settings</NavLink>
        <NavLink to="/about">About</NavLink>
      </div>
    </details>
  );
}

export default function App() {
  const location = useLocation();

  return (
    <div className="layout">
      <nav>
        <div className="brand-block">
          <div className="brand-kicker">Clinical & Research Instrument</div>
          <h1 className="brand-title">AI Skin Screening</h1>
        </div>

        <div className="nav-list">
          <NavLink to="/" end>
            Dashboard
          </NavLink>
          <NavLink to="/patients">Patients</NavLink>
          <NavLink
            to="/screening/new"
            className={() => (location.pathname.startsWith("/screening") ? "active" : "")}
          >
            Screening
          </NavLink>
          <NavLink
            to="/records"
            className={() => (location.pathname.startsWith("/records") ? "active" : "")}
          >
            Records
          </NavLink>
        </div>
      </nav>
      <main>
        <header className="app-header">
          <GearMenu />
        </header>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/:id" element={<PatientProfile />} />
          <Route
            path="/capture"
            element={<Navigate to={`/screening/new${location.search}`} replace />}
          />
          <Route path="/screening/new" element={<NewScreening />} />
          <Route path="/analysis" element={<Navigate to="/model" replace />} />
          <Route path="/model" element={<AIAnalysis />} />
          <Route path="/screening/:id" element={<ResultPage />} />
          <Route path="/reports/latest" element={<ReportsLatest />} />
          <Route path="/reports/:id" element={<ReportPage />} />
          <Route path="/reports" element={<Navigate to="/records?tab=reports" replace />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/devices/live" element={<DeviceStatusPage />} />
          <Route path="/history" element={<Navigate to="/records?tab=history" replace />} />
          <Route path="/reminders" element={<Navigate to="/records?tab=reminders" replace />} />
          <Route path="/records" element={<Records />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
    </div>
  );
}
