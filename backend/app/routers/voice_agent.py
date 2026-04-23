"""
WebSocket proxy to Deepgram Voice Agent API (v1).

Browser sends linear16 mono PCM at 24 kHz; server forwards to Deepgram and relays
JSON events + binary audio back. API key stays server-side.
"""

import asyncio
import json
import logging
from typing import Any

from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from sqlalchemy.orm import Session

from app.config import settings
from app.database import SessionLocal
from app.models import User, UserRole
from app.security import decode_token

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/voice-agent", tags=["voice-agent"])

VOICE_AGENT_SYSTEM_PROMPT = """
You are a pre-visit health assistant (not a doctor). Speak in a calm, clear voice.

Your goals in order:
1) Briefly understand the user's main symptom or health concern. Ask 1 to 2 short
   follow-up questions only if needed (duration, severity, red flags).
2) Suggest safe self-care steps, rest, hydration, and what to write down for their visit.
3) Suggest **types** of tests or office checks a clinician *might* consider, as general
   education (for example, basic blood work or an ECG if chest pain) — do not "order" tests.
4) State clearly: for diagnosis and treatment they must see a qualified clinician. Mention
   emergency care if red-flag symptoms appear (chest pain, trouble breathing, stroke signs,
   severe bleeding, high fever with confusion, etc.).

Do not provide a formal diagnosis. Keep each spoken reply under about 150 words.
""".strip()


def _build_agent_settings() -> dict[str, Any]:
    think_provider: dict[str, Any]
    if settings.deepgram_voice_agent_think.strip().lower() == "groq":
        think_provider = {
            "type": "groq",
            "version": "v1",
            "model": settings.groq_model,
            "temperature": float(settings.groq_temperature),
        }
    else:
        think_provider = {
            "type": "open_ai",
            "version": "v1",
            "model": settings.deepgram_voice_agent_openai_model,
            "temperature": 0.3,
        }

    tts = settings.deepgram_tts_model or "aura-2-odysseus-en"
    if not tts.startswith("aura-"):
        tts = "aura-2-odysseus-en"

    return {
        "type": "Settings",
        "audio": {
            "input": {"encoding": "linear16", "sample_rate": 24000},
            "output": {
                "encoding": "linear16",
                "sample_rate": 24000,
                "container": "wav",
            },
        },
        "agent": {
            "language": "en",
            "listen": {
                "provider": {
                    "type": "deepgram",
                    "model": settings.deepgram_model or "nova-3",
                }
            },
            "think": {
                "provider": think_provider,
                "prompt": VOICE_AGENT_SYSTEM_PROMPT,
            },
            "speak": {
                "provider": {
                    "type": "deepgram",
                    "model": tts,
                }
            },
            "greeting": (
                "Hi — I’ll listen to what’s going on, then suggest a few things you can do before "
                "you see a doctor, and some tests a clinician might consider. What should we start with?"
            ),
        },
    }


def _serialize_dg_message(msg: Any, fallback_type: str | None = None) -> dict[str, Any]:
    payload: dict[str, Any]
    if isinstance(msg, dict):
        payload = msg
    elif hasattr(msg, "model_dump"):
        payload = msg.model_dump(mode="json")
    elif hasattr(msg, "to_dict"):
        payload = msg.to_dict()
    elif hasattr(msg, "to_json"):
        try:
            payload = json.loads(msg.to_json())
        except Exception:  # noqa: BLE001
            payload = {"_raw": str(msg)}
    elif hasattr(msg, "__dict__"):
        payload = {k: v for k, v in vars(msg).items() if not k.startswith("_")}
    else:
        payload = {"_raw": str(msg)}

    t = payload.get("type")
    if hasattr(t, "value"):
        payload["type"] = t.value
    elif t is not None and not isinstance(t, str):
        payload["type"] = str(t)
    elif t is None and fallback_type:
        payload["type"] = fallback_type
    return payload


