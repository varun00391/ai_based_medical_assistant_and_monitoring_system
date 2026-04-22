from typing import Annotated, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import get_current_user, require_roles
from app.models import (
    Appointment,
    AppointmentSlot,
    AppointmentStatus,
    DoctorProfile,
    User,
    UserRole,
)
from app.schemas import (
    AppointmentBook,
    AppointmentMineOut,
    AppointmentOut,
    AppointmentSlotCreate,
    AppointmentSlotOut,
    DoctorOut,
    DoctorSummaryOut,
)

router = APIRouter(prefix="/appointments", tags=["appointments"])


def _doctor_out(db: Session, dp: DoctorProfile) -> DoctorOut:
    u = db.get(User, dp.user_id)
    return DoctorOut(
        id=dp.id,
        user_id=dp.user_id,
        email=u.email if u else "",
        full_name=u.full_name if u else "",
        specialty=dp.specialty,
        bio=dp.bio,
        consultation_fee=dp.consultation_fee,
    )


@router.get("/specialties", response_model=list[str])
def list_specialties(db: Session = Depends(get_db)):
    stmt = select(DoctorProfile.specialty).distinct().order_by(DoctorProfile.specialty)
    rows = db.execute(stmt).scalars().all()
    return [s for s in rows if s]


@router.get("/doctors", response_model=list[DoctorOut])
def list_doctors(
    db: Session = Depends(get_db),
    specialty: Optional[str] = Query(default=None, description="Exact specialty string from /specialties"),
):
    q = db.query(DoctorProfile)
    if specialty and specialty.strip():
        q = q.filter(DoctorProfile.specialty.ilike(specialty.strip()))
    profiles = q.order_by(DoctorProfile.id).all()
    return [_doctor_out(db, p) for p in profiles]


@router.get("/doctors/{doctor_profile_id}/slots", response_model=list[AppointmentSlotOut])
def list_open_slots(doctor_profile_id: int, db: Session = Depends(get_db)):
    dp = db.get(DoctorProfile, doctor_profile_id)
    if not dp:
        raise HTTPException(404, detail="Doctor not found")
    slots = (
        db.query(AppointmentSlot)
        .filter(
            AppointmentSlot.doctor_profile_id == doctor_profile_id,
            AppointmentSlot.is_booked.is_(False),
        )
        .order_by(AppointmentSlot.start_time)
        .all()
    )
    return slots


@router.post("/book", response_model=AppointmentOut)
def book(
    payload: AppointmentBook,
    user: Annotated[User, Depends(require_roles(UserRole.patient))],
    db: Session = Depends(get_db),
):
    slot = db.get(AppointmentSlot, payload.slot_id)
    if not slot or slot.is_booked:
        raise HTTPException(400, detail="Slot not available")
    ap = Appointment(
        patient_id=user.id,
        doctor_profile_id=slot.doctor_profile_id,
        slot_id=slot.id,
        status=AppointmentStatus.confirmed,
        patient_notes=payload.patient_notes,
    )
    slot.is_booked = True
    db.add(ap)
    db.commit()
    db.refresh(ap)
    ap.slot = slot
    return ap


@router.get("/mine", response_model=list[AppointmentMineOut])
def my_appointments(
    user: Annotated[User, Depends(require_roles(UserRole.patient))],
    db: Session = Depends(get_db),
):
    rows = db.query(Appointment).filter(Appointment.patient_id == user.id).order_by(Appointment.created_at.desc()).all()
    out: list[AppointmentMineOut] = []
    for r in rows:
        slot = db.get(AppointmentSlot, r.slot_id)
        dp = db.get(DoctorProfile, r.doctor_profile_id)
        doc_user = db.get(User, dp.user_id) if dp else None
        doctor = DoctorSummaryOut(
            full_name=doc_user.full_name if doc_user else "Unknown",
            specialty=dp.specialty if dp else "",
            bio=dp.bio if dp else None,
            consultation_fee=dp.consultation_fee if dp else None,
        )
        slot_out = AppointmentSlotOut.model_validate(slot) if slot else None
        out.append(
            AppointmentMineOut(
                id=r.id,
                status=r.status,
                patient_notes=r.patient_notes,
                created_at=r.created_at,
                slot=slot_out,
                doctor=doctor,
            )
        )
    return out


@router.post("/doctor/slots", response_model=AppointmentSlotOut)
def create_slot(
    payload: AppointmentSlotCreate,
    user: Annotated[User, Depends(require_roles(UserRole.doctor))],
    db: Session = Depends(get_db),
):
    dp = db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
    if not dp:
        raise HTTPException(400, detail="Doctor profile missing")
    if payload.end_time <= payload.start_time:
        raise HTTPException(400, detail="Invalid time range")
    slot = AppointmentSlot(
        doctor_profile_id=dp.id,
        start_time=payload.start_time,
        end_time=payload.end_time,
        is_booked=False,
    )
    db.add(slot)
    db.commit()
    db.refresh(slot)
    return slot
