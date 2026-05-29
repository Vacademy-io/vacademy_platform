"""grade_copy() — the end-to-end copy-check flow that ai_service runs as a
FastAPI BackgroundTask. Reads from CopyCheckGradeRequest, drives render_worker
OCR, resolves rubrics per question, grades each, applies Mathpix fallback on
low-confidence math lines, and POSTs per-question + final callbacks to Java.

Cancellation is checked at three checkpoints — before OCR, before grading,
and between questions — matching the Java cancellation model.
"""
from __future__ import annotations

import logging
import os
import uuid
from typing import Any, Optional

from sqlalchemy.orm import Session

from ..api_key_resolver import ApiKeyResolver
from ..chat_llm_client import ChatLLMClient
from . import callbacks, cancellation
from .grader import CopyCheckGrader, call_llm_for_criteria
from .mathpix_fallback import MathpixFallback
from .render_client import CopyCheckRenderClient, OcrCancelled
from .rubric import RubricResolver, load_snapshot
from .validator import validate_and_cap

logger = logging.getLogger(__name__)


def _new_job_id() -> str:
    return str(uuid.uuid4())


def _render_client() -> CopyCheckRenderClient:
    base = os.getenv("RENDER_WORKER_URL", "")
    key = os.getenv("RENDER_KEY", "")
    return CopyCheckRenderClient(base, key)


async def grade_copy(process_id: Optional[str] = None) -> str:
    """Allocate a job_id and arm the in-memory cancellation slot for it
    (indexed by both job_id and process_id so a cancel-by-process arriving
    before the BG task runs still aborts the job). The actual pipeline runs
    via `run(payload, job_id, db)` in a background task — the router
    schedules it after this returns.
    """
    job_id = _new_job_id()
    cancellation.register(job_id, process_id=process_id)
    return job_id


async def run(req: dict[str, Any], job_id: str, db: Session) -> None:
    """The actual pipeline. Designed to never raise out of the BG task — any
    failure ends in a callbacks.failed() POST so Java can surface it."""
    process_id = req["process_id"]
    callback_base = req["callback_base_url"]
    pdf_url = req["pdf_url"]
    assessment_id = req["assessment_id"]
    institute_id = req.get("institute_id")
    preferred_model = req.get("preferred_model")
    questions: list[dict[str, Any]] = req["questions"]

    llm = ChatLLMClient(ApiKeyResolver(db))
    grader = CopyCheckGrader(llm, institute_id=institute_id)
    mathpix = MathpixFallback()

    async def _llm_for_criteria(system: str, user: str, model: str | None) -> dict[str, Any]:
        # token_sink=grader makes criteria-generation usage count against the
        # same per-copy budget as grading calls (#12).
        return await call_llm_for_criteria(
            llm, system, user, model, institute_id, token_sink=grader,
        )

    # Pre-load all rubric state into memory and close the DB session before
    # the long-running OCR/LLM calls so the pool isn't pinned for minutes (#17).
    rubric_snapshot = load_snapshot(db, assessment_id)
    rubric_version = rubric_snapshot.rubric_version
    rubric_resolver = RubricResolver(rubric_snapshot, _llm_for_criteria)
    db.close()

    try:
        # 1. OCR via render_worker.
        cancellation.check(job_id, process_id)
        render = _render_client()
        if not render.is_configured:
            raise RuntimeError("RENDER_WORKER_URL not configured on ai_service")
        await callbacks.progress(callback_base, process_id, job_id, step="LAYOUT_OCR_STARTED")
        layout_map = await render.submit_and_wait(
            pdf_url, dpi=200, poll_interval=3.0, timeout=300.0,
            cancellation_check=lambda: cancellation.is_cancelled(job_id, process_id),
        )
        await callbacks.progress(
            callback_base, process_id, job_id, step="LAYOUT_OCR_DONE", layout_map=layout_map,
        )

        # 2. Selective math fallback (cheap if there are no flagged lines).
        cancellation.check(job_id, process_id)
        layout_map = await mathpix.enrich_layout_for_math(pdf_url, layout_map)

        # 3. Per-question grading.
        total_awarded = 0.0
        total_max = 0.0
        evaluated = 0
        for q in questions:
            cancellation.check(job_id, process_id)
            try:
                rubric = await rubric_resolver.resolve(q, preferred_model)
                raw = await grader.grade_question(q, rubric, layout_map, preferred_model)
                verdict = validate_and_cap(raw, q, layout_map)
            except cancellation.Cancelled:
                raise
            except Exception as e:
                logger.exception(f"Grading failed for question {q.get('question_id')}")
                verdict = {
                    "question_id": q["question_id"],
                    "marks_awarded": 0.0,
                    "max_marks": float(q.get("max_marks") or 0),
                    "extracted_answer": "",
                    "feedback": f"Grading failed: {e}",
                    "confidence": 0.0,
                    "criteria_breakdown": [],
                    "annotations": [],
                    "status": "FAILED",
                }
            total_awarded += verdict["marks_awarded"]
            total_max += verdict["max_marks"]
            evaluated += 1
            await callbacks.question_done(
                callback_base, process_id, job_id, verdict, rubric_version=rubric_version,
            )

        # 4. Done.
        await callbacks.complete(
            callback_base, process_id, job_id,
            total_marks_awarded=round(total_awarded, 2),
            total_max_marks=round(total_max, 2),
            questions_evaluated=evaluated,
        )
        logger.info(
            "copy-check job %s complete: %s/%s, %d Mathpix crops used, %d tokens",
            job_id, total_awarded, total_max, mathpix.used, grader.tokens_used,
        )
    except (cancellation.Cancelled, OcrCancelled):
        logger.info(f"copy-check job {job_id} cancelled")
        await callbacks.failed(callback_base, process_id, job_id, "Cancelled by user")
    except Exception as e:
        logger.exception(f"copy-check job {job_id} failed")
        await callbacks.failed(callback_base, process_id, job_id, str(e))
    finally:
        cancellation.cleanup(job_id, process_id=process_id)
