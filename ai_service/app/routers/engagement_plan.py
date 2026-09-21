"""
AI planner for daily engagement — drafts a whole plan for a teacher to review.

Two endpoints, priced separately on purpose:

  POST /engagement/plan/draft       one structured call drafts every day's tasks
                                    (questions, polls, written prompts, readings,
                                    flashcard games). Flat credit charge.
  POST /engagement/plan/illustrate  turns ONE reading into an illustrated visual
                                    note by generating its pictures. Charged per
                                    picture that actually came back.

Splitting them is the cost plan: a fortnight of illustrated pages would cost
14 × (page + images) before the teacher had seen anything. The draft is cheap;
pictures are opt-in per task.

Nothing here publishes. The draft comes back in the composer's own request shape
and the teacher saves it through the normal engagement API after review.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, List, Optional

import httpx
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..config import get_settings
from ..core.security import get_current_user
from ..db import db_dependency
from ..models.ai_token_usage import RequestType
from ..services.ai_billing import preflight_tool_credits, record_tool_billing
from ..services.document_postprocess import illustrate_document
from ..services.engagement_plan_service import (
    assemble_grounding,
    build_prompt,
    call_model,
    model_name,
    normalise_draft,
    parse_json_lenient,
    MAX_DAYS,
    MAX_ITEMS_PER_DAY,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/engagement/plan", tags=["engagement-plan"])

# Draft credits = max(flat, actual token cost × markup). A whole plan is one big
# call; the markup covers retries and the review that follows.
_USAGE_MARKUP = 2
# Pictures per illustrated reading. Enough for a textbook-style page; capped so one
# task cannot quietly become the most expensive thing in the plan.
_MAX_IMAGES_PER_READING = 3


class GroundingText(BaseModel):
    title: Optional[str] = None
    text: str


class Mix(BaseModel):
    question_of_day: bool = True
    text_question: bool = False
    poll: bool = False
    reading: bool = True
    game: bool = False


class DraftRequest(BaseModel):
    institute_id: Optional[str] = Field(None, description="Institute to charge (academy-credits).")
    title: Optional[str] = None
    topic: Optional[str] = Field(None, description="What to cover, in the teacher's words.")
    audience: Optional[str] = None
    language: str = "English"
    difficulty: str = "medium"
    start_date: str = Field(..., description="yyyy-MM-dd, institute-local")
    days: int = Field(7, ge=1, le=MAX_DAYS)
    per_day_items: int = Field(2, ge=1, le=MAX_ITEMS_PER_DAY)
    start_time: str = "06:00"
    end_time: str = "20:00"
    reveal_time: Optional[str] = "20:00"
    notify_time: Optional[str] = "06:00"
    completion_points: int = 10
    correct_points: int = 20
    mix: Mix = Mix()
    grounding_texts: List[GroundingText] = Field(default_factory=list, description="Slide text the teacher selected.")
    kb_id: Optional[str] = Field(None, description="Knowledge base to retrieve from, if any.")
    idempotency_key: Optional[str] = None
    # Regenerate ONE task instead of a plan: forces days=1, one item of this type,
    # and a much smaller charge.
    single_item_type: Optional[str] = None
    avoid_title: Optional[str] = Field(None, description="The rejected task's title, so the replacement differs.")


class DraftResponse(BaseModel):
    title: str
    slots: List[Dict[str, Any]]
    model: str
    days_planned: int
    items_planned: int
    grounded: bool


class IllustrateRequest(BaseModel):
    institute_id: Optional[str] = None
    title: str = "Reading"
    content_html: str
    max_images: int = Field(2, ge=1, le=_MAX_IMAGES_PER_READING)
    idempotency_key: Optional[str] = None


class IllustrateResponse(BaseModel):
    content_html: str
    images_generated: int


def _actor(current_user, body_institute: Optional[str]):
    if not current_user:
        raise HTTPException(status_code=401, detail="Authentication required")
    user_id = getattr(current_user, "user_id", None)
    if user_id is None and isinstance(current_user, dict):
        user_id = current_user.get("user_id")
    token_institute = getattr(current_user, "institute_id", None)
    if token_institute is None and isinstance(current_user, dict):
        token_institute = current_user.get("institute_id")
    raw = getattr(current_user, "roles", None) or getattr(current_user, "authorities", None)
    if raw is None and isinstance(current_user, dict):
        raw = current_user.get("roles") or current_user.get("authorities")
    roles = _flatten_roles(raw)
    # Staff only. Both endpoints spend the institute's credits, so the caller must
    # hold a teaching or admin authority — a learner token must NOT fall through to
    # a default role the way some older routers allow.
    if any("ADMIN" in r for r in roles):
        role = "ADMIN"
    elif any("TEACHER" in r for r in roles):
        role = "TEACHER"
    else:
        raise HTTPException(status_code=403, detail="Planning engagement needs a teacher or admin account.")
    return user_id, (token_institute or body_institute), role


def _flatten_roles(raw) -> set:
    """Roles arrive either as a flat list or as the JWT's per-institute map
    {instituteId: {roles: [...]}}; accept both."""
    out = set()
    if isinstance(raw, dict):
        for v in raw.values():
            inner = v.get("roles") if isinstance(v, dict) else v
            for r in inner or []:
                out.add(str(r).upper())
    else:
        for r in raw or []:
            out.add(str(r).upper())
    return out


def _gate(db: Session, tool_key: str, institute_id: Optional[str], what: str) -> None:
    """402 before spending anything, so a teacher on an empty balance learns it up
    front rather than after a two-minute wait."""
    if not institute_id:
        return
    estimate = preflight_tool_credits(db, tool_key=tool_key, tool_params={}, institute_id=institute_id)
    if estimate.get("sufficient") is False:
        raise HTTPException(
            status_code=status.HTTP_402_PAYMENT_REQUIRED,
            detail=(
                f"Insufficient credits: {what} needs ~{estimate['estimated_credits']} credits "
                f"but the balance is {estimate.get('current_balance')}."
            ),
        )


@router.post("/draft", response_model=DraftResponse)
async def draft_plan(
    body: DraftRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(db_dependency),
):
    user_id, institute_id, role = _actor(current_user, body.institute_id)
    settings = get_settings()
    api_key = getattr(settings, "openrouter_api_key", None)
    if not api_key:
        raise HTTPException(status_code=503, detail="No LLM provider configured. Set OPENROUTER_API_KEY.")
    base_url = getattr(settings, "llm_base_url", "https://openrouter.ai/api/v1/chat/completions")
    model = model_name()

    if not (body.topic and body.topic.strip()) and not body.grounding_texts and not body.kb_id:
        raise HTTPException(status_code=400, detail="Give a topic, pick some course content, or choose a knowledge base.")

    is_single = bool(body.single_item_type)
    tool_key = "engagement_item" if is_single else "engagement_plan"
    if is_single:
        body.days = 1
        body.per_day_items = 1
    _gate(db, tool_key, institute_id, "regenerating this task" if is_single else "drafting this plan")

    # Grounding: teacher-picked slide text first; then KB retrieval keyed on the
    # topic, so the questions come from the institute's own material.
    kb_hits: List[Dict[str, Any]] = []
    if body.kb_id and institute_id:
        try:
            from ..services.kb.retrieval import KbRetrievalService

            query = (body.topic or body.title or "key concepts").strip()
            kb_hits = await KbRetrievalService(db).search(
                kb_id=body.kb_id, institute_id=institute_id, query=query, top_k=12
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("[engagement-plan] KB retrieval skipped: %s", e)

    grounding = assemble_grounding([g.model_dump() for g in body.grounding_texts], kb_hits)
    brief = body.model_dump()
    prompt = build_prompt(brief, grounding)

    try:
        text, usage = await call_model(prompt, api_key, base_url, model)
        raw = parse_json_lenient(text)
    except httpx.HTTPStatusError as e:
        logger.error("[engagement-plan] model call failed: %s", e)
        raise HTTPException(status_code=502, detail="The AI provider rejected the request. Try again.")
    except Exception as e:  # noqa: BLE001
        logger.error("[engagement-plan] draft failed: %s", e)
        raise HTTPException(status_code=502, detail="Could not draft a plan from that brief. Try a clearer topic.")

    draft = normalise_draft(raw, brief)
    if not draft["slots"]:
        raise HTTPException(status_code=422, detail="The draft came back empty. Try a narrower topic or fewer days.")

    # Bill after success, best-effort: the draft exists; a billing hiccup must not
    # take it away from the teacher.
    try:
        record_tool_billing(
            tool_key=tool_key,
            tool_params={"days": body.days},
            request_type=RequestType.CONTENT,
            model=model,
            prompt_tokens=int(usage.get("prompt_tokens") or 0),
            completion_tokens=int(usage.get("completion_tokens") or 0),
            institute_id=institute_id,
            user_id=user_id,
            user_role=role if user_id else None,
            idempotency_key=body.idempotency_key,
            usage_markup=_USAGE_MARKUP,
        )
    except Exception as e:  # noqa: BLE001
        logger.warning("[engagement-plan] billing skipped: %s", e)

    items = sum(len(s["items"]) for s in draft["slots"])
    return DraftResponse(
        title=draft["title"],
        slots=draft["slots"],
        model=model,
        days_planned=len(draft["slots"]),
        items_planned=items,
        grounded=bool(grounding),
    )


@router.post("/illustrate", response_model=IllustrateResponse)
async def illustrate_reading(
    body: IllustrateRequest,
    current_user=Depends(get_current_user),
    db: Session = Depends(db_dependency),
):
    """Generate the pictures a drafted reading asked for, turning it into a visual
    note. Charged per picture that actually came back — a failed generation costs
    nothing."""
    user_id, institute_id, role = _actor(current_user, body.institute_id)
    if "data-img-prompt" not in body.content_html:
        return IllustrateResponse(content_html=body.content_html, images_generated=0)

    _gate(db, "html_document_image", institute_id, "illustrating this reading")

    try:
        html, count = await illustrate_document(
            body.content_html, slide_path="engagement", max_images=body.max_images
        )
    except Exception as e:  # noqa: BLE001
        logger.error("[engagement-plan] illustrate failed: %s", e)
        raise HTTPException(status_code=502, detail="Could not generate the pictures. Try again.")

    if count > 0:
        try:
            record_tool_billing(
                tool_key="html_document_image",
                tool_params={"images": count},
                request_type=RequestType.IMAGE,
                model="qwen/qwen-image-3",
                institute_id=institute_id,
                user_id=user_id,
                user_role=role if user_id else None,
                idempotency_key=body.idempotency_key,
            )
        except Exception as e:  # noqa: BLE001
            logger.warning("[engagement-plan] image billing skipped: %s", e)

    return IllustrateResponse(content_html=html, images_generated=count)
