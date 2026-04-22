"""Extract plain text from uploaded medical report files."""

import logging
import re
from io import BytesIO

from pypdf import PdfReader

from app.config import settings
from app.services.pdf_ocr import ocr_pdf_bytes

logger = logging.getLogger(__name__)


def normalize_clinical_text(raw: str) -> str:
    """
    Normalize noisy PDF extraction: whitespace, obvious OCR-like breaks,
    preserve structure hints for labs (line-oriented data).
    """
    if not raw:
        return ""
    text = raw.replace("\r\n", "\n").replace("\r", "\n")
    text = text.replace("\xa0", " ").replace("\u200b", "")
    text = re.sub(r"\n{3,}", "\n\n", text)
    lines = [ln.rstrip() for ln in text.split("\n")]
    text = "\n".join(lines)
    text = re.sub(r"[ \t]{2,}", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _alnum_score(s: str) -> int:
    return sum(1 for c in s if c.isalnum())


def _extract_pdf_with_pypdf(reader: PdfReader) -> str:
    parts: list[str] = []
    for page in reader.pages:
        try:
            t = page.extract_text(extraction_mode="layout")
        except TypeError:
            t = page.extract_text()
        if t:
            parts.append(t)
    combined = "\n\n".join(parts).strip()
    if combined:
        return normalize_clinical_text(combined)
    parts_plain: list[str] = []
    for page in reader.pages:
        t = page.extract_text(extraction_mode="plain")
        if t:
            parts_plain.append(t)
    combined_plain = "\n\n".join(parts_plain).strip()
    return normalize_clinical_text(combined_plain) if combined_plain else ""


def _extract_pdf_with_fitz(raw: bytes) -> str:
    """PyMuPDF often yields better text than pypdf on mixed / tricky PDFs."""
    try:
        import fitz
    except ImportError:
        return ""

    try:
        doc = fitz.open(stream=raw, filetype="pdf")
    except Exception as e:
        logger.debug("fitz open failed: %s", e)
        return ""

    parts: list[str] = []
    try:
        for page in doc:
            t = page.get_text(sort=True)
            if t and t.strip():
                parts.append(t.strip())
    finally:
        doc.close()

    combined = "\n\n".join(parts).strip()
    return normalize_clinical_text(combined) if combined else ""


def _merge_native_extractions(pypdf_text: str, fitz_text: str) -> str:
    """Prefer the extraction with more alphanumeric content (real words/values)."""
    a, b = pypdf_text.strip(), fitz_text.strip()
    if not a:
        return b
    if not b:
        return a
    sa, sb = _alnum_score(a), _alnum_score(b)
    if sb > sa * 1.08:
        return b
    if sa > sb * 1.08:
        return a
    return b if len(b) >= len(a) else a


def _native_extraction_is_weak(native_text: str, page_count: int) -> bool:
    """True when native text is empty, tiny, or looks like junk instead of a real report."""
    t = native_text.strip()
    if not t:
        return True
    if page_count <= 0:
        page_count = 1
    letters = sum(1 for c in t if c.isalpha())
    # Image-only PDFs sometimes expose a few metadata strings as "text"
    if letters < max(50, page_count * 15):
        return True
    weird = sum(1 for c in t if ord(c) == 0xFFFD or (ord(c) < 9 and c not in "\n\r\t"))
    if len(t) > 80 and weird / len(t) > 0.025:
        return True
    return False


def _should_try_ocr(native_text: str, page_count: int) -> bool:
    """Heuristic: thin or junk native layer ⇒ render pages and OCR."""
    t = native_text.strip()
    if not t:
        return True
    threshold = max(120, page_count * 40)
    if len(t) < threshold:
        return True
    return _native_extraction_is_weak(t, page_count)


def _prefer_ocr_over_native(native: str, ocr_text: str, page_count: int) -> bool:
    """Whether OCR output should replace native extraction."""
    o = ocr_text.strip()
    n = native.strip()
    if not o:
        return False
    if not n:
        return True
    if _native_extraction_is_weak(n, page_count):
        return len(o) > 40
    if len(o) > len(n) * 1.05:
        return True
    if len(n) < 80:
        return True
    return _alnum_score(o) > _alnum_score(n) * 1.15 and len(o) > len(n) * 0.75


def extract_report_text(raw: bytes, filename: str) -> str:
    low = filename.lower()
    if low.endswith(".pdf"):
        try:
            reader = PdfReader(BytesIO(raw))
            page_count = len(reader.pages)
            native_pypdf = _extract_pdf_with_pypdf(reader)
            native_fitz = _extract_pdf_with_fitz(raw)
            native = _merge_native_extractions(native_pypdf, native_fitz)

            ocr_text: str | None = None
            if _should_try_ocr(native, page_count):
                ocr_text = ocr_pdf_bytes(
                    raw,
                    max_pages=settings.pdf_ocr_max_pages,
                    zoom=settings.pdf_ocr_zoom,
                    lang=settings.pdf_ocr_lang,
                    preprocess=settings.pdf_ocr_preprocess,
                )
                if ocr_text:
                    ocr_text = normalize_clinical_text(ocr_text)

            if ocr_text and native:
                if _prefer_ocr_over_native(native, ocr_text, page_count):
                    logger.info(
                        "Using OCR text over native extraction (%s chars vs %s)",
                        len(ocr_text),
                        len(native),
                    )
                    return ocr_text
                return native

            if ocr_text:
                return ocr_text

            if native:
                return native

            return (
                "[No text could be extracted from this PDF. "
                "If it is scanned, install Tesseract OCR (e.g. `brew install tesseract` on macOS, "
                "or use the provided Docker image) and ensure Pillow + PyMuPDF + pytesseract are installed.]"
            )
        except Exception as e:
            return f"[Could not read PDF: {e}]"

    if low.endswith((".txt", ".csv", ".md", ".json", ".xml", ".html", ".htm")):
        return normalize_clinical_text(raw.decode("utf-8", errors="replace"))

    try:
        text = raw.decode("utf-8", errors="replace")
        printable_ratio = sum(1 for c in text[:8000] if c.isprintable() or c in "\n\r\t") / max(len(text[:8000]), 1)
        if printable_ratio > 0.85 and len(text.strip()) > 20:
            return normalize_clinical_text(text)
    except Exception:
        pass

    return (
        f"[Unsupported or binary file `{filename}` — upload PDF with selectable text or a .txt export for full analysis.]"
    )
