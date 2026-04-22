"""Groq Chat Completions API (OpenAI-compatible)."""

import re
from typing import Iterable

import httpx

from app.config import settings


BASE = "https://api.groq.com/openai/v1"

def _chunk_max_chars() -> int:
    return settings.report_chunk_max_chars


def _chunk_overlap() -> int:
    return settings.report_chunk_overlap


def _report_temperature() -> float:
    """Lower temperature for factual extraction from dense reports."""
    t = float(settings.groq_report_temperature)
    return min(0.4, max(0.0, t))


def _resolved_max_tokens(explicit_max: int | None) -> int | None:
    """
    Groq OpenAI-compatible API: omit `max_tokens` to use the model's maximum output length.
    Set GROQ_MAX_TOKENS to a positive integer to cap output (e.g. for cost control).
    Use explicit_max on a call to override settings for that request only.
    """
    if explicit_max is not None:
        return None if explicit_max <= 0 else explicit_max
    mt = settings.groq_max_tokens
    if mt is None or mt <= 0:
        return None
    return mt


async def chat_completion(
    messages: Iterable[dict],
    *,
    max_tokens: int | None = None,
    temperature: float | None = None,
) -> str:
    if not settings.groq_api_key.strip():
        return (
            "[Demo mode] Set GROQ_API_KEY in `.env` for live AI responses. "
            "Configured model: "
            + settings.groq_model
        )

    resolved_mt = _resolved_max_tokens(max_tokens)
    payload: dict = {
        "model": settings.groq_model,
        "messages": list(messages),
        "temperature": temperature if temperature is not None else settings.groq_temperature,
    }
    if resolved_mt is not None:
        payload["max_tokens"] = resolved_mt
    headers = {
        "Authorization": f"Bearer {settings.groq_api_key}",
        "Content-Type": "application/json",
    }
    async with httpx.AsyncClient(timeout=300.0) as client:
        r = await client.post(f"{BASE}/chat/completions", json=payload, headers=headers)
        r.raise_for_status()
        data = r.json()
    return data["choices"][0]["message"]["content"].strip()


def _slide_chunks(text: str, max_chars: int, overlap: int) -> list[str]:
    """Fallback when document has few paragraph breaks (single giant block)."""
    chunks: list[str] = []
    start = 0
    n = len(text)
    while start < n:
        end = min(start + max_chars, n)
        chunks.append(text[start:end])
        if end >= n:
            break
        start = max(0, end - overlap)
    return chunks


def _semantic_chunks(text: str, max_chars: int, overlap: int) -> list[str]:
    """
    Prefer splitting at paragraph boundaries to avoid cutting lab rows mid-line.
    Falls back to sliding window for oversized paragraphs.
    """
    text = text.strip()
    if len(text) <= max_chars:
        return [text]

    paragraphs = [p.strip() for p in re.split(r"\n\s*\n+", text) if p.strip()]
    if len(paragraphs) <= 1:
        return _slide_chunks(text, max_chars, overlap)

    chunks: list[str] = []
    buf: list[str] = []
    buf_len = 0

    for para in paragraphs:
        pl = len(para)
        sep = 2 if buf else 0
        if buf and buf_len + sep + pl > max_chars:
            chunk_text = "\n\n".join(buf)
            chunks.append(chunk_text)
            suf = chunk_text[-overlap:] if len(chunk_text) > overlap else chunk_text
            buf = [suf + "\n\n" + para]
            buf_len = len(buf[0])
        else:
            buf.append(para)
            buf_len += sep + pl

    if buf:
        chunks.append("\n\n".join(buf))

    # Split any chunk that still exceeds max (dense tables)
    refined: list[str] = []
    for ch in chunks:
        if len(ch) <= max_chars:
            refined.append(ch)
        else:
            refined.extend(_slide_chunks(ch, max_chars, overlap))

    return refined if refined else [text[:max_chars]]


def _profile_clause(document_profile: str | None) -> str:
    if not document_profile:
        return ""
    return (
        f"\n\n**Classifier hint:** This document was categorized as **{document_profile}**. "
        "Weight extraction toward that domain when relevant, but still capture other findings present in the text.\n"
    )