@router.websocket("/ws")
async def voice_agent_websocket(websocket: WebSocket, token: str | None = None) -> None:
    logger.info("voice-agent websocket connect attempt")
    await websocket.accept()
    if not token:
        logger.warning("voice-agent websocket rejected: missing token")
        await websocket.close(code=4401)
        return
    payload = decode_token(token)
    if not payload or "sub" not in payload:
        logger.warning("voice-agent websocket rejected: invalid token payload")
        await websocket.close(code=4401)
        return
    db: Session = SessionLocal()
    try:
        user = db.get(User, int(payload["sub"]))
        if not user or not user.is_active or user.role != UserRole.patient:
            logger.warning("voice-agent websocket rejected: unauthorized role/user")
            await websocket.close(code=4403)
            return
    finally:
        db.close()

    if not settings.deepgram_api_key.strip():
        logger.error("voice-agent websocket failed: DEEPGRAM_API_KEY missing")
        await websocket.send_json(
            {"type": "Error", "code": "missing_key", "description": "DEEPGRAM_API_KEY is not configured."}
        )
        await websocket.close(code=1011)
        return

    try:
        # deepgram-sdk v4+ exports DeepgramClient instead of AsyncDeepgramClient.
        from deepgram import AsyncDeepgramClient as DeepgramRealtimeClient
    except ImportError:
        from deepgram import DeepgramClient as DeepgramRealtimeClient
    from deepgram import AgentWebSocketEvents
    from deepgram.clients.agent.v1.websocket.options import SettingsOptions

    client = DeepgramRealtimeClient(api_key=settings.deepgram_api_key)
    settings_dict = _build_agent_settings()
    agent_settings = SettingsOptions(**settings_dict)

    try:
        logger.info("voice-agent connecting to Deepgram gateway")
        dg = client.agent.asyncwebsocket.v("1")  # type: ignore[union-attr]
        close_event = asyncio.Event()

        async def on_audio_data(_dg: Any, data: bytes | bytearray | memoryview | None = None, **_kwargs: Any) -> None:
            if data and not close_event.is_set():
                await websocket.send_bytes(bytes(data))

        async def on_conversation_text(
            _dg: Any, conversation_text: Any | None = None, **_kwargs: Any
        ) -> None:
            if close_event.is_set() or conversation_text is None:
                return
            payload = _serialize_dg_message(conversation_text, fallback_type="ConversationText")
            await websocket.send_json(payload)

        async def on_agent_started_speaking(
            _dg: Any, agent_started_speaking: Any | None = None, **_kwargs: Any
        ) -> None:
            if close_event.is_set() or agent_started_speaking is None:
                return
            payload = _serialize_dg_message(agent_started_speaking, fallback_type="AgentStartedSpeaking")
            await websocket.send_json(payload)

        async def on_agent_audio_done(
            _dg: Any, agent_audio_done: Any | None = None, **_kwargs: Any
        ) -> None:
            if close_event.is_set() or agent_audio_done is None:
                return
            payload = _serialize_dg_message(agent_audio_done, fallback_type="AgentAudioDone")
            await websocket.send_json(payload)

        async def on_error(_dg: Any, error: Any | None = None, **_kwargs: Any) -> None:
            if close_event.is_set():
                return
            logger.error("Deepgram agent error event: %s", error)
            await websocket.send_json(
                {
                    "type": "Error",
                    "code": "agent_error",
                    "description": str(error)[:500],
                }
            )

        dg.on(AgentWebSocketEvents.AudioData, on_audio_data)
        dg.on(AgentWebSocketEvents.ConversationText, on_conversation_text)
        dg.on(AgentWebSocketEvents.AgentStartedSpeaking, on_agent_started_speaking)
        dg.on(AgentWebSocketEvents.AgentAudioDone, on_agent_audio_done)
        dg.on(AgentWebSocketEvents.Error, on_error)

        started = await dg.start(
            options=agent_settings,
            headers={"Authorization": f"Token {settings.deepgram_api_key}"},
        )
        if not started:
            raise RuntimeError("Deepgram agent websocket failed to start")

        logger.info("voice-agent Deepgram session initialized")

        try:
            while not close_event.is_set():
                message = await websocket.receive()
                if message["type"] == "websocket.disconnect":
                    break
                b = message.get("bytes")
                if b is not None:
                    await dg.send(b)
        except WebSocketDisconnect:
            pass
        finally:
            close_event.set()
            await dg.finish()

        logger.info("voice-agent websocket session ended")
    except Exception as e:  # noqa: BLE001
        logger.exception("Deepgram voice agent: %s", e)
        try:
            await websocket.send_json(
                {
                    "type": "Error",
                    "code": "agent_connect_failed",
                    "description": str(e)[:500],
                }
            )
        finally:
            await websocket.close(code=1011)
