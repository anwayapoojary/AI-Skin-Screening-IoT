import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
os.environ["DATABASE_URL"] = "sqlite:///" + (ROOT / "data" / "pytest.db").as_posix()
os.environ["UPLOAD_DIR"] = str(ROOT / "data" / "test-uploads")
os.environ["DEVICE_MODE"] = "simulation"
os.environ["AI_MODE"] = "mock"
sys.path.insert(0, str(ROOT))

(ROOT / "data" / "test-uploads").mkdir(parents=True, exist_ok=True)
dbfile = ROOT / "data" / "pytest.db"
if dbfile.exists():
    dbfile.unlink()
