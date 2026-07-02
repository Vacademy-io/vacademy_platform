"""CRM Call Intelligence pipeline (ai_service side).

A PENDING row in `call_intelligence` (enqueued by admin_core the moment a call
recording lands in our storage) is processed here:

    claim → transcribe (render worker, Hindi+English) → fetch transcript text
          → credit check → LLM structured analysis → deduct credits + write results

ai_service shares admin_core's DB, so we read/write `call_intelligence` and read
`telephony_call_log` / `institutes` directly (same pattern as chat_sessions and
the credit tables). No HTTP callback into admin_core is needed.

Credit policy: a FLAT charge per analyzed call (request_type='call_intelligence',
default 5 via credit_pricing; per-institute override via the setting). Charged
only on successful completion, idempotent on call_log_id so a retry never
double-charges. Insufficient balance → SKIPPED/INSUFFICIENT_CREDITS, no transcribe.
"""
from __future__ import annotations

import asyncio
import json
import logging
from decimal import Decimal
from typing import Any, Dict, List, Optional

import httpx
from sqlalchemy import text

from ..config import get_settings
from ..db import db_session
from ..schemas.credits import CreditCheckRequest, CreditDeductRequest
from . import llm_json
from .call_intelligence_prompt import PROMPT_VERSION, SCHEMA_VERSION, build_prompt
from .credit_service import CreditService
from .media_file_client import get_public_file_url
from .transcription_service import TranscriptionService

logger = logging.getLogger(__name__)

REQUEST_TYPE = "call_intelligence"
MODEL_ATTR = "system"  # credit attribution for the (non-LLM) transcription leg
TRANSCRIBE_MODEL_SIZE = "small"  # best for Hindi-English code-switching
TRANSCRIBE_POLL_INTERVAL_S = 10
TRANSCRIBE_MAX_WAIT_S = 25 * 60  # cap one transcription so a stuck job can't pin a worker


# ---------------------------------------------------------------------------
# Settings (read the institute's CRM_INTELLIGENCE_SETTING from institutes.setting_json)
# ---------------------------------------------------------------------------

def _read_call_settings(institute_id: str) -> Dict[str, Any]:
    """Return {rating_scale, objective_hint, qualities, weights, credit_override}.

    Eligibility (enabled/source/min-duration) was already enforced by admin_core at
    enqueue time; here we only need the rubric + the optional credit override. Any
    parse problem falls back to sane defaults so a row is never stuck on config.
    """
    out: Dict[str, Any] = {
        "rating_scale": 10,
        "objective_hint": None,
        "qualities": None,
        "weights": None,
        "credit_override": None,
    }
    try:
        with db_session() as db:
            row = db.execute(
                text("SELECT setting_json FROM institutes WHERE id = :id"),
                {"id": institute_id},
            ).first()
        if not row or not row[0]:
            return out
        root = json.loads(row[0])
        # Envelope: { "setting": { "CRM_INTELLIGENCE_SETTING": { "data": {...} } } }
        data = (((root or {}).get("setting") or {}).get("CRM_INTELLIGENCE_SETTING") or {}).get("data") or {}
        calls = data.get("calls") or {}
        if isinstance(calls.get("ratingScale"), (int, float)) and calls["ratingScale"] > 0:
            out["rating_scale"] = int(calls["ratingScale"])
        if calls.get("creditCostOverride") is not None:
            out["credit_override"] = Decimal(str(calls["creditCostOverride"]))
        rubric = calls.get("rubric") or {}
        if rubric.get("objectiveHint"):
            out["objective_hint"] = str(rubric["objectiveHint"])
        if isinstance(rubric.get("qualities"), list) and rubric["qualities"]:
            # Each metric may be a bare string (legacy) or {"key","description"}
            # (current — an institute-authored definition of a custom metric).
            # Normalize to {key, description} and pass through to the prompt so the
            # AI grades custom metrics exactly as defined.
            parsed = []
            for q in rubric["qualities"]:
                if isinstance(q, dict):
                    key = str(q.get("key") or q.get("term") or "").strip()
                    desc = str(q.get("description") or "").strip()
                    if key:
                        parsed.append({"key": key, "description": desc})
                elif str(q).strip():
                    parsed.append({"key": str(q).strip(), "description": ""})
            if parsed:
                out["qualities"] = parsed
        if isinstance(rubric.get("weights"), dict):
            out["weights"] = {str(k): float(v) for k, v in rubric["weights"].items()}
    except Exception:
        logger.warning("call-intel: could not read CRM_INTELLIGENCE_SETTING for institute %s — using defaults",
                       institute_id, exc_info=True)
    return out


# ---------------------------------------------------------------------------
# Credit helpers (sync — run via asyncio.to_thread)
# ---------------------------------------------------------------------------

