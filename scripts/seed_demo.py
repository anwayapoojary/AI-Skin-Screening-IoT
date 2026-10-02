from __future__ import annotations

import sys
import uuid
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from backend.app.db.session import SessionLocal, init_db
from backend.app.models.entities import Patient


def _gen_code() -> str:
    return f"PAT-{uuid.uuid4().hex[:8].upper()}"


DEMO_PATIENTS = [
    {"display_name": "Demo Patient One", "notes": "Synthetic development record. Not a real person."},
    {"display_name": "Demo Patient Two", "notes": "Synthetic record for testing screening flow."},
    {"display_name": "Demo Patient Three", "notes": "Synthetic record for reminders testing."},
]


def main() -> None:
    init_db()
    db = SessionLocal()
    try:
        existing = db.query(Patient).count()
        if existing >= len(DEMO_PATIENTS):
            print(f"Already {existing} patients, skipping seed.")
            return
        for p in DEMO_PATIENTS:
            # Check if a patient with this name already exists
            if db.query(Patient).filter(Patient.display_name == p["display_name"]).one_or_none():
                continue
            code = _gen_code()
            db.add(Patient(patient_code=code, display_name=p["display_name"], notes=p["notes"]))
            print(f"Seeded {code}: {p['display_name']}")
        db.commit()
    finally:
        db.close()


if __name__ == "__main__":
    main()
