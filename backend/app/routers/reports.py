import time
from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.config import settings
from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import (
    Appointment,
    ChatMessage,
    ChatSession,
    DoctorProfile,
    LabResult,
    MedicalReport,
    User,
    UserRole,
)
from app.schemas import ReportGenerate, ReportOut
from app.services.pdf_service import build_analysis_pdf_from_markdown
from app.services.document_extract import extract_report_text
from app.services.report_service import analyze_uploaded_report_text, create_medical_report

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("/", response_model=list[ReportOut])
def list_reports(
    user: Annotated[User, Depends(require_roles(UserRole.patient))],
    db: Session = Depends(get_db),
):
    return (
        db.query(MedicalReport)
        .filter(MedicalReport.patient_id == user.id)
        .order_by(MedicalReport.created_at.desc())
        .all()
    )


@router.post("/generate", response_model=ReportOut)
async def generate_report(
    payload: ReportGenerate,
    user: Annotated[User, Depends(require_roles(UserRole.patient))],
    db: Session = Depends(get_db),
):
    text_parts: list[str] = []
    session_id = payload.session_id
    if session_id:
        s = db.get(ChatSession, session_id)
        if not s or s.patient_id != user.id:
            raise HTTPException(status_code=404, detail="Session not found")
        msgs = (
            db.query(ChatMessage)
            .filter(ChatMessage.session_id == session_id)
            .order_by(ChatMessage.created_at)
            .all()
        )
        for m in msgs:
            text_parts.append(f"{m.role}: {m.content}")
    if payload.conversation_summary:
        text_parts.append("Notes: " + payload.conversation_summary)
    if not text_parts:
        raise HTTPException(status_code=400, detail="Provide session_id or conversation_summary")

    combined = "\n".join(text_parts)
    report = await create_medical_report(
        db=db,
        patient_id=user.id,
        combined_text=combined,
        session_id=session_id,
        title="Medical intake summary",
    )
    return report


@router.post("/analyze-upload")
async def analyze_uploaded_report(
    user: Annotated[User, Depends(require_roles(UserRole.patient))],
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
):
    Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)
    Path(settings.reports_dir).mkdir(parents=True, exist_ok=True)
    raw = await file.read()
    safe_name = Path(file.filename or "report").name.replace("..", "")
    stored = Path(settings.uploads_dir) / f"report_upload_{user.id}_{safe_name}"
    stored.write_bytes(raw)

    extracted = extract_report_text(raw, safe_name)
    markdown = await analyze_uploaded_report_text(safe_name, extracted)

    pdf_name = f"lab_analysis_{user.id}_{int(time.time() * 1000)}.pdf"
    pdf_full = Path(settings.reports_dir) / pdf_name
    build_analysis_pdf_from_markdown("Lab report analysis", markdown, pdf_full)

    row = LabResult(
        patient_id=user.id,
        original_filename=safe_name,
        stored_path=str(stored),
        analysis_text=markdown,
        analysis_pdf_path=str(pdf_full),
    )
    db.add(row)
    db.commit()
    db.refresh(row)

    return {
        "lab_result_id": row.id,
        "analysis_markdown": markdown,
        "original_filename": safe_name,
    }


@router.get("/{report_id}/pdf")
def download_pdf(
    report_id: int,
    user: Annotated[User, Depends(get_current_user)],
    db: Session = Depends(get_db),
):
    r = db.get(MedicalReport, report_id)
    if not r:
        raise HTTPException(status_code=404, detail="Report not found")

    allowed = False
    if user.role == UserRole.admin:
        allowed = True
    elif user.role == UserRole.patient:
        allowed = r.patient_id == user.id
    elif user.role == UserRole.doctor:
        dp = db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
        if dp:
            linked = (
                db.query(Appointment)
                .filter(
                    Appointment.patient_id == r.patient_id,
                    Appointment.doctor_profile_id == dp.id,
                )
                .first()
            )
            allowed = linked is not None

    if not allowed:
        raise HTTPException(status_code=403, detail="Forbidden")
    if not r.pdf_path or not Path(r.pdf_path).is_file():
        raise HTTPException(status_code=404, detail="PDF missing")
    return FileResponse(r.pdf_path, filename=f"medical_report_{report_id}.pdf", media_type="application/pdf")
