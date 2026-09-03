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

from fastapi import APIRouter, Depends, Header, HTTPException, Request, status
from fastapi.responses import StreamingResponse
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..core.security import get_pinned_principal
from ..db import db_dependency
from ..schemas.tutor import CompileRequest, PackagePlansResponse, PlanStatusItem, SourceDescriptionRequest
from ..services.ai_billing import preflight_tool_credits
from ..services.tutor import plan_store
from ..services.tutor.plan_compiler import PlanCompiler
from ..services.tutor.slide_source import (
    list_package_slides, package_belongs_to_institute, slide_belongs_to_institute,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/tutor/v1", tags=["tutor"])

_HEARTBEAT_SECONDS = 15


class Caller:
    def __init__(self, institute_id: str, user_id: Optional[str]):
        self.institute_id = institute_id
        self.user_id = user_id


async def _caller(
    request: Request,
    authorization: Optional[str] = Header(default=None),
    settings: Settings = Depends(get_settings),
) -> Caller:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED,
                            detail="Missing Authorization: Bearer <jwt> (with a clientId header)")
    principal = await get_pinned_principal(request, authorization, settings)
    return Caller(principal.institute_id, principal.user_id)


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
            task.cancel()

    return StreamingResponse(
        event_generator(), media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no"},
    )


def _preflight(db: Session, institute_id: str, n_slides: int) -> None:
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
        slide_ids = [s["slide_id"] for s in list_package_slides(db, payload.package_id)]
    if not slide_ids:
        raise HTTPException(status_code=400, detail="No slides to compile")
    _preflight(db, caller.institute_id, len(slide_ids))
    compiler = PlanCompiler(
        institute_id=caller.institute_id, user_id=caller.user_id, language=payload.language,
        teacher_name=payload.teacher_name, force=payload.force, generate_images=payload.generate_images,
        kb_grounding=payload.kb_grounding, compile_run_id=payload.compile_run_id or str(uuid.uuid4()),
    )
    return _sse(compiler, slide_ids)


@router.post("/slides/{slide_id}/recompile", summary="Recompile one slide (SSE)")
async def recompile_slide(
    slide_id: str,
    payload: Optional[CompileRequest] = None,
    caller: Caller = Depends(_caller),
    db: Session = Depends(db_dependency),
) -> StreamingResponse:
    if not slide_belongs_to_institute(db, slide_id, caller.institute_id):
        raise HTTPException(status_code=404, detail="Slide not found in this institute")
    _preflight(db, caller.institute_id, 1)
    p = payload or CompileRequest(package_id="", slide_ids=[slide_id])
    compiler = PlanCompiler(
        institute_id=caller.institute_id, user_id=caller.user_id, language=p.language,
        teacher_name=p.teacher_name, force=True, generate_images=p.generate_images,
        kb_grounding=p.kb_grounding, compile_run_id=p.compile_run_id or str(uuid.uuid4()),
    )
    return _sse(compiler, [slide_id])


@router.get("/packages/{package_id}/plans", response_model=PackagePlansResponse,
            summary="Teaching-plan status for every slide of a course")
async def package_plans(
    package_id: str,
    caller: Caller = Depends(_caller),
    db: Session = Depends(db_dependency),
) -> PackagePlansResponse:
    if not package_belongs_to_institute(db, package_id, caller.institute_id):
        raise HTTPException(status_code=404, detail="Course not found in this institute")
    slides = list_package_slides(db, package_id)
    items: List[PlanStatusItem] = []
    counts: Dict[str, int] = {}
    for s in slides:
        plan = plan_store.latest_plan(db, s["slide_id"])
        st = (s["source_type"] or "").upper()
        if plan is None:
            status_ = "NOT_COMPILED" if st in ("DOCUMENT", "QUIZ", "VIDEO", "HTML_VIDEO") else "UNSUPPORTED"
            item = PlanStatusItem(slide_id=s["slide_id"], slide_title=s["title"], source_type=st,
                                  chapter_id=s["chapter_id"], chapter_name=s["chapter_name"], status=status_)
        else:
            c = plan_store.plan_counts(db, plan.id) if plan.status == "READY" else {"topics": 0, "concepts": 0}
            item = PlanStatusItem(
                slide_id=s["slide_id"], slide_title=s["title"], source_type=st,
                chapter_id=s["chapter_id"], chapter_name=s["chapter_name"],
                plan_id=plan.id, version=plan.version, status=plan.status, error=plan.error,
                topics=c["topics"], concepts=c["concepts"],
                updated_at=plan.updated_at.isoformat() if plan.updated_at else None,
            )
        counts[item.status] = counts.get(item.status, 0) + 1
        items.append(item)
    return PackagePlansResponse(package_id=package_id, counts=counts, slides=items)


@router.get("/slides/{slide_id}/plan", summary="Latest teaching plan of a slide (preview)")
async def slide_plan(
    slide_id: str,
    caller: Caller = Depends(_caller),
    db: Session = Depends(db_dependency),
) -> Dict[str, Any]:
    if not slide_belongs_to_institute(db, slide_id, caller.institute_id):
        raise HTTPException(status_code=404, detail="Slide not found in this institute")
    plan = plan_store.latest_plan(db, slide_id)
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


__all__ = ["router"]
