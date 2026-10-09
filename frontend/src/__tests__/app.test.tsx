import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import Dashboard from "../pages/Dashboard";
import Patients from "../pages/Patients";
import ResultPage from "../pages/ResultPage";
import Reminders from "../pages/Reminders";
import { api, type Patient, type Reminder } from "../api";

describe("Frontend UI Test Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Navigation & Layout", () => {
    it("renders navigation header and key navigation links including reports list", () => {
      vi.spyOn(api.dashboard, "summary").mockImplementation(() => new Promise(() => {}));
      vi.spyOn(api.devices, "live").mockImplementation(() => new Promise(() => {}));
      vi.spyOn(api.reminders, "list").mockImplementation(() => new Promise(() => {}));
      vi.spyOn(api.patients, "list").mockImplementation(() => new Promise(() => {}));

      render(
        <MemoryRouter initialEntries={["/"]}>
          <App />
        </MemoryRouter>
      );
      expect(screen.getByText("AI Skin Screening")).toBeDefined();
      expect(screen.getByText("Dashboard")).toBeDefined();
      expect(screen.getByText("Patients")).toBeDefined();
      expect(screen.getByText("Screening")).toBeDefined();
      expect(screen.getByText("Records")).toBeDefined();
      expect(screen.getByText("Device")).toBeDefined();
      expect(screen.getByText("Device Status")).toBeDefined();
      expect(screen.getByText("Model Info")).toBeDefined();
      expect(screen.getByText("Settings")).toBeDefined();
      expect(screen.getByText("About")).toBeDefined();
    });

    it("redirects the legacy capture route into the guided screening flow", async () => {
      vi.spyOn(api.patients, "list").mockResolvedValue([
        {
          id: 22,
          patient_code: "PAT-ROUTE",
          display_name: "Route Test Patient",
          notes: null,
          created_at: null,
        },
      ]);
      render(
        <MemoryRouter initialEntries={["/capture?patient=22"]}>
          <App />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: /New Screening/i })).toBeDefined();
        expect(
          (screen.getByLabelText("Select Patient") as HTMLSelectElement).value
        ).toBe("22");
      });
      expect(screen.queryByRole("heading", { name: /Capture or Upload/i })).toBeNull();
    });
  });

  describe("Dashboard Page (01)", () => {
    it("renders dashboard loading indicator initially", () => {
      vi.spyOn(api.dashboard, "summary").mockImplementation(() => new Promise(() => {}));
      vi.spyOn(api, "health").mockImplementation(() => new Promise(() => {}));
      vi.spyOn(api.patients, "list").mockImplementation(() => new Promise(() => {}));
      vi.spyOn(api.reminders, "list").mockImplementation(() => new Promise(() => {}));
      vi.spyOn(api.devices, "live").mockImplementation(() => new Promise(() => {}));

      render(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      );
      expect(screen.getByText(/Loading dashboard…/i)).toBeDefined();
    });

    it("displays real summary metrics, safety notices, and links out without recent screenings list", async () => {
      vi.spyOn(api.dashboard, "summary").mockResolvedValue({
        total_patients: 5,
        screenings_today: 2,
        screenings_this_week: 4,
        pending_results: 1,
        upcoming_reminders: 2,
        failed_uploads: 1,
        active_ai_model: "Mock AI (MobileNetV2 Simulation)",
        device_mode: "simulation",
        ai_mode: "mock",
        last_sync: "2026-10-08T10:00:00Z",
      });
      vi.spyOn(api, "health").mockResolvedValue({ status: "ok", device_mode: "simulation", ai_mode: "mock" });
      vi.spyOn(api.devices, "live").mockResolvedValue({
        online_timeout_seconds: 10,
        devices: [{
          device_id: "DEVICE_001",
          online: true,
          transport: "USB serial",
          port: "COM5",
          last_seen: "2026-10-08T10:00:00Z",
          firmware: "v1.0.0",
          status: "ONLINE",
          capture_requested: false,
          latest_result: {
            screening_id: 42,
            class: "Test screening output",
            confidence: 0.42,
            uncertain: false,
            is_mock: true,
            image_url: "/uploads/test.jpg",
            note: "Screening support only, not a diagnosis. Consult a doctor.",
            created_at: "2026-10-08T10:00:00Z",
          },
        }],
      });
      const mockPatient: Patient = {
        id: 1,
        patient_code: "PAT-001",
        display_name: "Jane Subject",
        notes: "Clinical subject",
        created_at: "2026-10-01T00:00:00Z",
      };
      vi.spyOn(api.patients, "list").mockResolvedValue([mockPatient]);
      const mockReminder: Reminder = {
        id: 10,
        patient_id: 1,
        medicine: "Hydrocortisone cream 1%",
        dosage_text: "Apply thin layer",
        frequency: "Twice daily",
        reminder_time: "09:00",
        start_date: "2026-10-01",
        end_date: null,
        is_active: true,
        notes: null,
        created_at: "2026-10-01T00:00:00Z",
      };
      vi.spyOn(api.reminders, "list").mockResolvedValue([mockReminder]);
      const completeReminderSpy = vi.spyOn(api.reminders, "complete").mockResolvedValue({
        reminder_id: mockReminder.id,
        completed_on: "2026-10-08",
      });

      render(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      );

      // Verify Safety notice and Mock AI badge
      await waitFor(() => {
        expect(
          screen.getAllByText(/Screening support only, not a diagnosis/i).length,
        ).toBeGreaterThanOrEqual(1);
        expect(screen.getAllByText(/MOCK AI/i).length).toBeGreaterThanOrEqual(1);
      });

      // Verify alerts for failed upload and pending result
      expect(screen.getByText(/1 image upload\(s\) failed optical quality gates/i)).toBeDefined();
      expect(screen.getByText(/1 screening result\(s\) pending neural evaluation/i)).toBeDefined();

      // Verify Summary cards numbers
      expect(screen.getByText("5")).toBeDefined(); // Total Patients
      expect(screen.getAllByText("2").length).toBeGreaterThanOrEqual(2); // Screenings Today and Upcoming Reminders
      expect(screen.getByText(/4 screenings this week/i)).toBeDefined();
      expect(screen.getByText("1")).toBeDefined(); // Pending Results

      // Verify Outward Links
      expect(screen.getByRole("button", { name: /Patients Directory →/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Screening History →/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Review Queue →/i })).toBeDefined();
      expect(screen.getByRole("button", { name: /Manage Reminders →/i })).toBeDefined();

      // Verify Device status mini-card
      expect(screen.getByText("DEVICE_001")).toBeDefined();
      expect(screen.getByText(/USB serial · COM5/)).toBeDefined();
      expect(screen.getByText("Latest screening result: Test screening output")).toBeDefined();
      expect(screen.getByAltText("Screening image for result 42")).toBeDefined();
      expect(screen.getByText("ONLINE")).toBeDefined();
      expect(screen.getByText(/Live Hardware Telemetry Stream →/i)).toBeDefined();

      // Verify Reminders Panel and Mark-as-Done action
      expect(screen.getByText("Hydrocortisone cream 1%")).toBeDefined();
      const markDoneBtn = screen.getByRole("button", { name: /Mark Done ✓/i });
      fireEvent.click(markDoneBtn);

      await waitFor(() => {
        expect(completeReminderSpy).toHaveBeenCalledWith(10);
        expect(screen.getByText("Done today")).toBeDefined();
      });

      // Verify NO recent screenings list table on dashboard (only summary cards)
      expect(screen.queryByText(/Recent Screenings/i)).toBeNull();
      expect(screen.queryByText(/Recent Inferences/i)).toBeNull();
    });

    it("displays clean empty states when data is unavailable (never fake numbers)", async () => {
      vi.spyOn(api.dashboard, "summary").mockResolvedValue({
        total_patients: 0,
        screenings_today: 0,
        screenings_this_week: 0,
        pending_results: 0,
        upcoming_reminders: 0,
        failed_uploads: 0,
        active_ai_model: "Mock AI (MobileNetV2 Simulation)",
        device_mode: "simulation",
        ai_mode: "mock",
        last_sync: null,
      });
      vi.spyOn(api, "health").mockResolvedValue({ status: "ok", device_mode: "simulation", ai_mode: "mock" });
      vi.spyOn(api.devices, "live").mockResolvedValue({
        online_timeout_seconds: 10,
        devices: [{
          device_id: "DEVICE_001",
          online: false,
          transport: "USB serial",
          port: null,
          last_seen: null,
          firmware: null,
          status: "OFFLINE",
          capture_requested: false,
          latest_result: null,
        }],
      });
      vi.spyOn(api.patients, "list").mockResolvedValue([]);
      vi.spyOn(api.reminders, "list").mockResolvedValue([]);

      render(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      );

      await waitFor(() => {
        // Must show real 0s, never fake numbers
        const zeros = screen.getAllByText("0");
        expect(zeros.length).toBeGreaterThanOrEqual(3);
      });

      // Check empty state messages
      expect(screen.getByText(/No patients enrolled/i)).toBeDefined();
      expect(screen.getByText(/0 screenings this week/i)).toBeDefined();
      expect(screen.getByText(/All analyses completed/i)).toBeDefined();
      expect(screen.getByText(/No Upcoming Reminders/i)).toBeDefined();
      expect(screen.getByRole("button", { name: /Schedule Reminder →/i })).toBeDefined();

      // No false alerts when there are 0 failed uploads and 0 pending results
      expect(screen.queryByText(/failed optical quality gates/i)).toBeNull();
      expect(screen.queryByText(/pending neural evaluation/i)).toBeNull();
    });

    it("handles patient search in Quick Actions", async () => {
      vi.spyOn(api.dashboard, "summary").mockResolvedValue({
        total_patients: 2,
        screenings_today: 0,
        screenings_this_week: 0,
        pending_results: 0,
        upcoming_reminders: 0,
        failed_uploads: 0,
        active_ai_model: "Mock AI",
        device_mode: "simulation",
        ai_mode: "mock",
        last_sync: null,
      });
      vi.spyOn(api, "health").mockResolvedValue({ status: "ok", device_mode: "simulation", ai_mode: "mock" });
      vi.spyOn(api.devices, "live").mockResolvedValue({ devices: [], online_timeout_seconds: 10 });
      vi.spyOn(api.reminders, "list").mockResolvedValue([]);
      vi.spyOn(api.patients, "list").mockImplementation(async (q?: string) => {
        if (q && q.includes("Alice")) {
          return [
            {
              id: 99,
              patient_code: "PAT-ALICE",
              display_name: "Alice Walker",
              notes: "Test",
              created_at: "2026-10-01T00:00:00Z",
            },
          ];
        }
        return [];
      });

      render(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByLabelText(/Patient search bar/i)).toBeDefined();
      });

      const input = screen.getByLabelText(/Patient search bar/i);
      fireEvent.change(input, { target: { value: "Alice" } });

      await waitFor(() => {
        expect(screen.getByText("Alice Walker")).toBeDefined();
        expect(screen.getByText("PAT-ALICE")).toBeDefined();
        expect(screen.getByRole("button", { name: /Screen →/i })).toBeDefined();
      });
    });

    it("renders a readable service error panel", async () => {
      vi.spyOn(api.dashboard, "summary").mockRejectedValue(new Error("Internal Server Error"));
      vi.spyOn(api, "health").mockRejectedValue(new Error("Internal Server Error"));
      vi.spyOn(api.patients, "list").mockResolvedValue([]);
      vi.spyOn(api.reminders, "list").mockResolvedValue([]);
      vi.spyOn(api.devices, "live").mockResolvedValue({ devices: [], online_timeout_seconds: 10 });

      render(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      );

      await waitFor(() => {
        const errorPanel = screen.getByRole("alert");
        expect(errorPanel.className).toContain("dashboard-error");
        expect(screen.getByText(/Internal Server Error/i)).toBeDefined();
        expect(screen.getByRole("button", { name: "Retry Connection" })).toBeDefined();
      });
      expect(screen.queryByText("No patients enrolled")).toBeNull();
      expect(screen.queryByText("All analyses completed")).toBeNull();
      expect(screen.queryByText("SIMULATED")).toBeNull();
    });

    it("shows unavailable reminders instead of an empty state when loading fails", async () => {
      vi.spyOn(api.dashboard, "summary").mockResolvedValue({
        total_patients: 0,
        screenings_today: 0,
        screenings_this_week: 0,
        pending_results: 0,
        upcoming_reminders: 0,
        failed_uploads: 0,
        active_ai_model: "Mock screening model",
        device_mode: "simulation",
        ai_mode: "mock",
        last_sync: null,
      });
      vi.spyOn(api.devices, "live").mockResolvedValue({ devices: [], online_timeout_seconds: 10 });
      vi.spyOn(api.reminders, "list").mockRejectedValue(new Error("Reminder service unavailable"));
      vi.spyOn(api.patients, "list").mockResolvedValue([]);

      render(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Reminders unavailable" })).toBeDefined();
      });
      expect(screen.queryByRole("heading", { name: "No Upcoming Reminders" })).toBeNull();
      expect(screen.getByText(/Reminder service unavailable/i)).toBeDefined();
    });
  });

  describe("Patients Management Flow", () => {
    it("renders patient list and handles search filter", async () => {
      vi.spyOn(api.patients, "list").mockImplementation(async (q?: string) => {
        const all: Patient[] = [
          { id: 1, patient_code: "PAT-001", display_name: "John Doe", notes: "Test note", created_at: "2026-10-01" },
          { id: 2, patient_code: "PAT-002", display_name: "Jane Smith", notes: "", created_at: "2026-10-01" },
        ];
        if (q) {
          return all.filter(
            (p) =>
              p.display_name.toLowerCase().includes(q.toLowerCase()) ||
              p.patient_code.toLowerCase().includes(q.toLowerCase())
          );
        }
        return all;
      });

      render(
        <MemoryRouter>
          <Patients />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("PAT-001")).toBeDefined();
        expect(screen.getByText("John Doe")).toBeDefined();
        expect(screen.getByText("PAT-002")).toBeDefined();
      });

      const searchInput = screen.getByPlaceholderText(/Search by name or code…/i);
      fireEvent.change(searchInput, { target: { value: "Jane" } });
      const searchBtn = screen.getByRole("button", { name: "Search" });
      fireEvent.click(searchBtn);

      await waitFor(() => {
        expect(screen.queryByText("John Doe")).toBeNull();
        expect(screen.getByText("Jane Smith")).toBeDefined();
      });
    });
  });

  describe("Result Page & Safety Disclaimers", () => {
    it("displays mandatory clinical safety disclaimer and AI finding", async () => {
      vi.spyOn(api.screenings, "get").mockResolvedValue({
        id: 42,
        patient_id: 1,
        patient_code: "PAT-001",
        image_path: null,
        image_source: "device",
        device_id: 1,
        prediction: "Benign keratosis",
        confidence: 0.88,
        abstained: false,
        uncertain: false,
        is_mock: true,
        top3: [
          { label: "nv", name: "Melanocytic nevi", probability: 0.88 },
          { label: "bkl", name: "Benign keratosis-like lesions", probability: 0.07 },
          { label: "mel", name: "Melanoma", probability: 0.03 },
        ],
        disclaimer: "Screening support only, not a diagnosis. Consult a doctor.",
        model_name: "MockScreeningModel",
        model_version: "mock-v1.0.0",
        preprocessing_version: "v1.0-standard",
        image_quality_status: "passed",
        device_firmware_version: "1.0.0",
        prediction_timestamp: "2026-10-02T12:00:00Z",
        created_at: "2026-10-02T12:00:00Z",
      });

      render(
        <MemoryRouter initialEntries={["/screening/42"]}>
          <ResultPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Benign keratosis")).toBeDefined();
        expect(screen.getAllByText("88.0%").length).toBeGreaterThanOrEqual(1);
        expect(screen.getByText(/Screening support only, not a diagnosis\. Consult a doctor\./i)).toBeDefined();
        expect(screen.getByText("Mock AI")).toBeDefined();
        expect(screen.getByText(/Top 3 screening probabilities/i)).toBeDefined();
      });
    });

    it("shows the uncertain state without a mock badge for real results", async () => {
      vi.spyOn(api.screenings, "get").mockResolvedValue({
        id: 43,
        patient_id: 1,
        patient_code: "PAT-001",
        image_path: null,
        image_source: "upload",
        device_id: null,
        prediction: "Uncertain, needs review",
        confidence: 0.49,
        abstained: true,
        uncertain: true,
        is_mock: false,
        top3: [
          { label: "nv", name: "Melanocytic nevi", probability: 0.49 },
          { label: "mel", name: "Melanoma", probability: 0.2 },
          { label: "bkl", name: "Benign keratosis-like lesions", probability: 0.1 },
        ],
        disclaimer: "Screening support only, not a diagnosis. Consult a doctor.",
        model_name: "EfficientNet-B0",
        model_version: "real-test-version",
        preprocessing_version: "preprocess.json",
        image_quality_status: "ok",
        device_firmware_version: null,
        prediction_timestamp: "2026-10-02T12:00:00Z",
        created_at: "2026-10-02T12:00:00Z",
      });

      render(
        <MemoryRouter initialEntries={["/screening/43"]}>
          <ResultPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getAllByText(/Uncertain, needs review/i).length).toBeGreaterThan(0);
        expect(screen.queryByText("Mock AI")).toBeNull();
      });
    });

    it("shows a clear result-fetch error state", async () => {
      vi.spyOn(api.screenings, "get").mockRejectedValue(new Error("Unable to load screening"));
      render(
        <MemoryRouter initialEntries={["/screening/44"]}>
          <ResultPage />
        </MemoryRouter>
      );
      await waitFor(() => {
        expect(screen.getByText("Unable to load screening")).toBeDefined();
      });
    });
  });

  describe("Medicine Reminders Flow", () => {
    it("renders reminders list and displays configured entries", async () => {
      vi.spyOn(api.patients, "list").mockResolvedValue([
        { id: 1, patient_code: "PAT-001", display_name: "John Doe", notes: "", created_at: "2026-10-01" },
      ]);
      vi.spyOn(api.reminders, "list").mockResolvedValue([
        {
          id: 1,
          patient_id: 1,
          medicine: "Hydrocortisone cream 1%",
          dosage_text: "Apply thin layer",
          reminder_time: "09:00",
          frequency: "Twice daily",
          start_date: "2026-10-01",
          end_date: null,
          notes: null,
          is_active: true,
          created_at: "2026-10-02T10:00:00Z",
        },
      ]);

      render(
        <MemoryRouter>
          <Reminders />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText("Hydrocortisone cream 1%")).toBeDefined();
        expect(screen.getByText("Apply thin layer")).toBeDefined();
        expect(screen.getByText("Twice daily")).toBeDefined();
      });
    });
  });
});
