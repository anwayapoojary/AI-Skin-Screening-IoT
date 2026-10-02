from datetime import datetime

from sqlalchemy import Boolean, DateTime, Float, ForeignKey, Integer, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column, relationship

from backend.app.db.base import Base


class Patient(Base):
    __tablename__ = "patients"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_code: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    display_name: Mapped[str] = mapped_column(String(128))
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    screenings: Mapped[list["Screening"]] = relationship(back_populates="patient")
    reminders: Mapped[list["MedicationReminder"]] = relationship(back_populates="patient")


class Device(Base):
    __tablename__ = "devices"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    device_id: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    device_type: Mapped[str] = mapped_column(String(64), default="unknown")
    firmware_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    protocol_version: Mapped[str] = mapped_column(String(16), default="1.0")
    connection_status: Mapped[str] = mapped_column(String(32), default="OFFLINE")
    last_seen: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    events: Mapped[list["DeviceEvent"]] = relationship(back_populates="device")
    sensor_readings: Mapped[list["SensorReading"]] = relationship(back_populates="device")
    screenings: Mapped[list["Screening"]] = relationship(back_populates="device")


class Screening(Base):
    __tablename__ = "screenings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    device_id: Mapped[int | None] = mapped_column(ForeignKey("devices.id"), nullable=True)
    image_path: Mapped[str | None] = mapped_column(String(512), nullable=True)
    image_source: Mapped[str] = mapped_column(String(32), default="device")
    prediction: Mapped[str | None] = mapped_column(String(128), nullable=True)
    confidence: Mapped[float | None] = mapped_column(Float, nullable=True)
    abstained: Mapped[bool] = mapped_column(Boolean, default=False)
    model_name: Mapped[str | None] = mapped_column(String(64), nullable=True)
    model_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    preprocessing_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    image_quality_status: Mapped[str | None] = mapped_column(String(32), nullable=True)
    device_firmware_version: Mapped[str | None] = mapped_column(String(64), nullable=True)
    prediction_timestamp: Mapped[str | None] = mapped_column(String(64), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    patient: Mapped[Patient] = relationship(back_populates="screenings")
    device: Mapped[Device | None] = relationship(back_populates="screenings")


class DeviceEvent(Base):
    __tablename__ = "device_events"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    device_pk: Mapped[int] = mapped_column(ForeignKey("devices.id"))
    message_type: Mapped[str] = mapped_column(String(64))
    payload_json: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    device: Mapped[Device] = relationship(back_populates="events")


class SensorReading(Base):
    __tablename__ = "sensor_readings"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    device_pk: Mapped[int] = mapped_column(ForeignKey("devices.id"))
    name: Mapped[str] = mapped_column(String(64))
    value: Mapped[float | None] = mapped_column(Float, nullable=True)
    unit: Mapped[str | None] = mapped_column(String(64), nullable=True)
    status: Mapped[str] = mapped_column(String(32))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    device: Mapped[Device] = relationship(back_populates="sensor_readings")


class MedicationReminder(Base):
    __tablename__ = "medication_reminders"

    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    patient_id: Mapped[int] = mapped_column(ForeignKey("patients.id"))
    medicine: Mapped[str] = mapped_column(String(128))
    dosage_text: Mapped[str] = mapped_column(String(128))
    frequency: Mapped[str] = mapped_column(String(64))
    reminder_time: Mapped[str] = mapped_column(String(16))
    start_date: Mapped[str] = mapped_column(String(16))
    end_date: Mapped[str | None] = mapped_column(String(16), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    patient: Mapped[Patient] = relationship(back_populates="reminders")