async def _analyze_single_report_markdown(
    file_label: str,
    extracted_text: str,
    *,
    document_profile: str | None = None,
) -> str:
    system = _full_report_system_prompt(document_profile)
    user = _full_report_user_message(file_label, extracted_text)
    return await chat_completion(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=_report_temperature(),
    )


def _full_report_system_prompt(document_profile: str | None = None) -> str:
    base = """You are a clinical documentation assistant analyzing extracted text from real laboratory, pathology, or diagnostic reports.

Rules:
- Do NOT give a definitive diagnosis or prescribe treatment. Educational interpretation only.
- PDF text may be fragmented, columns misordered, or labels split across lines — infer carefully; note uncertainty where layout is ambiguous.
- Capture MULTI-PANEL detail: every distinct analyte/test name with value, unit, reference range (if stated), and high/low/flag if shown.
- Include imaging/radiology: modality, region, measurements, impression/conclusion when present.
- Include microbiology/culture results, pathology diagnoses AS STATED in the document (quoted short phrases), dates, specimen types.
- Use GitHub-flavored Markdown with EXACTLY these sections:

## Summary
2–5 sentences on what type of report this is and overall pattern (do not invent findings).

## Key findings
Organize into subsections ONLY when the source clearly groups tests (e.g. **Hematology**, **Chemistry**, **Imaging**). Under each, use bullets. Bold abnormal or critical values.

## Tables / values worth repeating
If the source has many line items, use a compact markdown table ONLY when values align clearly; otherwise bullets.

## Suggested follow-up
General educational points (questions for a clinician, repeat monitoring ideas). Not prescriptions.

## Limitations of this analysis
Note PDF extraction issues if text looks incomplete or garbled.

## Disclaimer
Short statement that this is informational and not a substitute for professional medical advice."""
    if document_profile:
        base += _profile_clause(document_profile)
    return base


def _full_report_user_message(file_label: str, extracted_text: str) -> str:
    return (
        f"**Source file:** {file_label}\n\n"
        f"**Extracted report text (may be long or noisy):**\n\n{extracted_text}"
    )


async def _summarize_chunk_for_merge(
    file_label: str,
    part_index: int,
    total_parts: int,
    chunk_text: str,
    *,
    document_profile: str | None = None,
) -> str:
    profile = _profile_clause(document_profile)
    system = """You extract FACTS from ONE portion of a medical/lab/imaging report (text may be noisy PDF extraction).

Extract exhaustively:
- Each test/analyte or imaging metric: name, numeric value, unit, reference interval, flag (H/L/A/abnormal), date/time if shown.
- Paragraph impressions, conclusions, recommendations verbatim in short quoted snippets if present.
- Ignore boilerplate/legal unless it limits interpretation.

Output format (Markdown):
### Structured facts (part N)
- Bullet list; preserve numbers exactly as written.
### Narrative snippets (part N)
- Bullet quotes or paraphrases of sentences that state diagnosis/conclusion/impression FROM THIS SECTION ONLY.

Do not diagnose beyond the document. If this section is empty or unreadable, say so in one line."""
    system = system + profile

    user = (
        f"File: `{file_label}` — **part {part_index} of {total_parts}** (same patient document).\n\n"
        f"---BEGIN SECTION---\n{chunk_text}\n---END SECTION---"
    )
    return await chat_completion(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=_report_temperature(),
    )


async def _merge_extract_batches(
    file_label: str,
    batch_index: int,
    extracts: list[str],
    *,
    document_profile: str | None = None,
) -> str:
    """Intermediate merge when many chunks — consolidate fact lists without losing abnormalities."""
    combined = "\n\n".join(f"#### Input block {i + 1}\n{e}" for i, e in enumerate(extracts))
    system = """These Markdown blocks are sequential extracts from the SAME clinical document.
Merge into ONE Markdown document that:
- Removes duplicate test lines (same analyte + same value).
- NEVER drops abnormal flags, critical values, or conclusions.
- Keeps conflicting values if they appear (note duplicate reporting).
- Does not add interpretation beyond merging."""
    system = system + _profile_clause(document_profile)

    user = f"**File:** `{file_label}` — consolidation batch {batch_index}\n\n{combined}"
    return await chat_completion(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=_report_temperature(),
    )


