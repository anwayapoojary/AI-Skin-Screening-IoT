from datetime import date

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.deps import auth_ready
from backend.app.models.entities import MedicationReminder, Patient, ReminderCompletion
from backend.app.schemas.api import (
    ReminderCompletionOut,
    ReminderCreate,
    ReminderListOut,
    ReminderOut,
    ReminderUpdate,
)

router = APIRouter(dependencies=[Depends(auth_ready)])


@router.get("", response_model=list[ReminderListOut])
def list_reminders(patient_id: int | None = None, db: Session = Depends(get_db)):
    q = db.query(MedicationReminder)
    if patient_id is not None:
        q = q.filter(MedicationReminder.patient_id == patient_id)
    rows = q.order_by(MedicationReminder.id.desc()).all()
    completed_ids = {
        reminder_id
        for (reminder_id,) in db.query(ReminderCompletion.reminder_id)
        .filter(ReminderCompletion.completed_on == date.today())
        .all()
    }
    return [
        {
            **ReminderListOut.model_validate(row).model_dump(),
            "completed_today": row.id in completed_ids,
        }
        for row in rows
    ]


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


@router.post("/{reminder_id}/complete", response_model=ReminderCompletionOut)
def complete_reminder(reminder_id: int, db: Session = Depends(get_db)):
    row = db.get(MedicationReminder, reminder_id)
    if not row:
        raise HTTPException(status_code=404, detail="Reminder not found")
    if not row.is_active:
        raise HTTPException(status_code=409, detail="Inactive reminder cannot be completed")

    today = date.today()
    today_text = today.isoformat()
    if row.start_date > today_text or (row.end_date and row.end_date < today_text):
        raise HTTPException(status_code=409, detail="Reminder is not scheduled for today")

    completion = (
        db.query(ReminderCompletion)
        .filter(
            ReminderCompletion.reminder_id == reminder_id,
            ReminderCompletion.completed_on == today,
        )
        .first()
    )
    if completion is None:
        completion = ReminderCompletion(reminder_id=reminder_id, completed_on=today)
        db.add(completion)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            completion = (
                db.query(ReminderCompletion)
                .filter(
                    ReminderCompletion.reminder_id == reminder_id,
                    ReminderCompletion.completed_on == today,
                )
                .first()
            )
            if completion is None:
                raise

    return ReminderCompletionOut(reminder_id=reminder_id, completed_on=today)


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
