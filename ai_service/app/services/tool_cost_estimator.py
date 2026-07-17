"""
Tool Cost Estimator — parametric, predictable credit estimates for AI tools.

This is the *single source of truth* shared by:
  • the cost PREVIEW the admin sees before running a tool ("≈ N credits"), and
  • (Phase 2) the floor of the actual charge — the deduction is
    `max(parametric_estimate, actual_token_cost)`, so the user is never
    charged below the previewed number.

Unlike `CreditService.calculate_credits` (which converts real model USD token
cost → credits), this estimator computes credits *directly* from a small set of
user-controlled inputs (number of questions, audio minutes, transcript length,
lecture toggles). That makes the number stable and explainable — "10 questions
= 10 credits" — which is exactly what the preview UI wants.

Rates are DB-tunable via the `ai_tool_pricing` table (created by an admin_core
Flyway migration). If the table is missing/empty (pre-migration environments),
we fall back to `DEFAULT_TOOL_PRICING` below — the same pattern as
`CreditService._get_pricing` / `DEFAULT_PRICING`.
"""
from __future__ import annotations

import json
import logging
from decimal import Decimal, ROUND_CEILING
from typing import Any, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

logger = logging.getLogger(__name__)


# ============================================================================
# Default parametric rates (fallback if `ai_tool_pricing` table not seeded).
#
# All numbers are in CREDITS (not USD). `request_type` is the bucket the
# Phase-2 deduction records on `credit_transactions.request_type`.
#
# unit_field drives the formula:
#   "questions"     → flat_base + num_questions × per_unit
#                     (+ num_questions × params.image_unit_credits if images)
#   "audio_minutes" → flat_base + minutes × per_unit  (minutes from
#                     duration_seconds or audio_minutes), floored at params.min_credits
#   "chars"         → flat_base + ceil(transcript_chars / params.chars_per_unit) × per_unit
#   "flat"          → flat_base (+ params.questions_add / homework_add toggles)
# ============================================================================
DEFAULT_TOOL_PRICING: Dict[str, Dict[str, Any]] = {
    "assessment": {
        "request_type": "assessment",
        "flat_base_credits": Decimal("0"),
        "per_unit_credits": Decimal("1"),
        "unit_field": "questions",
        "params": {"image_unit_credits": "0.5"},
    },
    # AI evaluation of one uploaded answer copy (copy-check): OCR + per-question
    # rubric-grounded grading. Priced per graded question for a predictable
    # preview ("8 questions = 8 credits"); the actual charge is
    # max(this, real token cost), so premium models (Opus/GPT) add overage on
    # long answers while flash-lite copies stay at the flat per-question rate.
    "copy_check_evaluation": {
        "request_type": "evaluation",
        "flat_base_credits": Decimal("0"),
        "per_unit_credits": Decimal("1"),
        "unit_field": "questions",
        "params": {},
    },
    "coding_question": {
        # One AI-authored coding question (problem + test cases + starter code
        # per language + a reference solution). A single LLM call — priced flat
        # for predictable, FE/BE-identical estimates. Tunable via ai_tool_pricing.
        "request_type": "coding_question",
        "flat_base_credits": Decimal("4"),
        "per_unit_credits": Decimal("0"),
        "unit_field": "flat",
        "params": {},
    },
    "transcription": {
        "request_type": "transcription",
        "flat_base_credits": Decimal("0"),
        "per_unit_credits": Decimal("0.5"),
        "unit_field": "audio_minutes",
        "params": {"min_credits": "2"},
    },
    "notes": {
        "request_type": "notes",
        "flat_base_credits": Decimal("3"),
        "per_unit_credits": Decimal("1"),
        "unit_field": "chars",
        "params": {"chars_per_unit": "2000"},
    },
    "lecture": {
        "request_type": "lecture",
        "flat_base_credits": Decimal("4"),
        "per_unit_credits": Decimal("0"),
        "unit_field": "flat",
        "params": {"questions_add": "2", "homework_add": "2"},
    },
    # ---- AI course creation (copilot) ------------------------------------
    # One outline generation = one large LLM call authoring the whole course
    # tree. Charged as max(flat, actual token cost).
    "course_outline": {
        "request_type": "outline",
        "flat_base_credits": Decimal("2"),
        "per_unit_credits": Decimal("0"),
        "unit_field": "flat",
        "params": {},
    },
    # Per-slide content generation charges. AI_VIDEO / AI_SLIDES /
    # AI_STORYBOOK slides are NOT covered by these — the video pipeline
    # already meters their actual usage (video/tts/image/stock).
    "course_slide_document": {
        "request_type": "content",
        "flat_base_credits": Decimal("1"),
        "per_unit_credits": Decimal("0"),
        "unit_field": "flat",
        "params": {},
    },
    "course_slide_assessment": {
        "request_type": "content",
        "flat_base_credits": Decimal("1"),
        "per_unit_credits": Decimal("0"),
        "unit_field": "flat",
        "params": {},
    },
    # YouTube search (VIDEO) or search + code example (VIDEO_CODE).
    "course_slide_video": {
        "request_type": "content",
        "flat_base_credits": Decimal("1"),
        "per_unit_credits": Decimal("0"),
        "unit_field": "flat",
        "params": {},
    },
    # HTML Document slide AI authoring — one large creative-HTML LLM call
    # (claude-sonnet-5, up to ~32k output tokens), flat per call, charged as
    # max(flat, actual). A full CREATE costs more than a conversational EDIT
    # (which reuses the existing page), so they are priced separately.
    "html_document": {          # first generation (create)
        "request_type": "content",
        "flat_base_credits": Decimal("15"),
        "per_unit_credits": Decimal("0"),
        "unit_field": "flat",
        "params": {},
    },
    "html_document_edit": {     # conversational edit of an existing page
        "request_type": "content",
        "flat_base_credits": Decimal("3"),
        "per_unit_credits": Decimal("0"),
        "unit_field": "flat",
        "params": {},
    },
    # Per-page surcharge for grounding an HTML doc in an uploaded PDF (MathPix
    # conversion cost). Charged as num_pages × per_unit, on top of the
    # generation charge — deters dumping very large PDFs.
    "html_document_pdf": {
        "request_type": "content",
        "flat_base_credits": Decimal("0"),
        "per_unit_credits": Decimal("0.5"),
        "unit_field": "pages",
        "params": {},
    },
    # AI Page Builder — one wizard run composes a full catalogue page as
    # schema-bound JSON (one large LLM call + validation/repair round-trips).
    # Charged as max(flat, actual token cost).
    "page_generate": {
        "request_type": "content",
        "flat_base_credits": Decimal("10"),
        "per_unit_credits": Decimal("0"),
        "unit_field": "flat",
        "params": {},
    },
    # AI Page Builder copilot — one conversational edit returns a small op list
    # (insert/update/remove/move) against the current page. Cheaper than a full
    # generate (reuses the existing page as context, smaller output).
    "page_edit": {
        "request_type": "content",
        "flat_base_credits": Decimal("3"),
        "per_unit_credits": Decimal("0"),
        "unit_field": "flat",
        "params": {},
    },
    # AI Page Builder brand kit — one small LLM call proposing 2-3 ThemePacks
    # (color/atmosphere/fonts) from the institute's brand. Cheap.
    "page_brand_kit": {
        "request_type": "content",
        "flat_base_credits": Decimal("2"),
        "per_unit_credits": Decimal("0"),
        "unit_field": "flat",
        "params": {},
    },
    # ---- Content translation (i18n Phase 1, V384) --------------------------
    # Ops-tunable placeholders — MUST agree with the V384 ai_tool_pricing seeds.
    # TM (translation_memory) hits are free; only LLM-translated items bill.
    "translate_rich_text": {   # per rich-text / entity-field item (per 100 chars)
        "request_type": "translation",
        "flat_base_credits": Decimal("0"),
        "per_unit_credits": Decimal("0.02"),
        "unit_field": "chars",
        "params": {"chars_per_unit": "100"},
    },
    "translate_question": {    # per question (future per-question endpoint)
        "request_type": "translation",
        "flat_base_credits": Decimal("0.3"),
        "per_unit_credits": Decimal("0"),
        "unit_field": "flat",
        "params": {},
    },
    "translate_course": {      # whole-course job base (backs the 402 preflight)
        "request_type": "translation",
        "flat_base_credits": Decimal("25"),
        "per_unit_credits": Decimal("0"),
        "unit_field": "flat",
        "params": {},
    },
    "translate_strings": {     # synchronous UI/notification batch (per 100 chars of misses)
        "request_type": "translation",
        "flat_base_credits": Decimal("0"),
        "per_unit_credits": Decimal("0.01"),
        "unit_field": "chars",
        "params": {"chars_per_unit": "100"},
    },
    "dub_video": {             # audio dubbing per minute (no code path yet — later wave)
        "request_type": "translation",
        "flat_base_credits": Decimal("0"),
        "per_unit_credits": Decimal("3.0"),
        "unit_field": "audio_minutes",
        "params": {},
    },
}