def _check_credits(institute_id: str, override: Optional[Decimal]) -> Dict[str, Any]:
    """Return {sufficient, cost, balance}. cost = override or the global price."""
    with db_session() as db:
        resp = CreditService(db).check_credits(CreditCheckRequest(
            institute_id=institute_id, request_type=REQUEST_TYPE, model=MODEL_ATTR,
        ))
    cost = override if override is not None else resp.estimated_cost
    balance = resp.current_balance
    sufficient = balance >= cost
    return {"sufficient": sufficient, "cost": cost, "balance": balance}


def _deduct_and_write(row_id: str, call_log_id: str, institute_id: str,
                      counsellor_user_id: Optional[str], cost: Decimal,
                      columns: Dict[str, Any], analysis_json: Dict[str, Any]) -> None:
    """Deduct the flat charge and write the COMPLETED row in ONE transaction.

    Idempotent on call_log_id: a retry after a partial failure re-uses the same
    idempotency_key, so the deduction is a no-op the second time.
    """
    with db_session() as db:
        ded = CreditService(db).deduct_credits(CreditDeductRequest(
            institute_id=institute_id,
            request_type=REQUEST_TYPE,
            model=MODEL_ATTR,
            precomputed_credits=cost,
            idempotency_key=f"{REQUEST_TYPE}:{call_log_id}",
            description="Call recording transcription + analysis",
            user_id=counsellor_user_id,
            user_role="SYSTEM",
            allow_negative=True,  # work already delivered; pre-flight check gated affordability
        ))
        params = dict(columns)
        params.update({
            "id": row_id,
            "credits_charged": (ded.credits_deducted if ded and ded.success else cost),
            "usage_log_id": (ded.transaction_id if ded else None),
            "analysis_json": json.dumps(analysis_json, ensure_ascii=False),
        })
        db.execute(text("""
            UPDATE call_intelligence SET
                status = 'COMPLETED',
                source_text_key = :source_text_key,
                english_text_key = :english_text_key,
                detected_language = :detected_language,
                language_probability = :language_probability,
                inferred_goal = :inferred_goal,
                call_type = :call_type,
                general_summary = :general_summary,
                generic_status = :generic_status,
                caller_self_goal_rating = :caller_self_goal_rating,
                call_output_rating = :call_output_rating,
                conversion_likelihood = :conversion_likelihood,
                lead_sentiment = :lead_sentiment,
                analysis_json = CAST(:analysis_json AS jsonb),
                schema_version = :schema_version,
                credits_charged = :credits_charged,
                usage_log_id = :usage_log_id,
                model = :model,
                prompt_version = :prompt_version,
                completed_at = now(),
                updated_at = now()
            WHERE id = :id
        """), params)


def _mark(row_id: str, status: str, *, skip_reason: Optional[str] = None,
          error: Optional[str] = None) -> None:
    with db_session() as db:
        db.execute(text("""
            UPDATE call_intelligence
            SET status = :status, skip_reason = :skip_reason, error = :error, updated_at = now()
            WHERE id = :id
        """), {"id": row_id, "status": status, "skip_reason": skip_reason,
               "error": (error[:4000] if error else None)})


# ---------------------------------------------------------------------------
# Transcription + transcript fetch
# ---------------------------------------------------------------------------

def _transcription_service() -> TranscriptionService:
    s = get_settings()
    return TranscriptionService(render_server_url=s.render_server_url, render_key=s.render_server_key)


async def _transcribe(source_url: str, row_id: str) -> Dict[str, Any]:
    """Submit a 'both' (source + English) transcription and poll to completion.

    Returns {source_txt_url, english_txt_url, detected_language, language_probability}.
    Raises RuntimeError on failure / timeout.
    """
    svc = _transcription_service()
    if not svc.is_configured:
        raise RuntimeError("render server not configured (RENDER_SERVER_URL)")

    job_id = await asyncio.to_thread(
        svc.submit, source_url, None, TRANSCRIBE_MODEL_SIZE, False, ["txt", "json"], None, "both",
    )
    # Record the job id for traceability while we poll.
    with db_session() as db:
        db.execute(text("UPDATE call_intelligence SET job_id = :j, updated_at = now() WHERE id = :id"),
                   {"j": job_id, "id": row_id})

    loop = asyncio.get_event_loop()
    deadline = loop.time() + TRANSCRIBE_MAX_WAIT_S
    while True:
        status = await asyncio.to_thread(svc.check_status, job_id)
        st = (status.get("status") or "").lower()
        if st == "completed":
            src = status.get("output_urls_source") or status.get("output_urls") or {}
            eng = status.get("output_urls_english") or {}
            return {
                "source_txt_url": src.get("txt_url") or src.get("txt"),
                "english_txt_url": eng.get("txt_url") or eng.get("txt"),
                "detected_language": status.get("detected_language"),
                "language_probability": status.get("language_probability"),
            }
        if st in ("failed", "error"):
            raise RuntimeError(f"transcription failed: {status.get('error')}")
        if loop.time() > deadline:
            raise RuntimeError(f"transcription timed out after {TRANSCRIBE_MAX_WAIT_S}s (job {job_id})")
        await asyncio.sleep(TRANSCRIBE_POLL_INTERVAL_S)


