from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from backend.app.db.session import get_db
from backend.app.deps import auth_ready
from backend.app.models.entities import Screening
from backend.app.schemas.api import ReportOut
from backend.app.services.reports import build_report

router = APIRouter(dependencies=[Depends(auth_ready)])


@router.get("/{screening_id}", response_model=ReportOut)
def get_report(screening_id: int, db: Session = Depends(get_db)):
    row = db.get(Screening, screening_id)
    if not row:
        raise HTTPException(status_code=404, detail="Screening not found")
    return build_report(row)
