"""Multi-step agentic pipeline for uploaded clinical documents."""

import json
import logging
import re

from app.agents.types import DocumentKind
from app.config import settings
from app.services.groq_service import analyze_report_markdown_complete, chat_completion

logger = logging.getLogger(__name__)

_CLASSIFIER_SYSTEM = """You classify medical document text (may be noisy OCR).
Choose exactly one category:

- lab_panel — blood work, CMP, CBC, lipids, hormones, urine labs, cultures listed as analytes
- imaging_radiology — X-ray, CT, MRI, ultrasound, impression sections
- pathology_histology — biopsy, cytology, tissue diagnosis
- mixed_clinical — multiple types or discharge summary with labs + imaging
- administrative_other — insurance, billing only, blank noise

Reply JSON only: {"kind": "<enum>"}
"""


async def classify_document_kind(text_sample: str) -> DocumentKind:
    sample = text_sample.strip()[:14_000]
    if len(sample) < 80:
        return DocumentKind.mixed_clinical

    raw = await chat_completion(
        [{"role": "system", "content": _CLASSIFIER_SYSTEM}, {"role": "user", "content": sample}],
        temperature=0.1,
    )
    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        obj = json.loads(raw)
        k = obj.get("kind", "mixed_clinical")
        kind = DocumentKind(k)
        logger.info("Report classifier agent: kind=%s", kind.value)
        return kind
    except (json.JSONDecodeError, ValueError):
        logger.warning("Report classifier fallback mixed_clinical; raw=%s", raw[:120])
        return DocumentKind.mixed_clinical


_PEER_SYSTEM = """You are a Quality Review Agent. Given (A) source excerpt and (B) draft analysis, 
list only factual issues: contradictions, invented values, or missing disclaimer. 
If none, say "No issues flagged." Max 8 bullet points. Markdown."""


async def peer_review_if_enabled(draft_markdown: str, source_excerpt: str) -> str | None:
    if not settings.enable_report_peer_review:
        return None
    excerpt = source_excerpt.strip()[:6_000]
    out = await chat_completion(
        [
            {"role": "system", "content": _PEER_SYSTEM},
            {
                "role": "user",
                "content": f"**Source excerpt:**\n{excerpt}\n\n**Draft analysis:**\n{draft_markdown[:12_000]}",
            },
        ],
        temperature=0.15,
    )
    return out.strip()


async def run_agentic_report_analysis(file_label: str, extracted_text: str) -> tuple[str, list[str]]:
    """
    1) Classifier agent → document kind
    2) Primary analyst (existing chunked pipeline) with profile
    3) Optional peer-review agent

    Returns (markdown, trace).
    """
    trace: list[str] = ["report:classifier"]
    kind = await classify_document_kind(extracted_text)
    profile = kind.value.replace("_", " ")
    trace.append(f"report:kind:{kind.value}")

    trace.append("report:primary_analyst")
    primary = await analyze_report_markdown_complete(file_label, extracted_text, document_profile=profile)

    header = (
        f"# Uploaded report analysis\n\n"
        f"*Original file:* `{file_label}`\n\n"
        f"*Classifier agent:* **{profile}**\n\n"
        f"{primary}"
    )

    review = await peer_review_if_enabled(primary, extracted_text)
    if review:
        trace.append("report:peer_review")
        header += "\n\n---\n\n## Multi-agent quality review\n\n" + review

    return header, trace
