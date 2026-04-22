from typing import Annotated

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models import User, UserRole, VitalReading
from app.schemas import VitalIn, VitalOut

router = APIRouter(prefix="/vitals", tags=["vitals"])


@router.post("/reading", response_model=VitalOut)
def add_reading(
    payload: VitalIn,
    user: Annotated[User, Depends(require_roles(UserRole.patient))],
    db: Session = Depends(get_db),
):
    row = VitalReading(
        patient_id=user.id,
        pulse_bpm=payload.pulse_bpm,
        spo2_percent=payload.spo2_percent,
        source=payload.source,
    )
    db.add(row)
    db.commit()
    db.refresh(row)
    return row


@router.get("/latest", response_model=list[VitalOut])
def latest(
    user: Annotated[User, Depends(require_roles(UserRole.patient))],
    db: Session = Depends(get_db),
    limit: int = 50,
):
    return (
        db.query(VitalReading)
        .filter(VitalReading.patient_id == user.id)
        .order_by(VitalReading.recorded_at.desc())
        .limit(limit)
        .all()
    )
