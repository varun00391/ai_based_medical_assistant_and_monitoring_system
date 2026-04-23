from pathlib import Path
from typing import Optional

from pydantic_settings import BaseSettings, SettingsConfigDict

def _resolve_env_root() -> Path:
    here = Path(__file__).resolve().parent
    for p in [here, *here.parents]:
        if (p / ".env").exists():
            return p
    return Path(__file__).resolve().parents[2]


_REPO_ROOT = _resolve_env_root()


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=str(_REPO_ROOT / ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    jwt_secret: str = "change-me-in-production"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = 60 * 24

    database_url: str = "sqlite:///./data/medassist.db"

    cors_origins: str = "http://localhost:5173,http://127.0.0.1:5173"

    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    groq_temperature: float = 0.4
    # If unset/empty/zero/negative the API omits max_tokens — Groq uses model maximum output (best for huge reports).
    groq_max_tokens: Optional[int] = None
    # Lower = stricter factual extraction for long lab/radiology reports (0.0–1.0)
    groq_report_temperature: float = 0.22
    # Chunking for very long reports — larger = fewer LLM rounds, watch context limits
    report_chunk_max_chars: int = 14_000
    report_chunk_overlap: int = 1_200

    # Second-pass LLM review after primary report extraction (extra cost/latency)
    enable_report_peer_review: bool = False

    # Scanned PDF OCR (requires Tesseract on PATH; Docker image installs tesseract-ocr)
    pdf_ocr_max_pages: int = 60
    pdf_ocr_zoom: float = 2.5
    # e.g. eng+deu for bilingual forms; must match installed tesseract language packs
    pdf_ocr_lang: str = "eng"
    # Contrast + grayscale before Tesseract (helps faint scans)
    pdf_ocr_preprocess: bool = True

    deepgram_api_key: str = ""
    deepgram_model: str = "nova-3"
    deepgram_smart_format: bool = True
    deepgram_tts_model: str = "aura-2-odysseus-en"
    # Deepgram Voice Agent API — think step: "open_ai" (default) or "groq" (uses groq_model + GROQ API via Deepgram)
    deepgram_voice_agent_think: str = "open_ai"
    deepgram_voice_agent_openai_model: str = "gpt-4o-mini"

    uploads_dir: str = "./data/uploads"
    reports_dir: str = "./data/reports"

    admin_email: str = ""
    admin_password: str = ""

    @property
    def cors_origins_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


settings = Settings()
