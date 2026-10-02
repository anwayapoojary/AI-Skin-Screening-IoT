import { describe, it, expect, beforeEach, vi } from "vitest";
import React from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import App from "../App";
import Dashboard from "../pages/Dashboard";
import Patients from "../pages/Patients";
import ResultPage from "../pages/ResultPage";
import Reminders from "../pages/Reminders";
import { api } from "../api";

describe("Frontend UI Test Suite", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("Navigation & Layout", () => {
    it("renders navigation header and key navigation links", () => {
      render(
        <MemoryRouter initialEntries={["/"]}>
          <App />
        </MemoryRouter>
      );
      expect(screen.getByText("AI Skin Screening")).toBeDefined();
      expect(screen.getByText("Dashboard")).toBeDefined();
      expect(screen.getByText("Patients")).toBeDefined();
      expect(screen.getByText("Capture / Upload")).toBeDefined();
      expect(screen.getByText("AI Analysis")).toBeDefined();
      expect(screen.getByText("History")).toBeDefined();
      expect(screen.getByText("Reminders")).toBeDefined();
      expect(screen.getByText("Device Status")).toBeDefined();
    });
  });

  describe("Dashboard & Status States", () => {
    it("renders dashboard loading indicator initially", () => {
      vi.spyOn(api, "health").mockImplementation(() => new Promise(() => {}));
      vi.spyOn(api.patients, "list").mockImplementation(() => new Promise(() => {}));
      vi.spyOn(api.screenings, "list").mockImplementation(() => new Promise(() => {}));
      vi.spyOn(api.devices, "status").mockImplementation(() => new Promise(() => {}));

      render(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      );
      expect(screen.getByText(/Loading dashboard…/i)).toBeDefined();
    });

    it("displays DEMO/MOCK banner and empty state when no screenings", async () => {
      vi.spyOn(api, "health").mockResolvedValue({ status: "ok", device_mode: "virtual", ai_mode: "mock" });
      vi.spyOn(api.patients, "list").mockResolvedValue([]);
      vi.spyOn(api.screenings, "list").mockResolvedValue([]);
      vi.spyOn(api.devices, "status").mockResolvedValue({
        device_id: "DEVICE_001",
        state: "READY",
        display_state: "READY",
        camera_state: "ok",
        flash_state: "off",
        button_state: "idle",
        ip: "127.0.0.1",
        last_seen: "2026-10-02T10:00:00Z"
      });

      render(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/DEMO \/ MOCK MODEL/i)).toBeDefined();
        expect(screen.getByText(/No screenings yet/i)).toBeDefined();
      });
    });
  });

  describe("Patients Management Flow", () => {
    it("renders patient list and handles search filter", async () => {
      vi.spyOn(api.patients, "list").mockImplementation(async (q?: string) => {
        const all = [
          { id: 1, patient_code: "PAT-001", display_name: "John Doe", notes: "Test note" },
          { id: 2, patient_code: "PAT-002", display_name: "Jane Smith", notes: "" }
        ];
        if (q) {
          return all.filter(p => p.display_name.toLowerCase().includes(q.toLowerCase()) || p.patient_code.toLowerCase().includes(q.toLowerCase()));
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
        prediction: "Benign keratosis",
        confidence: 0.88,
        abstained: false,
        disclaimer: "Investigational device only. Not intended for primary diagnostic use.",
        model_name: "MockScreeningModel",
        model_version: "mock-v1.0.0",
        preprocessing_version: "v1.0-standard",
        prediction_timestamp: "2026-10-02T12:00:00Z",
        created_at: "2026-10-02T12:00:00Z"
      });

      render(
        <MemoryRouter initialEntries={["/screening/42"]}>
          <ResultPage />
        </MemoryRouter>
      );

      await waitFor(() => {
        expect(screen.getByText(/Benign keratosis/i)).toBeDefined();
        expect(screen.getByText(/88.0%/i)).toBeDefined();
        expect(screen.getByText(/Investigational device only/i)).toBeDefined();
      });
    });
  });

  describe("Medicine Reminders Flow", () => {
    it("renders reminders list and displays configured entries", async () => {
      vi.spyOn(api.patients, "list").mockResolvedValue([
        { id: 1, patient_code: "PAT-001", display_name: "John Doe", notes: "" }
      ]);
      vi.spyOn(api.reminders, "list").mockResolvedValue([
        {
          id: 1,
          patient_id: 1,
          medicine: "Hydrocortisone cream 1%",
          dosage_text: "Apply thin layer",
          reminder_time: "09:00",
          frequency: "Twice daily",
          is_active: true,
          created_at: "2026-10-02T10:00:00Z"
        }
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
