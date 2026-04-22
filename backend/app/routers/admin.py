from datetime import datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models import AppointmentStatus, DoctorProfile, User, UserRole
from app.schemas import DoctorCreate, DoctorOut
from app.security import hash_password

router = APIRouter(prefix="/admin", tags=["admin"])


@router.post("/doctors", response_model=DoctorOut)
def register_doctor(
    payload: DoctorCreate,
    user: Annotated[User, Depends(require_roles(UserRole.admin))],
    db: Session = Depends(get_db),
):
    if db.query(User).filter(User.email == payload.email).first():
        raise HTTPException(400, detail="Email already registered")
    u = User(
        email=payload.email,
        hashed_password=hash_password(payload.password),
        full_name=payload.full_name,
        role=UserRole.doctor,
    )
    db.add(u)
    db.commit()
    db.refresh(u)
    dp = DoctorProfile(
        user_id=u.id,
        specialty=payload.specialty,
        bio=payload.bio,
        consultation_fee=payload.consultation_fee,
    )
    db.add(dp)
    db.commit()
    db.refresh(dp)
    return DoctorOut(
        id=dp.id,
        user_id=u.id,
        email=u.email,
        full_name=u.full_name,
        specialty=dp.specialty,
        bio=dp.bio,
        consultation_fee=dp.consultation_fee,
    )


@router.get("/users")
def list_users(
    user: Annotated[User, Depends(require_roles(UserRole.admin))],
    db: Session = Depends(get_db),
):
    rows = db.query(User).order_by(User.created_at.desc()).all()
    return [
        {
            "id": u.id,
            "email": u.email,
            "full_name": u.full_name,
            "role": u.role.value,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat(),
        }
        for u in rows
    ]


@router.get("/doctors", response_model=list[DoctorOut])
def list_doctor_profiles(
    user: Annotated[User, Depends(require_roles(UserRole.admin))],
    db: Session = Depends(get_db),
):
    profiles = db.query(DoctorProfile).all()
    out = []
    for dp in profiles:
        u = db.get(User, dp.user_id)
        out.append(
            DoctorOut(
                id=dp.id,
                user_id=dp.user_id,
                email=u.email if u else "",
                full_name=u.full_name if u else "",
                specialty=dp.specialty,
                bio=dp.bio,
                consultation_fee=dp.consultation_fee,
            )
        )
    return out


@router.get("/overview")
def overview(
    user: Annotated[User, Depends(require_roles(UserRole.admin))],
    db: Session = Depends(get_db),
):
    from app.models import (
        Appointment,
        AppointmentSlot,
        ChatMessage,
        ChatSession,
        LabResult,
        MedicalReport,
        PatientNote,
        VitalReading,
    )

    week_ago = datetime.utcnow() - timedelta(days=7)

    A = Appointment
    return {
        "users": db.query(User).count(),
        "patients": db.query(User).filter(User.role == UserRole.patient).count(),
        "doctors": db.query(User).filter(User.role == UserRole.doctor).count(),
        "admins": db.query(User).filter(User.role == UserRole.admin).count(),
        "active_users": db.query(User).filter(User.is_active.is_(True)).count(),
        "users_joined_last_7_days": db.query(User).filter(User.created_at >= week_ago).count(),
        "doctor_profiles": db.query(DoctorProfile).count(),
        "appointments": db.query(A).count(),
        "appointments_pending": db.query(A).filter(A.status == AppointmentStatus.pending).count(),
        "appointments_confirmed": db.query(A).filter(A.status == AppointmentStatus.confirmed).count(),
        "appointments_completed": db.query(A).filter(A.status == AppointmentStatus.completed).count(),
        "appointment_slots": db.query(AppointmentSlot).count(),
        "appointment_slots_open": db.query(AppointmentSlot).filter(AppointmentSlot.is_booked.is_(False)).count(),
        "lab_uploads": db.query(LabResult).count(),
        "chat_sessions": db.query(ChatSession).count(),
        "chat_messages": db.query(ChatMessage).count(),
        "medical_reports": db.query(MedicalReport).count(),
        "vital_readings": db.query(VitalReading).count(),
        "patient_notes": db.query(PatientNote).count(),
    }
