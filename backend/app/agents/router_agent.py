"""Routes each chat turn to the best specialist agent."""

import json
import logging
import re

from app.agents.types import ChatAgentRoute
from app.services.groq_service import chat_completion

logger = logging.getLogger(__name__)


_ROUTER_SYSTEM = """You are a routing component in a medical wellness application.
Given the user's LATEST message and a short conversation snippet, choose exactly ONE specialist:

- intake — symptoms, pain, how they feel, duration, need for triage-style questions
- wellness — diet, exercise, sleep, stress, prevention, habits, general health improvement
- scheduling — booking doctors, appointments, slots, fees, which specialist to pick
- clinical_documentation — understanding doctor terms, preparing for visits, generic medical concepts (not live triage)

Reply with JSON only: {"route": "<one of the four strings above>"}
"""


async def route_chat_turn(last_user_message: str, recent_snippet: str) -> ChatAgentRoute:
    """LLM-based router; defaults to intake on parse failure."""
    user = (
        f"Recent conversation (oldest to newest):\n{recent_snippet}\n\n"
        f"Latest user message:\n{last_user_message}"
    )
    raw = await chat_completion(
        [{"role": "system", "content": _ROUTER_SYSTEM}, {"role": "user", "content": user}],
    )
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        obj = json.loads(raw)
        r = obj.get("route", "intake")
        route = ChatAgentRoute(r)
        logger.info("Router agent selected route=%s", route.value)
        return route
    except (json.JSONDecodeError, ValueError):
        logger.warning("Router agent parse failed, defaulting to intake; raw=%s", raw[:200])
        return ChatAgentRoute.intake
