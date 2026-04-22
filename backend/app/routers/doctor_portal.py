from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models import (
    Appointment,
    AppointmentSlot,
    ChatSession,
    DoctorProfile,
    LabResult,
    MedicalReport,
    PatientNote,
    User,
    UserRole,
    VitalReading,
)
from app.schemas import PatientNoteIn, PatientNoteOut

router = APIRouter(prefix="/doctor", tags=["doctor"])


def _doctor_profile(db: Session, user: User) -> DoctorProfile:
    dp = db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
    if not dp:
        raise HTTPException(400, detail="Doctor profile missing")
    return dp


@router.get("/appointments")
def my_appointments(
    user: Annotated[User, Depends(require_roles(UserRole.doctor))],
    db: Session = Depends(get_db),
):
    dp = _doctor_profile(db, user)
    rows = (
        db.query(Appointment)
        .filter(Appointment.doctor_profile_id == dp.id)
        .order_by(Appointment.created_at.desc())
        .all()
    )
    out = []
    for a in rows:
        patient = db.get(User, a.patient_id)
        slot = db.get(AppointmentSlot, a.slot_id)
        out.append(
            {
                "id": a.id,
                "status": a.status.value,
                "patient_notes": a.patient_notes,
                "patient": {"id": patient.id, "full_name": patient.full_name, "email": patient.email},
                "slot": {
                    "start_time": slot.start_time.isoformat() if slot else None,
                    "end_time": slot.end_time.isoformat() if slot else None,
                },
            }
        )
    return out


@router.get("/patients/{patient_id}/summary")
def patient_summary(
    patient_id: int,
    user: Annotated[User, Depends(require_roles(UserRole.doctor))],
    db: Session = Depends(get_db),
):
    dp = _doctor_profile(db, user)
    linked = (
        db.query(Appointment)
        .filter(
            Appointment.patient_id == patient_id,
            Appointment.doctor_profile_id == dp.id,
        )
        .first()
    )
    if not linked:
        raise HTTPException(403, detail="No appointments with this patient")

    patient = db.get(User, patient_id)
    notes = db.query(PatientNote).filter(PatientNote.patient_id == patient_id, PatientNote.doctor_profile_id == dp.id).all()
    reports = db.query(MedicalReport).filter(MedicalReport.patient_id == patient_id).order_by(MedicalReport.created_at.desc()).limit(10).all()
    labs = db.query(LabResult).filter(LabResult.patient_id == patient_id).order_by(LabResult.uploaded_at.desc()).limit(10).all()
    vitals = db.query(VitalReading).filter(VitalReading.patient_id == patient_id).order_by(VitalReading.recorded_at.desc()).limit(20).all()
    chats = db.query(ChatSession).filter(ChatSession.patient_id == patient_id).order_by(ChatSession.created_at.desc()).limit(5).all()

    return {
        "patient": {"id": patient.id, "full_name": patient.full_name, "email": patient.email, "phone": patient.phone},
        "notes": [{"id": n.id, "content": n.content, "created_at": n.created_at.isoformat()} for n in notes],
        "reports": [{"id": r.id, "title": r.title, "created_at": r.created_at.isoformat()} for r in reports],
        "labs": [{"id": l.id, "filename": l.original_filename} for l in labs],
        "vitals": [
            {"pulse": v.pulse_bpm, "spo2": v.spo2_percent, "at": v.recorded_at.isoformat()} for v in vitals
        ],
        "recent_chat_sessions": [{"id": c.id, "title": c.title} for c in chats],
    }


@router.post("/patients/{patient_id}/notes", response_model=PatientNoteOut)
def add_note(
    patient_id: int,
    body: PatientNoteIn,
    user: Annotated[User, Depends(require_roles(UserRole.doctor))],
    db: Session = Depends(get_db),
):
    dp = _doctor_profile(db, user)
    linked = (
        db.query(Appointment)
        .filter(
            Appointment.patient_id == patient_id,
            Appointment.doctor_profile_id == dp.id,
        )
        .first()
    )
    if not linked:
        raise HTTPException(403, detail="No appointments with this patient")
    n = PatientNote(patient_id=patient_id, doctor_profile_id=dp.id, content=body.content)
    db.add(n)
    db.commit()
    db.refresh(n)
    return n
