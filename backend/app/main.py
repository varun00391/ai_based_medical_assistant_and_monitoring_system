import logging
import time
from datetime import datetime, timedelta
from pathlib import Path

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware

from app.logging_config import configure_logging

configure_logging()

from app.config import settings
from app.database import Base, SessionLocal, engine
from app.migrations_sqlite import migrate_lab_results_pdf_column
from app.models import AppointmentSlot, DoctorProfile, User, UserRole
from app.routers import admin, appointments, auth, chat, doctor_portal, labs, reports, vitals, voice, voice_agent
from app.security import hash_password

logger = logging.getLogger(__name__)

Base.metadata.create_all(bind=engine)
migrate_lab_results_pdf_column()

app = FastAPI(title="AI Medical Assist API", version="0.1.0")


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start = time.perf_counter()
    try:
        response = await call_next(request)
        dur_ms = (time.perf_counter() - start) * 1000
        logger.info(
            "%s %s -> %s (%.1f ms)",
            request.method,
            request.url.path,
            response.status_code,
            dur_ms,
        )
        return response
    except Exception:
        dur_ms = (time.perf_counter() - start) * 1000
        logger.exception("%s %s failed after %.1f ms", request.method, request.url.path, dur_ms)
        raise


app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list or ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api")
app.include_router(admin.router, prefix="/api")
app.include_router(chat.router, prefix="/api")
app.include_router(reports.router, prefix="/api")
app.include_router(labs.router, prefix="/api")
app.include_router(vitals.router, prefix="/api")
app.include_router(voice.router, prefix="/api")
app.include_router(voice_agent.router, prefix="/api")
app.include_router(appointments.router, prefix="/api")
app.include_router(doctor_portal.router, prefix="/api")

Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)
Path(settings.reports_dir).mkdir(parents=True, exist_ok=True)


@app.on_event("startup")
def log_startup():
    db_url = settings.database_url
    if "@" in db_url:
        db_url = db_url.split("@")[-1]
    logger.info("Starting AI Medical Assist API | DB host tail: %s | CORS origins: %s", db_url, settings.cors_origins_list)


@app.on_event("startup")
def seed_admin():
    if not settings.admin_email or not settings.admin_password:
        return
    db = SessionLocal()
    try:
        if db.query(User).filter(User.email == settings.admin_email).first():
            return
        admin_user = User(
            email=settings.admin_email,
            hashed_password=hash_password(settings.admin_password),
            full_name="Administrator",
            role=UserRole.admin,
        )
        db.add(admin_user)
        db.commit()
    finally:
        db.close()


@app.on_event("startup")
def seed_demo_doctors_and_slots():
    db = SessionLocal()
    try:
        doctors = [
            {
                "email": "dr.anika@demo.local",
                "full_name": "Dr. Anika Sharma",
                "specialty": "Internal Medicine",
                "bio": "Focuses on preventive care, diabetes, and blood-pressure management.",
                "fee": 700.0,
            },
            {
                "email": "dr.rohan@demo.local",
                "full_name": "Dr. Rohan Mehta",
                "specialty": "Cardiology",
                "bio": "Special interest in chest pain evaluation and cardiovascular risk reduction.",
                "fee": 1000.0,
            },
            {
                "email": "dr.neha@demo.local",
                "full_name": "Dr. Neha Iyer",
                "specialty": "Pulmonology",
                "bio": "Treats asthma, breathing issues, and respiratory recovery plans.",
                "fee": 900.0,
            },
        ]

        for doc in doctors:
            user = db.query(User).filter(User.email == doc["email"]).first()
            if not user:
                user = User(
                    email=doc["email"],
                    hashed_password=hash_password("Doctor@123"),
                    full_name=doc["full_name"],
                    role=UserRole.doctor,
                )
                db.add(user)
                db.commit()
                db.refresh(user)

            profile = db.query(DoctorProfile).filter(DoctorProfile.user_id == user.id).first()
            if not profile:
                profile = DoctorProfile(
                    user_id=user.id,
                    specialty=doc["specialty"],
                    bio=doc["bio"],
                    consultation_fee=doc["fee"],
                )
                db.add(profile)
                db.commit()
                db.refresh(profile)

            has_slots = db.query(AppointmentSlot).filter(AppointmentSlot.doctor_profile_id == profile.id).first()
            if not has_slots:
                start_base = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
                for day_offset in range(3):
                    for hour in [10, 12, 15]:
                        st = start_base + timedelta(days=day_offset, hours=hour)
                        et = st + timedelta(minutes=30)
                        db.add(
                            AppointmentSlot(
                                doctor_profile_id=profile.id,
                                start_time=st,
                                end_time=et,
                                is_booked=False,
                            )
                        )
                db.commit()
    finally:
        db.close()


@app.get("/api/health")
def health():
    return {"status": "ok"}
