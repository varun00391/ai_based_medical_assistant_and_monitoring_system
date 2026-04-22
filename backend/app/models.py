import enum
from datetime import datetime

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Enum as SQLEnum,
    Float,
    ForeignKey,
    Integer,
    String,
    Text,
)
from sqlalchemy.orm import relationship

from app.database import Base


class UserRole(str, enum.Enum):
    patient = "patient"
    doctor = "doctor"
    admin = "admin"


class AppointmentStatus(str, enum.Enum):
    pending = "pending"
    confirmed = "confirmed"
    cancelled = "cancelled"
    completed = "completed"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String(255), unique=True, index=True, nullable=False)
    hashed_password = Column(String(255), nullable=False)
    full_name = Column(String(255), nullable=False)
    role = Column(
        SQLEnum(UserRole, native_enum=False, length=32),
        nullable=False,
        default=UserRole.patient,
    )
    phone = Column(String(64), nullable=True)
    is_active = Column(Boolean, default=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    doctor_profile = relationship("DoctorProfile", back_populates="user", uselist=False)
    appointments_as_patient = relationship(
        "Appointment", foreign_keys="Appointment.patient_id", back_populates="patient"
    )


class DoctorProfile(Base):
    __tablename__ = "doctor_profiles"

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, ForeignKey("users.id"), unique=True, nullable=False)
    specialty = Column(String(255), nullable=False)
    bio = Column(Text, nullable=True)
    consultation_fee = Column(Float, nullable=True)

    user = relationship("User", back_populates="doctor_profile")
    slots = relationship("AppointmentSlot", back_populates="doctor")
    appointments = relationship("Appointment", back_populates="doctor")


class AppointmentSlot(Base):
    __tablename__ = "appointment_slots"

    id = Column(Integer, primary_key=True)
    doctor_profile_id = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=False)
    start_time = Column(DateTime, nullable=False)
    end_time = Column(DateTime, nullable=False)
    is_booked = Column(Boolean, default=False)

    doctor = relationship("DoctorProfile", back_populates="slots")
    appointment = relationship("Appointment", back_populates="slot", uselist=False)


class Appointment(Base):
    __tablename__ = "appointments"

    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    doctor_profile_id = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=False)
    slot_id = Column(Integer, ForeignKey("appointment_slots.id"), nullable=False)
    status = Column(
        SQLEnum(AppointmentStatus, native_enum=False, length=32),
        default=AppointmentStatus.pending,
    )
    patient_notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    patient = relationship("User", foreign_keys=[patient_id], back_populates="appointments_as_patient")
    doctor = relationship("DoctorProfile", back_populates="appointments")
    slot = relationship("AppointmentSlot", back_populates="appointment")


class ChatSession(Base):
    __tablename__ = "chat_sessions"

    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    title = Column(String(512), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    messages = relationship("ChatMessage", back_populates="session")


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id = Column(Integer, primary_key=True)
    session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=False)
    role = Column(String(32), nullable=False)  # user | assistant | system
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    session = relationship("ChatSession", back_populates="messages")


class MedicalReport(Base):
    __tablename__ = "medical_reports"

    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    chat_session_id = Column(Integer, ForeignKey("chat_sessions.id"), nullable=True)
    title = Column(String(512), nullable=False)
    summary_text = Column(Text, nullable=False)
    suggested_tests = Column(Text, nullable=True)  # JSON or newline list
    pdf_path = Column(String(1024), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)


class LabResult(Base):
    __tablename__ = "lab_results"

    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    original_filename = Column(String(512), nullable=False)
    stored_path = Column(String(1024), nullable=False)
    analysis_text = Column(Text, nullable=True)
    analysis_pdf_path = Column(String(1024), nullable=True)
    uploaded_at = Column(DateTime, default=datetime.utcnow)


class VitalReading(Base):
    __tablename__ = "vital_readings"

    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    pulse_bpm = Column(Float, nullable=True)
    spo2_percent = Column(Float, nullable=True)
    source = Column(String(128), nullable=True)
    recorded_at = Column(DateTime, default=datetime.utcnow)


class PatientNote(Base):
    """Doctor-visible notes per patient (simple history)."""

    __tablename__ = "patient_notes"

    id = Column(Integer, primary_key=True)
    patient_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    doctor_profile_id = Column(Integer, ForeignKey("doctor_profiles.id"), nullable=False)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)