async def _fetch_text(url: Optional[str]) -> str:
    if not url:
        return ""
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(url)
        resp.raise_for_status()
        return resp.text or ""


# ---------------------------------------------------------------------------
# LLM analysis + mapping
# ---------------------------------------------------------------------------

def _num(v: Any) -> Optional[float]:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _columns_from_analysis(data: Dict[str, Any], model_used: str,
                           detected_language: Optional[str], language_probability: Optional[float],
                           source_txt_url: Optional[str], english_txt_url: Optional[str]) -> Dict[str, Any]:
    goal = data.get("inferred_goal") or {}
    csg = data.get("caller_self_goal_rating") or {}
    out_r = data.get("call_output_rating") or {}
    sentiment = data.get("sentiment") or {}
    return {
        "source_text_key": source_txt_url,
        "english_text_key": english_txt_url,
        "detected_language": detected_language,
        "language_probability": language_probability,
        "inferred_goal": goal.get("objective"),
        "call_type": goal.get("call_type"),
        "general_summary": data.get("general_summary"),
        "generic_status": data.get("generic_status"),
        "caller_self_goal_rating": _num(csg.get("score")),
        "call_output_rating": _num(out_r.get("score")),
        "conversion_likelihood": out_r.get("conversion_likelihood"),
        "lead_sentiment": sentiment.get("lead"),
        "schema_version": data.get("schema_version") or SCHEMA_VERSION,
        "model": model_used,
        "prompt_version": PROMPT_VERSION,
    }


# ---------------------------------------------------------------------------
# Orchestration: process a single claimed row end-to-end (never raises)
# ---------------------------------------------------------------------------

async def process_one(claimed: Dict[str, Any]) -> None:
    row_id = claimed["id"]
    call_log_id = claimed["call_log_id"]
    institute_id = claimed["institute_id"]
    try:
        # 1. Resolve the recording in our storage.
        storage_key = claimed.get("recording_storage_key")
        if not storage_key:
            _mark(row_id, "SKIPPED", skip_reason="NO_RECORDING")
            return
        # Recordings are stored in the PUBLIC media bucket (same as lead-profile
        # playback). The private resolver 404s for them → transcription fails.
        source_url = await get_public_file_url(storage_key)

        # 2. Settings (rubric + credit override).
        cfg = await asyncio.to_thread(_read_call_settings, institute_id)

        # 3. Credit pre-flight (don't transcribe what we can't bill).
        credit = await asyncio.to_thread(_check_credits, institute_id, cfg["credit_override"])
        if not credit["sufficient"]:
            _mark(row_id, "SKIPPED", skip_reason="INSUFFICIENT_CREDITS")
            logger.info("call-intel: SKIPPED %s — insufficient credits (need %s, have %s)",
                        call_log_id, credit["cost"], credit["balance"])
            return

        # 4. Transcribe (Hindi + English).
        tx = await _transcribe(source_url, row_id)
        transcript = await _fetch_text(tx["source_txt_url"]) or await _fetch_text(tx["english_txt_url"])
        if not transcript.strip():
            _mark(row_id, "SKIPPED", skip_reason="EMPTY_TRANSCRIPT")
            return

        # 5. Analyze.
        with db_session() as db:
            db.execute(text("UPDATE call_intelligence SET status='ANALYZING', updated_at=now() WHERE id=:id"),
                       {"id": row_id})
        prompt = build_prompt(
            transcript,
            rating_scale=cfg["rating_scale"],
            objective_hint=cfg["objective_hint"],
            qualities=cfg["qualities"],
            weights=cfg["weights"],
            direction=claimed.get("direction"),
            source=claimed.get("source"),
            duration_seconds=claimed.get("duration_seconds"),
        )
        sanitized, model_used, _usage = await llm_json.generate_json(
            prompt, [get_settings().llm_default_model], label="call_intelligence",
        )
        data = json.loads(sanitized)

        # 6. Deduct + persist (one transaction, idempotent).
        columns = _columns_from_analysis(
            data, model_used, tx.get("detected_language"), tx.get("language_probability"),
            tx.get("source_txt_url"), tx.get("english_txt_url"),
        )
        await asyncio.to_thread(
            _deduct_and_write, row_id, call_log_id, institute_id,
            claimed.get("counsellor_user_id"), credit["cost"], columns, data,
        )
        logger.info("call-intel: COMPLETED %s (institute %s, model %s)", call_log_id, institute_id, model_used)

    except Exception as exc:  # noqa: BLE001
        logger.warning("call-intel: FAILED %s: %s", call_log_id, exc, exc_info=True)
        try:
            _mark(row_id, "FAILED", error=str(exc))
        except Exception:
            logger.error("call-intel: could not mark %s FAILED", call_log_id, exc_info=True)
