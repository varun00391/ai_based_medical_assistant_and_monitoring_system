import base64
from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import Response
from pydantic import BaseModel, Field

from app.dependencies import require_roles
from app.models import User, UserRole
from app.services.deepgram_service import decode_base64_audio, synthesize_speech, transcribe_audio_bytes
from app.agents.orchestrator import run_chat_with_agents
from app.database import SessionLocal
from app.services.report_service import create_medical_report

router = APIRouter(prefix="/voice", tags=["voice"])


class VoiceChatIn(BaseModel):
    audio_base64: str = Field(..., min_length=10)
    mime_type: str = "audio/webm"
    agent_mode: str = "auto"


@router.post("/turn")
async def voice_turn(
    payload: VoiceChatIn,
    user: Annotated[User, Depends(require_roles(UserRole.patient))],
):
    try:
        audio = decode_base64_audio(payload.audio_base64)
    except Exception:
        raise HTTPException(400, detail="Invalid base64 audio")
    transcript = await transcribe_audio_bytes(audio, payload.mime_type)

    reply, agent_trace = await run_chat_with_agents(
        [{"role": "user", "content": transcript}],
        agent_mode=payload.agent_mode,
        voice_concise=True,
    )

    try:
        audio_out = await synthesize_speech(reply)
        tts_b64 = base64.b64encode(audio_out).decode("ascii")
    except Exception:
        tts_b64 = ""

    db = SessionLocal()
    try:
        combined = f"user: {transcript}\nassistant: {reply}"
        await create_medical_report(
            db=db,
            patient_id=user.id,
            combined_text=combined,
            session_id=None,
            title="Auto-generated voice analysis report",
        )
    finally:
        db.close()

    return {
        "transcript": transcript,
        "reply_text": reply,
        "reply_audio_base64": tts_b64,
        "tts_available": bool(tts_b64),
        "agent_trace": agent_trace,
    }


class TTSBody(BaseModel):
    text: str = Field(..., min_length=1)


@router.post("/tts")
async def tts_only(
    body: TTSBody,
    user: Annotated[User, Depends(require_roles(UserRole.patient))],
):
    try:
        audio_out = await synthesize_speech(body.text)
        return Response(content=audio_out, media_type="audio/mpeg")
    except Exception as e:
        raise HTTPException(503, detail=str(e))
