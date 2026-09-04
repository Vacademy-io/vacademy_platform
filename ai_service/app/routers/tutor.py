"""Live AI Tutor — creation-time endpoints (design §4, build plan WP2).

Auth: JWT + clientId through get_pinned_principal on every route. The copilot's
outline/content endpoints are unauthenticated; these deliberately are not.
"""
from __future__ import annotations

import asyncio
import json
import logging
import uuid
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, Request, UploadFile, status
from fastapi.responses import StreamingResponse
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..core.security import get_pinned_principal
from ..db import db_dependency
from ..schemas.tutor import (
    CompileRequest, PackagePlansResponse, PlanStatusItem, RecompileOptions, SourceDescriptionRequest,
)
from ..schemas.tutor import CompileKbGrounding, CompileOptions
from ..services.ai_billing import preflight_tool_credits
from ..services.tutor import plan_store
from ..services.tutor.plan_compiler import PlanCompiler
from ..services.tutor.roles import is_staff, normalize_roles
from ..services.voice_tts import (
    _EDGE_DEFAULT_VOICES, clone_voice_smallest, default_voice_for, list_cloned_voices_smallest, list_smallest_voices,
    sarvam_voice_catalogue, smallest_available,
)
from ..services.tutor.runtime.settings import TutorSettings, resolve_settings
from ..services.tutor.slide_source import (
    list_package_slides, package_belongs_to_institute, package_of_slide, slide_belongs_to_institute,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tutor/v1", tags=["tutor"])

_HEARTBEAT_SECONDS = 15
# Slide types the compiler handles in phase 1; quizzes compile deterministically
# and are not billed, so they are supported but not "billable".
SUPPORTED_SOURCE_TYPES = {"DOCUMENT", "QUIZ", "VIDEO", "HTML_VIDEO"}
BILLABLE_SOURCE_TYPES = {"DOCUMENT", "VIDEO", "HTML_VIDEO"}
# Compiles outlive the request that started them: closing the admin tab must
# not turn paid model calls into FAILED rows. Tasks are kept here so the
# event loop does not garbage-collect them mid-flight.
_BACKGROUND_COMPILES: set = set()


class Caller:
    def __init__(self, institute_id: str, user_id: Optional[str], roles: List[str], is_root: bool):
        self.institute_id = institute_id
        self.user_id = user_id
        self.roles = roles
        self.is_root = is_root


async def _caller(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> Caller:
    """JWT + clientId, pinned to one institute, and STAFF ONLY: a learner's
    token is a member of the institute too, and these routes expose quiz
    answer keys and spend the institute's credits."""
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Missing Authorization: Bearer <jwt> (with a clientId header)")
    principal = await get_pinned_principal(request, authorization, settings)
    roles = sorted(normalize_roles(principal.roles))
    if not is_staff(roles, is_root=bool(principal.is_root_user)):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN,
                            detail="Teaching plans are managed by institute staff (admin, teacher or content-creator roles)")
    return Caller(principal.institute_id, principal.user_id, roles, bool(principal.is_root_user))


def _billable_count(db: Session, slide_ids: List[str]) -> int:
    if not slide_ids:
        return 0
    rows = db.execute(
        text("SELECT source_type FROM slide WHERE id = ANY(:ids)"), {"ids": list(slide_ids)}
    ).fetchall()
    return sum(1 for r in rows if (r[0] or "").upper() in BILLABLE_SOURCE_TYPES)


def _sse(compiler: PlanCompiler, slide_ids: List[str]) -> StreamingResponse:
    async def event_generator():
        queue: asyncio.Queue = asyncio.Queue()
        _DONE = object()

        async def _pump():
            try:
                async for ev in compiler.compile_many(slide_ids):
                    await queue.put(("data", ev))
            except Exception as exc:  # noqa: BLE001
                await queue.put(("fatal", str(exc)))
            finally:
                await queue.put((_DONE, None))

        task = asyncio.create_task(_pump())
        _BACKGROUND_COMPILES.add(task)
        task.add_done_callback(_BACKGROUND_COMPILES.discard)
        try:
            yield f"data: {json.dumps({'type': 'INFO', 'message': f'Compiling {len(slide_ids)} slide(s)', 'total': len(slide_ids)})}\n\n"
            while True:
                try:
                    kind, val = await asyncio.wait_for(queue.get(), timeout=_HEARTBEAT_SECONDS)
                except asyncio.TimeoutError:
                    yield ": keepalive\n\n"
                    continue
                if kind is _DONE:
                    break
                if kind == "data":
                    yield f"data: {json.dumps(val, ensure_ascii=False, default=str)}\n\n"
                else:
                    yield f"data: {json.dumps({'type': 'ERROR', 'message': val})}\n\n"
            yield f"data: {json.dumps({'type': 'DONE'})}\n\n"
        finally:
            # The client went away (or DONE was sent): the pump keeps running
            # to completion in the background; its later events are dropped.
            pass

    return StreamingResponse(
        event_generator(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


def _preflight(db: Session, institute_id: str, n_slides: int) -> None:
    if n_slides <= 0:
        return   # quizzes only: nothing will be billed
    estimate = preflight_tool_credits(db, tool_key="tutor_compile_slide", tool_params={}, institute_id=institute_id)
    if estimate.get("sufficient") is False:
        raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED,
                            detail=f"Insufficient credits: compiling needs ≈{estimate.get('estimated_credits')} credits per slide, balance is {estimate.get('current_balance')}.")
    try:
        per = float(estimate.get("estimated_credits") or 0)
        bal = estimate.get("current_balance")
        if bal is not None and per > 0 and float(bal) < per * max(1, n_slides):
            raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED,
                                detail=f"Insufficient credits: {n_slides} slide(s) need ≈{per * n_slides:g} credits, balance is {bal}.")
    except HTTPException:
        raise
    except Exception:  # noqa: BLE001 — never block on a malformed estimate
        pass


def _compiler(db: Session, caller: Caller, package_id: str, p: CompileOptions, *, force: bool) -> PlanCompiler:
    """Course Tutor Mode settings (package → institute → platform) supply what
    the request leaves at its defaults: the compile model, the teacher's
    name, the KB grounding saved at creation, and whether images are on."""
    s: TutorSettings = resolve_settings(db, package_id=package_id, institute_id=caller.institute_id)
    fields = p.model_fields_set
    teacher = p.teacher_name if "teacher_name" in fields else (s.teacher_name or p.teacher_name)
    language = p.language if "language" in fields else s.course_language
    images = p.generate_images if "generate_images" in fields else bool(s.generate_images)
    kb = p.kb_grounding if "kb_grounding" in fields else (
        CompileKbGrounding(**s.kb_grounding) if s.kb_grounding else None)
    return PlanCompiler(
        institute_id=caller.institute_id, user_id=caller.user_id, language=language,
        teacher_name=teacher, force=force, generate_images=images, kb_grounding=kb,
        compile_run_id=p.compile_run_id or str(uuid.uuid4()), model_override=s.compile_model,
    )


@router.post("/compile", summary="Compile slides of a course into teaching plans (SSE)")
async def compile_plans(
    payload: CompileRequest,
    caller: Caller = Depends(_caller),
    db: Session = Depends(db_dependency),
) -> StreamingResponse:
    if not package_belongs_to_institute(db, payload.package_id, caller.institute_id):
        raise HTTPException(status_code=404, detail="Course not found in this institute")
    slide_ids = list(dict.fromkeys(payload.slide_ids))
    if not slide_ids:
        slide_ids = [s["slide_id"] for s in list_package_slides(db, payload.package_id)
                     if (s["source_type"] or "").upper() in SUPPORTED_SOURCE_TYPES]
    if not slide_ids:
        raise HTTPException(status_code=400, detail="No slides to compile")
    # Only document and video slides cost credits; quizzes compile for free.
    _preflight(db, caller.institute_id, _billable_count(db, slide_ids))
    compiler = _compiler(db, caller, payload.package_id, payload, force=payload.force)
    return _sse(compiler, slide_ids)


@router.post("/slides/{slide_id}/recompile", summary="Recompile one slide (SSE)")
async def recompile_slide(
    slide_id: str,
    payload: Optional[RecompileOptions] = None,
    caller: Caller = Depends(_caller),
    db: Session = Depends(db_dependency),
) -> StreamingResponse:
    if not slide_belongs_to_institute(db, slide_id, caller.institute_id):
        raise HTTPException(status_code=404, detail="Slide not found in this institute")
    _preflight(db, caller.institute_id, _billable_count(db, [slide_id]))
    p = payload or RecompileOptions()
    compiler = _compiler(db, caller, package_of_slide(db, slide_id) or "", p, force=True)
    return _sse(compiler, [slide_id])


@router.get("/packages/{package_id}/plans", response_model=PackagePlansResponse,
            summary="Teaching-plan status for every slide of a course")
def package_plans(
    package_id: str,
    caller: Caller = Depends(_caller),
    db: Session = Depends(db_dependency),
) -> PackagePlansResponse:
    """Sync handler (runs in the threadpool): three queries for the whole
    course instead of two per slide on the event loop."""
    if not package_belongs_to_institute(db, package_id, caller.institute_id):
        raise HTTPException(status_code=404, detail="Course not found in this institute")
    plan_store.retire_stuck_compiling(db)
    db.commit()
    slides = list_package_slides(db, package_id)
    ids = [s["slide_id"] for s in slides]
    newest = plan_store.latest_plans_for_slides(db, ids)
    serving = plan_store.latest_plans_for_slides(db, ids, ready_only=True)
    counts_by_plan = plan_store.counts_for_plans(db, [p.id for p in serving.values()])
    items: List[PlanStatusItem] = []
    counts: Dict[str, int] = {}
    for s in slides:
        st = (s["source_type"] or "").upper()
        plan = newest.get(s["slide_id"])
        serve = serving.get(s["slide_id"])
        if plan is None:
            status_ = "NOT_COMPILED" if st in SUPPORTED_SOURCE_TYPES else "UNSUPPORTED"
            item = PlanStatusItem(slide_id=s["slide_id"], slide_title=s["title"], source_type=st,
                                  chapter_id=s["chapter_id"], chapter_name=s["chapter_name"], status=status_)
        else:
            c = counts_by_plan.get(serve.id, {"topics": 0, "concepts": 0}) if serve else {"topics": 0, "concepts": 0}
            item = PlanStatusItem(
                slide_id=s["slide_id"], slide_title=s["title"], source_type=st,
                chapter_id=s["chapter_id"], chapter_name=s["chapter_name"],
                plan_id=plan.id, version=plan.version, status=plan.status, error=plan.error,
                serving_plan_id=serve.id if serve else None,
                topics=c["topics"], concepts=c["concepts"],
                updated_at=plan.updated_at.isoformat() if plan.updated_at else None,
            )
        counts[item.status] = counts.get(item.status, 0) + 1
        items.append(item)
    return PackagePlansResponse(package_id=package_id, counts=counts, slides=items)


@router.get("/slides/{slide_id}/plan", summary="Teaching plan of a slide (preview)")
def slide_plan(
    slide_id: str,
    latest: bool = Query(default=False, description="Newest row even if not READY (default: the READY plan learners get)"),
    caller: Caller = Depends(_caller),
    db: Session = Depends(db_dependency),
) -> Dict[str, Any]:
    if not slide_belongs_to_institute(db, slide_id, caller.institute_id):
        raise HTTPException(status_code=404, detail="Slide not found in this institute")
    plan = plan_store.latest_plan(db, slide_id) if latest else (
        plan_store.latest_ready_plan(db, slide_id) or plan_store.latest_plan(db, slide_id)
    )
    if plan is None:
        raise HTTPException(status_code=404, detail="No teaching plan for this slide yet")
    return plan_store.plan_view(db, plan)


@router.put("/slides/{slide_id}/source-description", summary="Set what a video / PDF slide teaches")
async def put_source_description(
    slide_id: str,
    payload: SourceDescriptionRequest,
    caller: Caller = Depends(_caller),
    db: Session = Depends(db_dependency),
) -> Dict[str, Any]:
    if not slide_belongs_to_institute(db, slide_id, caller.institute_id):
        raise HTTPException(status_code=404, detail="Slide not found in this institute")
    plan = plan_store.set_source_description(
        db, slide_id=slide_id, institute_id=caller.institute_id,
        description=payload.description.strip(), user_id=caller.user_id,
    )
    db.commit()
    return {"slide_id": slide_id, "plan_id": plan.id, "status": plan.status}


# ── option catalogues for the Tutor Mode settings cards ──────────────────────

@router.get("/options", summary="Voices per provider and models for the Tutor Mode settings dropdowns")
async def tutor_options(
    caller: Caller = Depends(_caller),
    db: Session = Depends(db_dependency),
) -> Dict[str, Any]:
    voices: Dict[str, List[Dict[str, Any]]] = {"sarvam": sarvam_voice_catalogue(), "google": [], "edge": [], "smallest": []}
    for lang, vid in _EDGE_DEFAULT_VOICES.items():
        voices["edge"].append({"id": vid, "name": vid.split("-")[-1].replace("Neural", ""), "gender": "female", "languages": [lang]})
    for lang in ("en-IN", "hi-IN"):
        voices["google"].append({"id": default_voice_for("google", lang), "name": f"Chirp3-HD Achird ({lang})",
                                 "gender": "female", "languages": [lang]})
    if smallest_available():
        try:
            voices["smallest"] = await list_smallest_voices()
        except Exception as e:  # noqa: BLE001
            logger.warning("Smallest voice catalogue unavailable: %s", e)
        try:
            for v in await list_cloned_voices_smallest():
                vid = v.get("voiceId") or v.get("voice_id")
                if vid:
                    voices["smallest"].insert(0, {"id": str(vid), "name": f"{v.get('displayName') or v.get('name') or vid} (cloned)",
                                                  "gender": None, "languages": [], "cloned": True})
        except Exception as e:  # noqa: BLE001
            logger.warning("Smallest cloned voices unavailable: %s", e)
    rows = db.execute(text("""
        SELECT model_id, name, provider, tier, COALESCE(is_free, FALSE)
        FROM ai_models
        WHERE is_active = TRUE AND category NOT IN ('embedding', 'image', 'tts', 'video')
        ORDER BY display_order, provider, name
    """)).fetchall()
    models = [{"model_id": r[0], "name": r[1], "provider": r[2], "tier": r[3], "is_free": bool(r[4])} for r in rows]
    return {"voices": voices, "models": models, "smallest_available": smallest_available()}


# ── teacher voice (Smallest.ai instant clone) ─────────────────────────────────

_CLONE_MAX_BYTES = 5 * 1024 * 1024


@router.post("/voice/clone", summary="Clone a teacher's voice from a 5-15 s sample (Smallest.ai)")
async def clone_voice(
    file: UploadFile = File(...),
    display_name: str = Form(..., min_length=1, max_length=80),
    language: Optional[str] = Form(default=None),
    caller: Caller = Depends(_caller),
) -> Dict[str, Any]:
    """Returns the new voice id; the admin saves it as the tutor voice with
    provider `smallest`. Consent: the institute uploads its own teacher's
    sample — the card states this before the upload."""
    if not smallest_available():
        raise HTTPException(status_code=503, detail="Voice cloning is not configured on this server")
    data = await file.read()
    if not data:
        raise HTTPException(status_code=400, detail="Empty audio file")
    if len(data) > _CLONE_MAX_BYTES:
        raise HTTPException(status_code=413, detail="Sample must be under 5 MB (5-15 seconds of clean speech)")
    try:
        result = await clone_voice_smallest(audio=data, filename=file.filename or "sample.wav",
                                            display_name=display_name, language=language)
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    logger.info("Voice cloned for institute %s by %s: %s", caller.institute_id, caller.user_id, result["voice_id"])
    return {"voice_id": result["voice_id"], "provider": "smallest", "display_name": display_name}


@router.get("/voice/clones", summary="Cloned voices available to the tutor (Smallest.ai)")
async def cloned_voices(caller: Caller = Depends(_caller)) -> Dict[str, Any]:
    if not smallest_available():
        return {"available": False, "voices": []}
    try:
        voices = await list_cloned_voices_smallest()
    except RuntimeError as e:
        raise HTTPException(status_code=502, detail=str(e))
    return {"available": True, "voices": [
        {"voice_id": v.get("voiceId") or v.get("voice_id"), "name": v.get("displayName") or v.get("name"),
         "status": v.get("status")} for v in voices
    ]}


__all__ = ["router"]
