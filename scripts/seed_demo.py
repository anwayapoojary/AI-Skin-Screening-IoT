from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app.db.session import SessionLocal, init_db
from backend.app.models.entities import Patient


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        if not db.query(Patient).filter(Patient.patient_code == "DEMO-001").one_or_none():
            db.add(
                Patient(
                    patient_code="DEMO-001",
                    display_name="Demo Patient One",
                    notes="Synthetic development record. Not a real person.",
                )
            )
            db.commit()
            print("Seeded DEMO-001")
        else:
            print("DEMO-001 already present")
    finally:
        db.close()


if __name__ == "__main__":
    main()
