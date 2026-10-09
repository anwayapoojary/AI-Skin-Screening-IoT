export const API = "/api/v1";
export const SCREENING_DISCLAIMER =
  "Screening support only, not a diagnosis. Consult a doctor.";

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    let message = text || res.statusText;
    try {
      const body: unknown = JSON.parse(text);
      if (body && typeof body === "object" && "detail" in body) {
        const detail = (body as { detail: unknown }).detail;
        message = typeof detail === "string" ? detail : JSON.stringify(detail);
      }
    } catch {
      // Preserve non-JSON response text for proxy and server errors.
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

export const api = {
  device: {
    transportStatus: () =>
      fetch("/api/device/status").then((r) => parse<DeviceTransportStatus>(r)),
  },
  health: () => fetch(`${API}/health`).then((r) => parse(r)),
  model: {
    info: () => fetch("/api/model/info").then((r) => parse<ModelInfo>(r)),
  },
  dashboard: {
    summary: () => fetch(`${API}/dashboard/summary`).then((r) => parse<DashboardSummary>(r)),
  },
  patients: {
    list: (q?: string) => {
      const qs = q ? `?q=${encodeURIComponent(q)}` : "";
      return fetch(`${API}/patients${qs}`).then((r) => parse<Patient[]>(r));
    },
    get: (id: number) => fetch(`${API}/patients/${id}`).then((r) => parse<Patient>(r)),
    create: (body: { display_name: string; notes?: string }) =>
      fetch(`${API}/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => parse<Patient>(r)),
    update: (id: number, body: { display_name?: string; notes?: string }) =>
      fetch(`${API}/patients/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => parse<Patient>(r)),
  },
  devices: {
    list: () => fetch(`${API}/devices`).then((r) => parse<DeviceRow[]>(r)),
    live: () => fetch(`${API}/devices/live`).then((r) => parse<DeviceLiveResponse>(r)),
    requestCapture: (id: string) =>
      fetch(`${API}/devices/${encodeURIComponent(id)}/capture?request_only=true`, {
        method: "POST",
      }).then((r) => parse<{ ok: boolean; capture_requested: boolean }>(r)),
    latestResult: (id: string) =>
      fetch(`${API}/devices/${encodeURIComponent(id)}/result/latest`).then((r) =>
        parse<DeviceLiveResult>(r),
      ),
    status: (id: string) => fetch(`${API}/devices/${id}/status`).then((r) => parse<DeviceStatus>(r)),
    connect: (id: string) =>
      fetch(`${API}/devices/${id}/connect`, { method: "POST" }).then((r) => parse<DeviceStatus>(r)),
    disconnect: (id: string) =>
      fetch(`${API}/devices/${id}/disconnect`, { method: "POST" }).then((r) => parse(r)),
    sensors: (id: string) => fetch(`${API}/devices/${id}/sensors`).then((r) => parse<SensorRow[]>(r)),
  },
  screenings: {
    list: (patientId?: number) => {
      const q = patientId != null ? `?patient_id=${patientId}` : "";
      return fetch(`${API}/screenings${q}`).then((r) => parse<Screening[]>(r));
    },
    get: (id: number) => fetch(`${API}/screenings/${id}`).then((r) => parse<Screening>(r)),
    runDevice: (patient_id: number) =>
      fetch(`${API}/screenings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id, source: "simulated" }),
      })
        .then((r) => parse<Screening>(r))
        .then((screening) =>
          fetch(`${API}/screenings/${screening.id}/capture`, { method: "POST" }).then((r) =>
            parse<Screening>(r),
          ),
        ),
    create: (patient_id: number, source: ScreeningSource) =>
      fetch(`${API}/screenings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ patient_id, source }),
      }).then((r) => parse<Screening>(r)),
    uploadTo: (screeningId: number, file: File, source: ScreeningSource = "upload") => {
      const fd = new FormData();
      fd.append("source", source);
      fd.append("file", file);
      return fetch(`${API}/screenings/${screeningId}/upload`, { method: "POST", body: fd }).then((r) =>
        parse<Screening>(r),
      );
    },
    analyze: (screeningId: number) =>
      fetch(`${API}/screenings/${screeningId}/analyze`, { method: "POST" }).then((r) =>
        parse<Screening>(r),
      ),
    upload: async (patientId: number, file: File, source: ScreeningSource = "upload") => {
      const screening = await api.screenings.create(patientId, source);
      await api.screenings.uploadTo(screening.id, file, source);
      return api.screenings.analyze(screening.id);
    },
  },
  reports: {
    get: (screeningId: number) =>
      fetch(`${API}/reports/${screeningId}`).then((r) => parse<Report>(r)),
  },
  reminders: {
    list: (patientId?: number) => {
      const q = patientId != null ? `?patient_id=${patientId}` : "";
      return fetch(`${API}/reminders${q}`).then((r) => parse<Reminder[]>(r));
    },
    get: (id: number) => fetch(`${API}/reminders/${id}`).then((r) => parse<Reminder>(r)),
    create: (body: ReminderCreate) =>
      fetch(`${API}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => parse<Reminder>(r)),
    update: (id: number, body: Partial<ReminderCreate> & { is_active?: boolean }) =>
      fetch(`${API}/reminders/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => parse<Reminder>(r)),
    complete: (id: number) =>
      fetch(`${API}/reminders/${id}/complete`, { method: "POST" })
        .then((r) => parse<ReminderCompletion>(r)),
    delete: (id: number) =>
      fetch(`${API}/reminders/${id}`, { method: "DELETE" }).then((r) => parse(r)),
  },
};

