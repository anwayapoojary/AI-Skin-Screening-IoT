from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.deps import auth_ready
from backend.app.models.entities import Patient
from backend.app.schemas.api import PatientCreate, PatientOut

router = APIRouter(dependencies=[Depends(auth_ready)])


@router.get("", response_model=list[PatientOut])
def list_patients(db: Session = Depends(get_db)):
    return db.query(Patient).order_by(Patient.id.desc()).all()


@router.post("", response_model=PatientOut)
def create_patient(body: PatientCreate, db: Session = Depends(get_db)):
    if db.query(Patient).filter(Patient.patient_code == body.patient_code).one_or_none():
        raise HTTPException(status_code=409, detail="patient_code already exists")
    row = Patient(patient_code=body.patient_code, display_name=body.display_name, notes=body.notes)
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/{patient_id}", response_model=PatientOut)
def get_patient(patient_id: int, db: Session = Depends(get_db)):
    row = db.get(Patient, patient_id)
    if not row:
        raise HTTPException(status_code=404, detail="Patient not found")
    return row
