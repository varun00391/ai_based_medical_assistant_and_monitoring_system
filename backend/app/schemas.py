from datetime import datetime
from typing import Literal, Optional

from pydantic import BaseModel, EmailStr, Field

AgentMode = Literal["auto", "intake", "wellness", "scheduling", "clinical_documentation"]

from app.models import AppointmentStatus, UserRole


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"


class UserBase(BaseModel):
    email: EmailStr
    full_name: str = Field(..., min_length=1)
    phone: Optional[str] = None


class UserRegister(UserBase):
    password: str = Field(..., min_length=8)


class LoginIn(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=1)


class UserOut(UserBase):
    id: int
    role: UserRole
    is_active: bool
    created_at: datetime

    class Config:
        from_attributes = True


class DoctorCreate(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=8)
    full_name: str
    specialty: str
    bio: Optional[str] = None
    consultation_fee: Optional[float] = None


class DoctorOut(BaseModel):
    id: int
    user_id: int
    email: str
    full_name: str
    specialty: str
    bio: Optional[str]
    consultation_fee: Optional[float]

    class Config:
        from_attributes = True


class AppointmentSlotCreate(BaseModel):
    start_time: datetime
    end_time: datetime


class AppointmentSlotOut(BaseModel):
    id: int
    doctor_profile_id: int
    start_time: datetime
    end_time: datetime
    is_booked: bool

    class Config:
        from_attributes = True


class AppointmentBook(BaseModel):
    slot_id: int
    patient_notes: Optional[str] = None


class AppointmentOut(BaseModel):
    id: int
    patient_id: int
    doctor_profile_id: int
    slot_id: int
    status: AppointmentStatus
    patient_notes: Optional[str]
    created_at: datetime
    slot: Optional[AppointmentSlotOut] = None

    class Config:
        from_attributes = True


class DoctorSummaryOut(BaseModel):
    full_name: str
    specialty: str
    bio: Optional[str]
    consultation_fee: Optional[float]


class AppointmentMineOut(BaseModel):
    """Patient-facing appointment with doctor details."""

    id: int
    status: AppointmentStatus
    patient_notes: Optional[str]
    created_at: datetime
    slot: Optional[AppointmentSlotOut] = None
    doctor: DoctorSummaryOut


class ChatMessageIn(BaseModel):
    content: str = Field(..., min_length=1)
    session_id: Optional[int] = None
    agent_mode: AgentMode = Field(
        default="auto",
        description="auto: LLM router selects specialist; otherwise pin to one agent.",
    )


class ChatMessageOut(BaseModel):
    id: int
    role: str
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class ChatSessionOut(BaseModel):
    id: int
    title: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class ChatReply(BaseModel):
    session_id: int
    messages: list[ChatMessageOut]
    agent_trace: Optional[list[str]] = None


class ReportGenerate(BaseModel):
    session_id: Optional[int] = None
    conversation_summary: Optional[str] = None


class ReportOut(BaseModel):
    id: int
    title: str
    summary_text: str
    suggested_tests: Optional[str]
    pdf_path: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class LabAnalyzeResponse(BaseModel):
    id: int
    analysis_text: Optional[str]
    original_filename: str


class VitalIn(BaseModel):
    pulse_bpm: Optional[float] = None
    spo2_percent: Optional[float] = None
    source: Optional[str] = "device"


class VitalOut(BaseModel):
    id: int
    pulse_bpm: Optional[float]
    spo2_percent: Optional[float]
    source: Optional[str]
    recorded_at: datetime

    class Config:
        from_attributes = True


class PatientNoteIn(BaseModel):
    content: str = Field(..., min_length=1)


class PatientNoteOut(BaseModel):
    id: int
    patient_id: int
    content: str
    created_at: datetime

    class Config:
        from_attributes = True


class STTRequest(BaseModel):
    """Optional hint text when sending audio as base64."""

    mime_type: str = "audio/webm"


class TTSRequest(BaseModel):
    text: str = Field(..., min_length=1)
