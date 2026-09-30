export const API = "/api/v1";

async function parse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  return res.json() as Promise<T>;
}

export const api = {
  health: () => fetch(`${API}/health`).then((r) => parse(r)),
  patients: {
    list: () => fetch(`${API}/patients`).then((r) => parse<Patient[]>(r)),
    get: (id: number) => fetch(`${API}/patients/${id}`).then((r) => parse<Patient>(r)),
    create: (body: { patient_code: string; display_name: string; notes?: string }) =>
      fetch(`${API}/patients`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => parse<Patient>(r)),
  },
  devices: {
    list: () => fetch(`${API}/devices`).then((r) => parse<DeviceRow[]>(r)),
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
        body: JSON.stringify({ patient_id, image_source: "device" }),
      }).then((r) => parse<Screening>(r)),
    upload: (patient_id: number, file: File) => {
      const fd = new FormData();
      fd.append("patient_id", String(patient_id));
      fd.append("file", file);
      return fetch(`${API}/screenings/upload`, { method: "POST", body: fd }).then((r) =>
        parse<Screening>(r),
      );
    },
  },
  reports: {
    get: (screeningId: number) =>
      fetch(`${API}/reports/${screeningId}`).then((r) => parse<Report>(r)),
  },
  reminders: {
    list: () => fetch(`${API}/reminders`).then((r) => parse<Reminder[]>(r)),
    create: (body: ReminderCreate) =>
      fetch(`${API}/reminders`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      }).then((r) => parse<Reminder>(r)),
  },
};

export type Patient = {
  id: number;
  patient_code: string;
  display_name: string;
  notes: string | null;
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

export type SensorRow = { name: string; value: number | null; unit: string | null; status: string };

export type Screening = {
  id: number;
  patient_id: number;
  device_id: number | null;
  image_path: string | null;
  image_source: string;
  prediction: string | null;
  confidence: number | null;
  abstained: boolean;
  model_version: string | null;
  preprocessing_version: string | null;
  image_quality_status: string | null;
  device_firmware_version: string | null;
  created_at: string | null;
  disclaimer: string;
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
  notes: string | null;
};

export type ReminderCreate = Omit<Reminder, "id">;
