import json
import time
from pathlib import Path

from sqlalchemy.orm import Session

from app.config import settings
from app.models import MedicalReport
from app.agents.report_pipeline import run_agentic_report_analysis
from app.services.groq_service import analyze_medical_symptoms
from app.services.pdf_service import build_medical_pdf


async def create_medical_report(
    db: Session,
    patient_id: int,
    combined_text: str,
    session_id: int | None = None,
    title: str = "Medical intake summary",
) -> MedicalReport:
    analyzed = await analyze_medical_symptoms(combined_text)
    summary = analyzed.get("summary", "")
    medicines = analyzed.get("medicines", [])
    tests = analyzed.get("suggested_tests", [])
    suggestions = analyzed.get("suggestions", [])
    tests_str = json.dumps(tests) if isinstance(tests, list) else str(tests)

    meds_block = "\n".join(f"- {m}" for m in medicines) if isinstance(medicines, list) and medicines else "- None noted"
    tests_block = "\n".join(f"- {t}" for t in tests) if isinstance(tests, list) and tests else "- None noted"
    suggestions_block = (
        "\n".join(f"- {s}" for s in suggestions) if isinstance(suggestions, list) and suggestions else "- None noted"
    )
    summary_text = (
        "## Symptoms summary\n"
        f"{summary.strip() or '- No summary generated'}\n\n"
        "## Medicines to discuss with clinician\n"
        f"{meds_block}\n\n"
        "## Suggested tests\n"
        f"{tests_block}\n\n"
        "## Suggestions\n"
        f"{suggestions_block}"
    )

    Path(settings.reports_dir).mkdir(parents=True, exist_ok=True)
    pdf_name = f"report_{patient_id}_{int(time.time() * 1000)}.pdf"
    pdf_full = Path(settings.reports_dir) / pdf_name
    build_medical_pdf(title, summary_text, tests_block, pdf_full)

    report = MedicalReport(
        patient_id=patient_id,
        chat_session_id=session_id,
        title=title,
        summary_text=summary_text,
        suggested_tests=tests_str,
        pdf_path=str(pdf_full),
    )
    db.add(report)
    db.commit()
    db.refresh(report)
    return report


async def analyze_uploaded_report_text(file_name: str, extracted_text: str) -> str:
    """Full markdown document for UI (includes classifier + optional peer-review steps)."""
    body, _trace = await run_agentic_report_analysis(file_name, extracted_text)
    return body
