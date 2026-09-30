import { NavLink, Route, Routes } from "react-router-dom";
import About from "./pages/About";
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
        <h1>Screening device</h1>
        <NavLink to="/">Dashboard</NavLink>
        <NavLink to="/patients">Patients</NavLink>
        <NavLink to="/screening/new">New screening</NavLink>
        <NavLink to="/capture">Image capture</NavLink>
        <NavLink to="/analysis">AI analysis</NavLink>
        <NavLink to="/reports/latest">Reports</NavLink>
        <NavLink to="/devices">Device connection</NavLink>
        <NavLink to="/devices/live">Live device status</NavLink>
        <NavLink to="/history">Screening history</NavLink>
        <NavLink to="/reminders">Reminders</NavLink>
        <NavLink to="/settings">Settings</NavLink>
        <NavLink to="/about">About</NavLink>
      </nav>
      <main>
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/patients" element={<Patients />} />
          <Route path="/patients/:id" element={<PatientProfile />} />
          <Route path="/screening/new" element={<NewScreening />} />
          <Route path="/capture" element={<NewScreening />} />
          <Route path="/analysis" element={<NewScreening />} />
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
