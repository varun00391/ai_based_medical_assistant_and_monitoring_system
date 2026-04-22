"""Render PDF pages to images and OCR with Tesseract (for scanned PDFs)."""

from __future__ import annotations

import logging
import re
from io import BytesIO

logger = logging.getLogger(__name__)


def _preprocess_ocr_image(img: "Image.Image", enabled: bool) -> "Image.Image":
    if not enabled:
        return img
    from PIL import ImageOps

    gray = img.convert("L")
    return ImageOps.autocontrast(gray, cutoff=1)


def _page_ocr(
    img: "Image.Image",
    *,
    lang: str,
    preprocess: bool,
) -> str:
    import pytesseract
    from PIL import Image

    if not isinstance(img, Image.Image):
        return ""
    if img.mode not in ("RGB", "L"):
        work = img.convert("RGB")
    else:
        work = img
    work = _preprocess_ocr_image(work, preprocess)
    # PSM 6: single uniform text block; PSM 4/11: better for some multi-block or sparse scans
    configs = [
        f"--oem 3 --psm 6 -l {lang}",
        f"--oem 3 --psm 4 -l {lang}",
        f"--oem 3 --psm 11 -l {lang}",
    ]
    best = ""
    for cfg in configs:
        try:
            text = pytesseract.image_to_string(work, config=cfg)
        except Exception as e:
            logger.debug("Tesseract page error %s: %s", cfg, e)
            continue
        t = (text or "").strip()
        if len(t) > len(best):
            best = t
    return best


def ocr_pdf_bytes(
    raw: bytes,
    *,
    max_pages: int,
    zoom: float,
    lang: str = "eng",
    preprocess: bool = True,
) -> str | None:
    """
    Return OCR text or None if dependencies / Tesseract unavailable.
    """
    try:
        import fitz  # PyMuPDF
        import pytesseract
        from PIL import Image
    except ImportError as e:
        logger.warning("OCR deps missing: %s", e)
        return None

    try:
        pytesseract.get_tesseract_version()
    except Exception as e:
        logger.warning("Tesseract not available: %s", e)
        return None

    # Sanitize lang for tesseract -l (e.g. "eng+deu")
    if not lang or not re.fullmatch(r"[A-Za-z0-9_+]+", lang.strip()):
        lang = "eng"

    try:
        doc = fitz.open(stream=raw, filetype="pdf")
    except Exception as e:
        logger.warning("Could not open PDF for OCR: %s", e)
        return None

    parts: list[str] = []
    mat = fitz.Matrix(zoom, zoom)
    try:
        n = min(len(doc), max(1, max_pages))
        for i in range(n):
            page = doc[i]
            pix = page.get_pixmap(matrix=mat, alpha=False)
            # PNG round-trip handles RGB, CMYK, and odd page color spaces reliably
            img = Image.open(BytesIO(pix.tobytes("png"))).convert("RGB")
            text = _page_ocr(img, lang=lang, preprocess=preprocess)
            if text:
                parts.append(text.strip())
            else:
                logger.debug("OCR page %s produced empty text after PSM fallbacks", i + 1)
    finally:
        doc.close()

    if not parts:
        return None
    return "\n\n".join(parts)
