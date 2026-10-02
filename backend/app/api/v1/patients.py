import uuid

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.deps import auth_ready
from backend.app.models.entities import Patient
from backend.app.schemas.api import PatientCreate, PatientOut, PatientUpdate

router = APIRouter(dependencies=[Depends(auth_ready)])


def _generate_patient_code() -> str:
    """Generate a unique patient code. Format: PAT-XXXXXXXX."""
    return f"PAT-{uuid.uuid4().hex[:8].upper()}"


@router.get("", response_model=list[PatientOut])
def list_patients(
    q: str | None = Query(default=None, description="Search by code or name"),
    db: Session = Depends(get_db),
):
    query = db.query(Patient)
    if q:
        like = f"%{q}%"
        query = query.filter(
            Patient.patient_code.ilike(like) | Patient.display_name.ilike(like)
        )
    return query.order_by(Patient.id.desc()).all()


@router.post("", response_model=PatientOut)
def create_patient(body: PatientCreate, db: Session = Depends(get_db)):
    code = _generate_patient_code()
    # Ensure uniqueness (extremely unlikely collision)
    while db.query(Patient).filter(Patient.patient_code == code).one_or_none():
        code = _generate_patient_code()  # pragma: no cover
    row = Patient(patient_code=code, display_name=body.display_name, notes=body.notes)
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


@router.put("/{patient_id}", response_model=PatientOut)
def update_patient(patient_id: int, body: PatientUpdate, db: Session = Depends(get_db)):
    row = db.get(Patient, patient_id)
    if not row:
        raise HTTPException(status_code=404, detail="Patient not found")
    if body.display_name is not None:
        row.display_name = body.display_name
    if body.notes is not None:
        row.notes = body.notes
    db.commit()
    db.refresh(row)
    return row
