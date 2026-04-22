import re
from io import BytesIO
from pathlib import Path

from reportlab.lib.pagesizes import letter
from reportlab.pdfgen import canvas


def markdown_to_plain_lines(md: str) -> str:
    """Strip common Markdown tokens for simple PDF text."""
    text = md.replace("\r\n", "\n")
    text = re.sub(r"^#+\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\*\*([^*]+)\*\*", r"\1", text)
    text = re.sub(r"__([^_]+)__", r"\1", text)
    text = re.sub(r"`([^`]+)`", r"\1", text)
    text = re.sub(r"^\s*[-*]\s+", "• ", text, flags=re.MULTILINE)
    return text.strip()


def build_medical_pdf(
    title: str,
    body: str,
    suggested_tests: str | None,
    out_path: Path,
) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    buf = BytesIO()
    c = canvas.Canvas(buf, pagesize=letter)
    width, height = letter
    y = height - 50
    c.setTitle(title)
    c.setFont("Helvetica-Bold", 14)
    c.drawString(50, y, title[:80])
    y -= 28
    c.setFont("Helvetica", 10)
    for block in (body + ("\n\nSuggested tests:\n" + suggested_tests if suggested_tests else "")).split("\n"):
        line = block.strip() or " "
        while line:
            chunk = line[:95]
            if y < 50:
                c.showPage()
                c.setFont("Helvetica", 10)
                y = height - 50
            c.drawString(50, y, chunk)
            y -= 14
            line = line[95:]
        y -= 6
    c.save()
    out_path.write_bytes(buf.getvalue())


def build_analysis_pdf_from_markdown(title: str, markdown_body: str, out_path: Path) -> None:
    """Single-column PDF from markdown-ish content."""
    plain = markdown_to_plain_lines(markdown_body)
    build_medical_pdf(title, plain, None, out_path)