# Tool keys this estimator knows about (used for validation / FE discovery).
KNOWN_TOOLS = tuple(DEFAULT_TOOL_PRICING.keys())


def _d(value: Any, default: str = "0") -> Decimal:
    """Coerce mixed JSON/None/number values to Decimal safely."""
    if value is None:
        return Decimal(default)
    if isinstance(value, Decimal):
        return value
    try:
        return Decimal(str(value))
    except Exception:
        return Decimal(default)


def _ceil_whole(value: Decimal) -> Decimal:
    """Round UP to a whole credit so the headline number stays clean ("5", "28")."""
    return value.quantize(Decimal("1"), rounding=ROUND_CEILING)


class ToolCostEstimator:
    """Computes predictable parametric credit estimates for AI tools."""

    def __init__(self, db: Session):
        self.db = db

    # ------------------------------------------------------------------
    # Rate resolution (DB → fallback)
    # ------------------------------------------------------------------
    def get_tool_pricing(self, tool_key: Optional[str] = None) -> Dict[str, Dict[str, Any]]:
        """Return active parametric rates, keyed by tool_key.

        Reads `ai_tool_pricing` when present; falls back to
        DEFAULT_TOOL_PRICING per-tool when a row is missing. Pass a tool_key
        to fetch just one (still merged with the fallback).
        """
        rows_by_key: Dict[str, Dict[str, Any]] = {}
        try:
            query = text(
                """
                SELECT tool_key, request_type, flat_base_credits, per_unit_credits,
                       unit_field, params_json
                FROM ai_tool_pricing
                WHERE is_active = TRUE
                """
            )
            for row in self.db.execute(query).fetchall():
                params = row.params_json
                if isinstance(params, str):
                    try:
                        params = json.loads(params)
                    except Exception:
                        params = {}
                rows_by_key[row.tool_key] = {
                    "request_type": row.request_type,
                    "flat_base_credits": _d(row.flat_base_credits),
                    "per_unit_credits": _d(row.per_unit_credits),
                    "unit_field": row.unit_field,
                    "params": params or {},
                }
        except Exception as exc:  # table missing in pre-migration envs
            logger.warning("ai_tool_pricing lookup failed (%s); using defaults", exc)

        merged = {**DEFAULT_TOOL_PRICING, **rows_by_key}
        if tool_key is not None:
            single = merged.get(tool_key)
            return {tool_key: single} if single else {}
        return merged

    # ------------------------------------------------------------------
    # Estimation
    # ------------------------------------------------------------------
    def estimate(self, tool_key: str, params: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Estimate the parametric credit cost of one tool invocation.

        Returns: {tool_key, request_type, estimated_credits (float),
                  breakdown: [{component, detail, credits}], unit_field}.
        Raises ValueError for an unknown tool_key.
        """
        params = params or {}
        pricing = self.get_tool_pricing(tool_key).get(tool_key)
        if not pricing:
            raise ValueError(f"Unknown tool_key '{tool_key}'. Known: {', '.join(KNOWN_TOOLS)}")

        unit_field = pricing["unit_field"]
        flat_base = pricing["flat_base_credits"]
        per_unit = pricing["per_unit_credits"]
        extra = pricing.get("params", {}) or {}

        breakdown: List[Dict[str, Any]] = []
        total = Decimal("0")

        if flat_base > 0:
            total += flat_base
            breakdown.append({"component": "base", "detail": "base cost", "credits": float(flat_base)})

        if unit_field == "questions":
            num_q = max(0, int(params.get("num_questions") or 0))
            q_credits = Decimal(num_q) * per_unit
            total += q_credits
            breakdown.append({
                "component": "questions",
                "detail": f"{num_q} question(s) × {per_unit}",
                "credits": float(q_credits),
            })
            # Image add-on. An explicit `image_count` (charge time — the images
            # actually delivered) takes precedence; otherwise `include_images`
            # means "up to one per question", the preview upper bound. This is
            # why a preview can be slightly higher than the final charge: the LLM
            # only illustrates the questions it tags (and some may fail).
            img_unit = _d(extra.get("image_unit_credits"))
            if params.get("image_count") is not None:
                num_images = max(0, int(params.get("image_count") or 0))
            elif params.get("include_images"):
                num_images = num_q
            else:
                num_images = 0
            if num_images > 0 and img_unit > 0:
                img_credits = Decimal(num_images) * img_unit
                total += img_credits
                breakdown.append({
                    "component": "images",
                    "detail": f"{num_images} image(s) × {img_unit}",
                    "credits": float(img_credits),
                })

        elif unit_field == "audio_minutes":
            minutes = self._resolve_minutes(params)
            min_credits = _d(extra.get("min_credits"))
            raw = flat_base + (Decimal(str(minutes)) * per_unit)
            total = max(min_credits, raw)
            breakdown.append({
                "component": "audio",
                "detail": f"{minutes} min × {per_unit} (min {min_credits})",
                "credits": float(max(min_credits - flat_base, Decimal(str(minutes)) * per_unit)),
            })

        elif unit_field == "chars":
            chars = max(0, int(params.get("transcript_chars") or 0))
            divisor = _d(extra.get("chars_per_unit"), "2000")
            if divisor <= 0:
                divisor = Decimal("2000")
            units = (Decimal(chars) / divisor).quantize(Decimal("1"), rounding=ROUND_CEILING)
            char_credits = units * per_unit
            total += char_credits
            breakdown.append({
                "component": "length",
                "detail": f"{chars} chars → {units} unit(s) × {per_unit}",
                "credits": float(char_credits),
            })

        elif unit_field == "pages":
            pages = max(0, int(params.get("num_pages") or 0))
            page_credits = Decimal(pages) * per_unit
            total += page_credits
            breakdown.append({
                "component": "pdf_pages",
                "detail": f"{pages} page(s) × {per_unit}",
                "credits": float(page_credits),
            })

        elif unit_field == "flat":
            if params.get("generate_questions"):
                add = _d(extra.get("questions_add"))
                total += add
                breakdown.append({"component": "questions", "detail": "question generation", "credits": float(add)})
            if params.get("generate_homework"):
                add = _d(extra.get("homework_add"))
                total += add
                breakdown.append({"component": "homework", "detail": "homework generation", "credits": float(add)})

        else:
            logger.warning("Unknown unit_field '%s' for tool '%s'", unit_field, tool_key)

        estimated = _ceil_whole(total)
        return {
            "tool_key": tool_key,
            "request_type": pricing["request_type"],
            "unit_field": unit_field,
            "estimated_credits": float(estimated),
            "breakdown": breakdown,
        }

    def estimate_with_balance(
        self,
        tool_key: str,
        params: Optional[Dict[str, Any]],
        institute_id: Optional[str],
    ) -> Dict[str, Any]:
        """estimate() + the institute's current balance / affordability."""
        result = self.estimate(tool_key, params)
        estimated = Decimal(str(result["estimated_credits"]))
        result["current_balance"] = None
        result["balance_after"] = None
        result["sufficient"] = None
        if institute_id:
            # Local import avoids a circular import at module load.
            from .credit_service import CreditService
            balance = CreditService(self.db).get_balance(institute_id)
            if balance:
                current = balance.current_balance
                result["current_balance"] = float(current)
                result["balance_after"] = float(current - estimated)
                result["sufficient"] = current >= estimated
        return result

    @staticmethod
    def _resolve_minutes(params: Dict[str, Any]) -> int:
        """Audio minutes (rounded UP) from either duration_seconds or audio_minutes."""
        if params.get("duration_seconds") is not None:
            seconds = _d(params.get("duration_seconds"))
            minutes = (seconds / Decimal("60")).quantize(Decimal("1"), rounding=ROUND_CEILING)
            return int(minutes)
        return int(_d(params.get("audio_minutes")).quantize(Decimal("1"), rounding=ROUND_CEILING))