export type Patient = {
  id: number;
  patient_code: string;
  display_name: string;
  notes: string | null;
  created_at: string | null;
};

export type DeviceRow = {
  id: number;
  device_id: string;
  firmware_version: string | null;
  protocol_version: string;
  connection_status: string;
  last_seen: string | null;
};

export type DeviceStatus = {
  device_id: string;
  connected: boolean;
  state: string;
  camera_status: string;
  sensor_status: string;
  communication_status: string;
  firmware_version: string | null;
  protocol_version: string;
  power_status: string | null;
  last_communication: string | null;
  display_state: string | null;
  button?: string | null;
  flash?: string | null;
  mode: string;
};

export type DeviceLiveResult = {
  screening_id: number;
  class: string | null;
  confidence: number | null;
  uncertain: boolean;
  is_mock: boolean;
  image_url: string | null;
  note: string;
  created_at: string | null;
};

export type DeviceLive = {
  device_id: string;
  online: boolean;
  transport: string;
  port: string | null;
  last_seen: string | null;
  firmware: string | null;
  status: string;
  capture_requested: boolean;
  latest_result: DeviceLiveResult | null;
};

export type DeviceLiveResponse = {
  devices: DeviceLive[];
  online_timeout_seconds: number;
};

export type DeviceTransportStatus = {
  active_mode: "wifi" | "usb" | "simulated";
  mode_source: "device_reported" | "last_upload" | "configured";
  device_id: string | null;
  last_upload_source: "wifi" | "usb" | "simulated" | null;
  last_sync: string | null;
  server_time: string;
};

export type SensorRow = { name: string; value: number | null; unit: string | null; status: string };

export type Screening = {
  id: number;
  patient_id: number;
  patient_code?: string | null;
  device_id: number | null;
  image_path: string | null;
  image_source: string;
  source?: ScreeningSource;
  prediction: string | null;
  confidence: number | null;
  abstained: boolean;
  uncertain?: boolean;
  is_mock?: boolean;
  top_label?: string | null;
  top_name?: string | null;
  probabilities?: Record<string, number> | null;
  top3?: TopPrediction[] | null;
  model_name: string | null;
  model_version: string | null;
  preprocessing_version: string | null;
  image_quality_status: string | null;
  device_firmware_version: string | null;
  prediction_timestamp: string | null;
  timestamp?: string | null;
  created_at: string | null;
  disclaimer: string;
};

export type ScreeningSource = "upload" | "wifi" | "usb" | "simulated";
export type TopPrediction = { label: string; name: string; probability: number };

export type ModelInfo = {
  available: boolean;
  active_backend: "mock" | "real";
  load_error?: string | null;
  error?: string;
  model_name?: string;
  model_version?: string | null;
  classes?: string[];
  class_names?: Record<string, string>;
  split_method?: string;
  test_macro_f1?: number;
  per_class?: Array<{ label: string; name: string; recall: number; f1: number; support: number }>;
  limitations?: string[];
  confusion_matrix_url?: string;
};

export type Report = {
  screening_id: number;
  patient_code: string;
  patient_display_name: string;
  date: string | null;
  device_id: string | null;
  prediction: string | null;
  confidence: number | null;
  abstained: boolean;
  uncertain?: boolean;
  is_mock?: boolean;
  source?: ScreeningSource;
  top_label?: string | null;
  top_name?: string | null;
  probabilities?: Record<string, number> | null;
  top3?: TopPrediction[] | null;
  timestamp?: string | null;
  model_limitations?: string[];
  not_validated_on_device_images?: boolean;
  model_name: string | null;
  model_version: string | null;
  firmware_version: string | null;
  image_quality_status: string | null;
  title: string;
  disclaimer: string;
};

export type Reminder = {
  id: number;
  patient_id: number;
  medicine: string;
  dosage_text: string;
  frequency: string;
  reminder_time: string;
  start_date: string;
  end_date: string | null;
  is_active: boolean;
  completed_today?: boolean;
  notes: string | null;
  created_at: string | null;
};

export type ReminderCreate = Omit<
  Reminder,
  "id" | "is_active" | "created_at" | "completed_today"
>;
export type ReminderCompletion = { reminder_id: number; completed_on: string };

export type DashboardSummary = {
  total_patients: number;
  screenings_today: number;
  screenings_this_week: number;
  pending_results: number;
  upcoming_reminders: number;
  failed_uploads: number;
  active_ai_model: string;
  model_version?: string | null;
  model_backend?: "mock" | "real";
  device_mode: string;
  ai_mode: string;
  last_sync: string | null;
};
