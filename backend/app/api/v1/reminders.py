from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.deps import auth_ready
from backend.app.models.entities import MedicationReminder, Patient
from backend.app.schemas.api import ReminderCreate, ReminderOut, ReminderUpdate

router = APIRouter(dependencies=[Depends(auth_ready)])


@router.get("", response_model=list[ReminderOut])
def list_reminders(patient_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(MedicationReminder)
    if patient_id is not None:
        q = q.filter(MedicationReminder.patient_id == patient_id)
    return q.order_by(MedicationReminder.id.desc()).all()


@router.post("", response_model=ReminderOut)
def create_reminder(body: ReminderCreate, db: Session = Depends(get_db)):
    if not db.get(Patient, body.patient_id):
        raise HTTPException(status_code=404, detail="Patient not found")
    row = MedicationReminder(**body.model_dump())
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{reminder_id}", response_model=ReminderOut)
def get_reminder(reminder_id: int, db: Session = Depends(get_db)):
    row = db.get(MedicationReminder, reminder_id)
    if not row:
        raise HTTPException(status_code=404, detail="Reminder not found")
    return row


@router.put("/{reminder_id}", response_model=ReminderOut)
def update_reminder(reminder_id: int, body: ReminderUpdate, db: Session = Depends(get_db)):
    row = db.get(MedicationReminder, reminder_id)
    if not row:
        raise HTTPException(status_code=404, detail="Reminder not found")
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(row, field, value)
    db.commit()
    db.refresh(row)
    return row


@router.delete("/{reminder_id}")
def delete_reminder(reminder_id: int, db: Session = Depends(get_db)):
    row = db.get(MedicationReminder, reminder_id)
    if not row:
        raise HTTPException(status_code=404, detail="Reminder not found")
    db.delete(row)
    db.commit()
    return {"ok": True, "deleted_id": reminder_id}
