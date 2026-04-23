from pathlib import Path
from typing import Annotated

from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.database import get_db
from app.dependencies import require_roles
from app.models import ChatMessage, ChatSession, User, UserRole
from app.schemas import ChatMessageIn, ChatMessageOut, ChatReply, ChatSessionOut
from app.agents.orchestrator import run_chat_with_agents
from app.services.document_extract import extract_report_text
from app.agents.report_pipeline import run_agentic_report_analysis
from app.services.report_service import create_medical_report

router = APIRouter(prefix="/chat", tags=["chat"])


@router.get("/sessions", response_model=list[ChatSessionOut])
def list_sessions(
    user: Annotated[User, Depends(require_roles(UserRole.patient))],
    db: Session = Depends(get_db),
):
    rows = db.query(ChatSession).filter(ChatSession.patient_id == user.id).order_by(ChatSession.created_at.desc()).all()
    return rows


@router.post("/sessions", response_model=ChatSessionOut)
def create_session(
    user: Annotated[User, Depends(require_roles(UserRole.patient))],
    db: Session = Depends(get_db),
):
    s = ChatSession(patient_id=user.id, title="New conversation")
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


@router.get("/sessions/{session_id}/messages", response_model=list[ChatMessageOut])
def get_messages(
    session_id: int,
    user: Annotated[User, Depends(require_roles(UserRole.patient))],
    db: Session = Depends(get_db),
):
    s = db.get(ChatSession, session_id)
    if not s or s.patient_id != user.id:
        raise HTTPException(status_code=404, detail="Session not found")
    return db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at).all()


@router.post("/message", response_model=ChatReply)
async def send_message(
    payload: ChatMessageIn,
    user: Annotated[User, Depends(require_roles(UserRole.patient))],
    db: Session = Depends(get_db),
):
    session_id = payload.session_id
    if session_id:
        s = db.get(ChatSession, session_id)
        if not s or s.patient_id != user.id:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        s = ChatSession(patient_id=user.id, title="Consultation")
        db.add(s)
        db.commit()
        db.refresh(s)
        session_id = s.id

    db.add(ChatMessage(session_id=session_id, role="user", content=payload.content))
    db.commit()

    history = (
        db.query(ChatMessage)
        .filter(ChatMessage.session_id == session_id)
        .order_by(ChatMessage.created_at)
        .all()
    )
    messages = [{"role": m.role, "content": m.content} for m in history]
    reply_text, agent_trace = await run_chat_with_agents(
        messages,
        agent_mode=payload.agent_mode,
        voice_concise=payload.voice_concise,
    )

    assistant_msg = ChatMessage(session_id=session_id, role="assistant", content=reply_text)
    db.add(assistant_msg)
    db.commit()
    db.refresh(assistant_msg)

    msgs = (
        db.query(ChatMessage).filter(ChatMessage.session_id == session_id).order_by(ChatMessage.created_at).all()
    )
    if not payload.voice_concise:
        combined = "\n".join([f"{m.role}: {m.content}" for m in msgs])
        await create_medical_report(
            db=db,
            patient_id=user.id,
            combined_text=combined,
            session_id=session_id,
            title="Auto-generated chat analysis report",
        )
    return ChatReply(session_id=session_id, messages=msgs, agent_trace=agent_trace)


@router.post("/analyze-report", response_model=ChatReply)
async def analyze_report_in_chat(
    user: Annotated[User, Depends(require_roles(UserRole.patient))],
    file: UploadFile = File(...),
    session_id: int | None = Form(default=None),
    db: Session = Depends(get_db),
):
    active_session_id = session_id
    if active_session_id:
        s = db.get(ChatSession, active_session_id)
        if not s or s.patient_id != user.id:
            raise HTTPException(status_code=404, detail="Session not found")
    else:
        s = ChatSession(patient_id=user.id, title="Report analysis")
        db.add(s)
        db.commit()
        db.refresh(s)
        active_session_id = s.id

    raw = await file.read()
    filename = Path(file.filename or "report").name.replace("..", "")
    extracted = extract_report_text(raw, filename)

    user_prompt = (
        f"Please analyze my report `{filename}`.\n\n"
        "Explain findings in patient-friendly language and markdown.\n"
        "Include:\n"
        "- key observations\n"
        "- what may be normal vs concerning\n"
        "- practical next steps to become healthier\n"
        "- tests or follow-up checks to discuss with doctor\n"
        "- reminder to consult a doctor for final interpretation\n\n"
        f"Report text:\n{extracted}"
    )
    db.add(ChatMessage(session_id=active_session_id, role="user", content=user_prompt))
    db.commit()

    final_reply, report_trace = await run_agentic_report_analysis(filename, extracted)

    assistant_msg = ChatMessage(session_id=active_session_id, role="assistant", content=final_reply)
    db.add(assistant_msg)
    db.commit()

    msgs = (
        db.query(ChatMessage).filter(ChatMessage.session_id == active_session_id).order_by(ChatMessage.created_at).all()
    )
    combined = "\n".join([f"{m.role}: {m.content}" for m in msgs])
    await create_medical_report(
        db=db,
        patient_id=user.id,
        combined_text=combined,
        session_id=active_session_id,
        title="Auto-generated report analysis summary",
    )
    return ChatReply(session_id=active_session_id, messages=msgs, agent_trace=report_trace)
