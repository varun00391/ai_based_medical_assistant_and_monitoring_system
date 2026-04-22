from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import LabResult, User, UserRole
from app.schemas import LabAnalyzeResponse
from app.services.document_extract import extract_report_text
from app.services.groq_service import analyze_report_markdown_complete

router = APIRouter(prefix="/labs", tags=["labs"])

@router.post("/upload", response_model=LabAnalyzeResponse)
async def upload_lab(
    user: Annotated[User, Depends(require_roles(UserRole.patient))],
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)
    raw = await file.read()
    safe_name = Path(file.filename or "upload").name.replace("..", "")
    stored = Path(settings.uploads_dir) / f"{user.id}_{safe_name}"
    stored.write_bytes(raw)

    extracted = extract_report_text(raw, safe_name)
    analysis = await analyze_report_markdown_complete(safe_name, extracted)

    row = LabResult(
        patient_id=user.id,
        original_filename=safe_name,
        stored_path=str(stored),
        analysis_text=analysis,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return LabAnalyzeResponse(id=row.id, analysis_text=row.analysis_text, original_filename=row.original_filename)


@router.get("/results")
def list_results(
    user: Annotated[User, Depends(require_roles(UserRole.patient))],
    db: Session = Depends(get_db),
):
    rows = db.query(LabResult).filter(LabResult.patient_id == user.id).order_by(LabResult.uploaded_at.desc()).all()
    return [
        {
            "id": r.id,
            "original_filename": r.original_filename,
            "analysis_text": r.analysis_text,
            "uploaded_at": r.uploaded_at.isoformat(),
            "has_pdf": bool(r.analysis_pdf_path and Path(r.analysis_pdf_path).is_file()),
        }
        for r in rows
    ]


@router.get("/{lab_id}/pdf")
def download_lab_pdf(
    lab_id: int,
    user: Annotated[User, Depends(require_roles(UserRole.patient))],
    db: Session = Depends(get_db),
):
    r = db.get(LabResult, lab_id)
    if not r or r.patient_id != user.id:
        raise HTTPException(status_code=404, detail="Not found")
    if not r.analysis_pdf_path or not Path(r.analysis_pdf_path).is_file():
        raise HTTPException(status_code=404, detail="PDF not available for this upload")
    safe = Path(r.original_filename).name.replace("..", "") or "analysis.pdf"
    return FileResponse(
        r.analysis_pdf_path,
        filename=f"analysis_{lab_id}_{safe}.pdf",
        media_type="application/pdf",
    )