async def _merge_chunk_summaries(
    file_label: str,
    chunk_summaries: list[str],
    source_char_len: int,
    *,
    document_profile: str | None = None,
) -> str:
    combined = "\n\n".join(
        f"### Consolidated extract segment {i + 1}\n{s}" for i, s in enumerate(chunk_summaries)
    )
    system = _full_report_system_prompt(document_profile) + (
        "\n\nYou are synthesizing from PARTIAL EXTRACTS below (same document). "
        "Produce ONE unified report following the section structure above. "
        "Integrate all panels; deduplicate identical lines; preserve every abnormal finding from the extracts. "
        f"Approximate source length: {source_char_len} characters."
    )
    user = f"**Source file:** `{file_label}`\n\n**Extracts to synthesize:**\n\n{combined}"
    return await chat_completion(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
        temperature=_report_temperature(),
    )


async def _reduce_summaries_to_merge_limit(
    summaries: list[str],
    file_label: str,
    max_batch: int = 5,
    *,
    document_profile: str | None = None,
) -> list[str]:
    """If too many chunk extracts, hierarchically merge so final step stays within context."""
    level = list(summaries)
    batch_num = 0
    while len(level) > max_batch:
        batch_num += 1
        next_level: list[str] = []
        for i in range(0, len(level), max_batch):
            batch = level[i : i + max_batch]
            merged = await _merge_extract_batches(
                file_label,
                batch_num * 100 + i // max_batch,
                batch,
                document_profile=document_profile,
            )
            next_level.append(merged)
        level = next_level
    return level


async def analyze_report_markdown_complete(
    file_label: str,
    extracted_text: str,
    *,
    document_profile: str | None = None,
) -> str:
    """
    Full document: single LLM pass if short; otherwise per-chunk structured extraction,
    hierarchical merge if needed, then final synthesis.
    """
    text = extracted_text.strip()
    if not text:
        return "## Summary\n\nNo extractable text was found in this file."

    max_c = _chunk_max_chars()
    ov = _chunk_overlap()
    chunks = _semantic_chunks(text, max_c, ov)

    if len(chunks) == 1:
        return await _analyze_single_report_markdown(file_label, chunks[0], document_profile=document_profile)

    summaries: list[str] = []
    for i, ch in enumerate(chunks):
        part = await _summarize_chunk_for_merge(
            file_label,
            i + 1,
            len(chunks),
            ch,
            document_profile=document_profile,
        )
        summaries.append(part)

    summaries = await _reduce_summaries_to_merge_limit(
        summaries,
        file_label,
        max_batch=5,
        document_profile=document_profile,
    )
    merged = await _merge_chunk_summaries(file_label, summaries, len(text), document_profile=document_profile)
    return merged


async def analyze_lab_text(file_label: str, extracted_text: str) -> str:
    """Backward-compatible alias — analyzes full document."""
    return await analyze_report_markdown_complete(file_label, extracted_text)


async def analyze_medical_symptoms(conversation_text: str) -> dict:
    """Returns structured summary + suggested tests from conversation."""
    system = (
        "You are a clinical documentation assistant. You do NOT diagnose. "
        "Produce: (1) a concise bullet summary of reported symptoms and concerns, "
        "(2) a bullet list of suggested laboratory or imaging tests a clinician might consider "
        "(general education only, not prescription). "
        "Respond as JSON with keys: summary (string), suggested_tests (array of strings)."
    )
    user = f"Conversation / notes:\n{conversation_text}\n\nRespond with JSON only."
    raw = await chat_completion(
        [{"role": "system", "content": system}, {"role": "user", "content": user}],
    )
    import json

    raw = raw.strip()
    if raw.startswith("```"):
        raw = re.sub(r"^```(?:json)?\s*", "", raw)
        raw = re.sub(r"\s*```$", "", raw)
    try:
        obj = json.loads(raw)
        return {
            "summary": obj.get("summary", raw),
            "suggested_tests": obj.get("suggested_tests", []),
        }
    except json.JSONDecodeError:
        return {"summary": raw, "suggested_tests": []}
