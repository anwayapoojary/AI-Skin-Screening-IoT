from datetime import datetime

from pydantic import BaseModel, Field


class PatientCreate(BaseModel):
    display_name: str = Field(min_length=1, max_length=128)
    notes: str | None = None


class PatientUpdate(BaseModel):
    display_name: str | None = Field(default=None, min_length=1, max_length=128)
    notes: str | None = None


class PatientOut(BaseModel):
    id: int
    patient_code: str
    display_name: str
    notes: str | None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class DeviceOut(BaseModel):
    id: int
    device_id: str
    device_type: str
    firmware_version: str | None
    protocol_version: str
    connection_status: str
    last_seen: datetime | None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class DeviceStatusOut(BaseModel):
    device_id: str
    connected: bool
    state: str
    camera_status: str
    sensor_status: str
    communication_status: str
    firmware_version: str | None
    protocol_version: str
    power_status: str | None
    last_communication: str | None
    display_state: str | None
    button: str | None = None
    flash: str | None = None
    mode: str


class ScreeningOut(BaseModel):
    id: int
    patient_id: int
    device_id: int | None
    image_path: str | None
    image_source: str
    prediction: str | None
    confidence: float | None
    abstained: bool
    model_name: str | None = None
    model_version: str | None
    preprocessing_version: str | None
    image_quality_status: str | None
    device_firmware_version: str | None
    prediction_timestamp: str | None = None
    created_at: datetime | None = None
    disclaimer: str = "Screening indication only. Not a confirmed medical diagnosis or certificate."

    model_config = {"from_attributes": True}


class ScreeningCreate(BaseModel):
    patient_id: int
    image_source: str = "device"


class ReminderCreate(BaseModel):
    patient_id: int
    medicine: str = Field(min_length=1, max_length=128)
    dosage_text: str = Field(min_length=1, max_length=128)
    frequency: str = Field(min_length=1, max_length=64)
    reminder_time: str = Field(min_length=1, max_length=16)
    start_date: str = Field(min_length=1, max_length=16)
    end_date: str | None = None
    notes: str | None = None


class ReminderUpdate(BaseModel):
    medicine: str | None = Field(default=None, min_length=1, max_length=128)
    dosage_text: str | None = Field(default=None, min_length=1, max_length=128)
    frequency: str | None = Field(default=None, min_length=1, max_length=64)
    reminder_time: str | None = Field(default=None, min_length=1, max_length=16)
    start_date: str | None = Field(default=None, min_length=1, max_length=16)
    end_date: str | None = None
    is_active: bool | None = None
    notes: str | None = None


class ReminderOut(BaseModel):
    id: int
    patient_id: int
    medicine: str
    dosage_text: str
    frequency: str
    reminder_time: str
    start_date: str
    end_date: str | None
    is_active: bool
    notes: str | None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class ReportOut(BaseModel):
    screening_id: int
    patient_code: str
    patient_display_name: str
    date: datetime | None
    device_id: str | None
    image_path: str | None
    prediction: str | None
    confidence: float | None
    abstained: bool
    model_name: str | None = None
    model_version: str | None
    firmware_version: str | None
    image_quality_status: str | None
    title: str = "AI Health Screening Report"
    disclaimer: str
