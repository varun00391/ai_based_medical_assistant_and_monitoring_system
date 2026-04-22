"""Lightweight safety screening before specialist agents."""

import logging
import re

logger = logging.getLogger(__name__)

# English phrases — extend per locale as needed
_URGENT_PATTERNS = re.compile(
    r"\b("
    r"chest\s+pain|heart\s+attack|can't\s+breathe|cannot\s+breathe|"
    r"suicid|kill\s+myself|end\s+my\s+life|"
    r"stroke|face\s+drooping|slurred\s+speech|"
    r"severe\s+bleeding|unconscious|passed\s+out|"
    r"anaphylaxis|throat\s+closing"
    r")\b",
    re.I,
)

SAFETY_SYSTEM_PREFIX = (
    "**Safety directive (must follow first):** The user may be describing an emergency. "
    "Open your reply with a short, bold urgent-care instruction: call local emergency services (e.g. 911/112) "
    "or go to the nearest emergency department **before** any other guidance. "
    "Then continue with the specialist role below.\n\n"
)


def urgent_prefix_if_needed(user_text: str) -> str | None:
    """Return extra system prefix if message matches urgent patterns."""
    if not user_text or not _URGENT_PATTERNS.search(user_text):
        return None
    logger.warning("Safety agent: urgent pattern matched in user message")
    return SAFETY_SYSTEM_PREFIX
