"""Compose specialist system prompt + messages for one chat turn."""

import logging

from app.agents.prompts import AGENT_SYSTEM_PROMPTS, BASE_GUARDRAILS
from app.agents.router_agent import route_chat_turn
from app.agents.safety_agent import urgent_prefix_if_needed
from app.agents.types import ChatAgentRoute
from app.services.groq_service import chat_completion

logger = logging.getLogger(__name__)


def _snippet_from_messages(messages: list[dict], max_chars: int = 2500) -> str:
    lines: list[str] = []
    for m in messages[-12:]:
        role = m.get("role", "?")
        content = (m.get("content") or "")[:800]
        lines.append(f"{role}: {content}")
    text = "\n".join(lines)
    return text[:max_chars]


VOICE_REPLY_HINT = (
    "\n\n**Voice mode:** Keep the reply concise (about 120 words or fewer) so it reads well when synthesized to speech."
)


async def run_chat_with_agents(
    messages: list[dict],
    *,
    agent_mode: str = "auto",
    voice_concise: bool = False,
) -> tuple[str, list[str]]:
    """
    Returns (assistant_reply, trace) where trace lists agents/steps for observability.
    """
    trace: list[str] = []
    last_user = ""
    for m in reversed(messages):
        if m.get("role") == "user":
            last_user = m.get("content") or ""
            break

    safety_prefix = urgent_prefix_if_needed(last_user)
    if safety_prefix:
        trace.append("safety:urgent_pattern")

    if agent_mode and agent_mode != "auto":
        try:
            route = ChatAgentRoute(agent_mode)
            trace.append(f"router:manual:{route.value}")
        except ValueError:
            route = ChatAgentRoute.intake
            trace.append("router:manual_invalid_default_intake")
    else:
        snippet = _snippet_from_messages(messages)
        route = await route_chat_turn(last_user, snippet)
        trace.append(f"router:auto:{route.value}")

    specialist = AGENT_SYSTEM_PROMPTS[route] + BASE_GUARDRAILS
    if voice_concise:
        specialist += VOICE_REPLY_HINT
    if safety_prefix:
        specialist = safety_prefix + specialist

    trace.append(f"specialist:{route.value}")

    reply = await chat_completion(
        [{"role": "system", "content": specialist}, *messages],
    )
    return reply, trace
