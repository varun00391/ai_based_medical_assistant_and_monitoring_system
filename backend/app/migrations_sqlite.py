"""Best-effort ALTER for added columns without Alembic."""

from pathlib import Path

from sqlalchemy import inspect, text

from app.config import settings
from app.database import engine


def migrate_lab_results_pdf_column():
    url = settings.database_url
    if url.startswith("sqlite"):
        db_file = Path(url.replace("sqlite:///", ""))
        if not db_file.is_absolute():
            db_file = Path.cwd() / db_file
        if not db_file.exists():
            return
        import sqlite3

        conn = sqlite3.connect(str(db_file))
        try:
            cols = [r[1] for r in conn.execute("PRAGMA table_info(lab_results)").fetchall()]
            if cols and "analysis_pdf_path" not in cols:
                conn.execute("ALTER TABLE lab_results ADD COLUMN analysis_pdf_path VARCHAR(1024)")
                conn.commit()
        finally:
            conn.close()
        return

    insp = inspect(engine)
    if not insp.has_table("lab_results"):
        return
    cols = [c["name"] for c in insp.get_columns("lab_results")]
    if "analysis_pdf_path" in cols:
        return
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE lab_results ADD COLUMN analysis_pdf_path VARCHAR(1024)"))
        conn.commit()
