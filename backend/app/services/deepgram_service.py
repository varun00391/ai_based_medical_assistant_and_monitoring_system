"""Deepgram STT (pre-recorded) and TTS (Aura)."""

import base64

import httpx

from app.config import settings


async def transcribe_audio_bytes(data: bytes, mime_type: str = "audio/webm") -> str:
    if not settings.deepgram_api_key.strip():
        return "[Demo] Set DEEPGRAM_API_KEY for speech-to-text."

    params = {
        "model": settings.deepgram_model,
        "smart_format": str(settings.deepgram_smart_format).lower(),
    }
    headers = {
        "Authorization": f"Token {settings.deepgram_api_key}",
        "Content-Type": mime_type,
    }
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(
            "https://api.deepgram.com/v1/listen",
            params=params,
            headers=headers,
            content=data,
        )
        r.raise_for_status()
        out = r.json()
    try:
        return out["results"]["channels"][0]["alternatives"][0]["transcript"].strip()
    except (KeyError, IndexError):
        return str(out)


async def synthesize_speech(text: str) -> bytes:
    if not settings.deepgram_api_key.strip():
        raise ValueError("DEEPGRAM_API_KEY not set")

    model = settings.deepgram_tts_model or "aura-2-odysseus-en"
    url = f"https://api.deepgram.com/v1/speak?model={model}"
    headers = {
        "Authorization": f"Token {settings.deepgram_api_key}",
        "Content-Type": "application/json",
    }
    payload = {"text": text}
    async with httpx.AsyncClient(timeout=120.0) as client:
        r = await client.post(url, json=payload, headers=headers)
        r.raise_for_status()
        return r.content


def decode_base64_audio(b64: str) -> bytes:
    return base64.b64decode(b64)
