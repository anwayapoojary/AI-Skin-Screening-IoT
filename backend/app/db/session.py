from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from backend.app.config import settings
from backend.app.db.base import Base
from backend.app.models import entities  # noqa: F401

settings.ensure_dirs()
connect_args = {"check_same_thread": False} if settings.database_url.startswith("sqlite") else {}
engine = create_engine(settings.database_url, connect_args=connect_args)
SessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)


def init_db() -> None:
    Base.metadata.create_all(bind=engine)
    if settings.database_url.startswith("sqlite"):
        defaults = {
            ("screenings", "source"): "'simulated'",
            ("screenings", "uncertain"): "0",
            ("screenings", "is_mock"): "1",
        }
        with engine.begin() as conn:
            for table_name, table in Base.metadata.tables.items():
                existing = {
                    row[1]
                    for row in conn.exec_driver_sql(
                        f"PRAGMA table_info({table_name})"
                    ).fetchall()
                }
                for column in table.columns:
                    if column.name in existing:
                        continue
                    default = defaults.get((table_name, column.name))
                    definition = f"{column.type}"
                    if default is not None:
                        definition += f" DEFAULT {default}"
                    conn.exec_driver_sql(
                        f"ALTER TABLE {table_name} ADD COLUMN {column.name} {definition}"
                    )
            conn.exec_driver_sql(
                "UPDATE screenings SET source = image_source WHERE source = 'simulated'"
            )


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
