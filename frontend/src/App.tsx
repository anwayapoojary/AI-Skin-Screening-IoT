import { NavLink, Route, Routes } from "react-router-dom";
import About from "./pages/About";
import AIAnalysis from "./pages/AIAnalysis";
import CaptureUpload from "./pages/CaptureUpload";
import Dashboard from "./pages/Dashboard";
import DeviceStatusPage from "./pages/DeviceStatusPage";
import Devices from "./pages/Devices";
import History from "./pages/History";
import NewScreening from "./pages/NewScreening";
import PatientProfile from "./pages/PatientProfile";
import Patients from "./pages/Patients";
import Reminders from "./pages/Reminders";
import ReportPage from "./pages/ReportPage";
import ResultPage from "./pages/ResultPage";
import ReportsIndex from "./pages/ReportsIndex";
import Settings from "./pages/Settings";

export default function App() {
  return (
    <div className="layout">
      <nav>
        <div className="brand-block">
          <div className="brand-kicker">Clinical & Research Instrument</div>
          <h1 className="brand-title">AI Skin Screening</h1>
        </div>

        <div className="nav-list">
          <NavLink to="/" end>
            <span className="nav-num">01</span>
            <span>Dashboard</span>
          </NavLink>
          <NavLink to="/patients">
            <span className="nav-num">02</span>
            <span>Patients</span>
          </NavLink>
          <NavLink to="/capture">
            <span className="nav-num">03</span>
            <span>Capture / Upload</span>
          </NavLink>
          <NavLink to="/screening/new">
            <span className="nav-num">04</span>
            <span>New Screening</span>
          </NavLink>
          <NavLink to="/analysis">
            <span className="nav-num">05</span>
            <span>AI Analysis</span>
          </NavLink>
          <NavLink to="/history">
            <span className="nav-num">06</span>
            <span>History</span>
          </NavLink>
          <NavLink to="/reports/latest">
            <span className="nav-num">07</span>
            <span>Reports</span>
          </NavLink>
          <NavLink to="/reminders">
            <span className="nav-num">08</span>
            <span>Reminders</span>
          </NavLink>

          <div className="nav-section-title">Hardware & System</div>

          <NavLink to="/devices">
            <span className="nav-num">09</span>
            <span>Device</span>
          </NavLink>
          <NavLink to="/devices/live">
            <span className="nav-num">10</span>
            <span>Device Status</span>
          </NavLink>
          <NavLink to="/settings">
            <span className="nav-num">11</span>
            <span>Settings</span>
          </NavLink>
          <NavLink to="/about">
            <span className="nav-num">12</span>
            <span>About</span>
          </NavLink>
        </div>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/:id" element={<PatientProfile />} />
          <Route path="/capture" element={<CaptureUpload />} />
          <Route path="/screening/new" element={<NewScreening />} />
          <Route path="/analysis" element={<AIAnalysis />} />
          <Route path="/screening/:id" element={<ResultPage />} />
          <Route path="/reports/latest" element={<ReportsIndex />} />
          <Route path="/reports/:id" element={<ReportPage />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/devices/live" element={<DeviceStatusPage />} />
          <Route path="/history" element={<History />} />
          <Route path="/reminders" element={<Reminders />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/about" element={<About />} />
        </Routes>
      </main>
    </div>
  );
}
