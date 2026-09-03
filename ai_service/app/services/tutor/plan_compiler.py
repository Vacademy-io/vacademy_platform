"""Compile slides into teaching plans (design §4).

One PlanCompiler per compile request; `compile_many` runs slides under a small
semaphore and yields SSE-ready events as each finishes. Every slide owns its
own DB sessions (the pool is shared with the chatbot; three concurrent slides
is the ceiling), its own model calls, and its own billing row, so one bad
slide never fails a course.
"""
from __future__ import annotations

import asyncio
import json
import logging
from typing import Any, AsyncIterator, Dict, List, Optional, Tuple

from pydantic import ValidationError

from ...db import db_session
from ...models.ai_token_usage import RequestType
from ...models.teaching_plan import TeachingPlan
from ...schemas.tutor import CompileKbGrounding, MediaTaskOp, TeachingPlanDraft
from ..ai_billing import record_tool_billing
from ..api_key_resolver import ApiKeyResolver
from ..chat_llm_client import ChatLLMClient
from ..platform_settings_service import get_platform_setting
from . import compile_prompts as prompts
from . import plan_store
from .plan_validator import validate_plan
from .quiz_compiler import compile_quiz
from .slide_source import SlideSource, load_slide_source, slide_belongs_to_institute

logger = logging.getLogger(__name__)

MAX_REPAIRS = 2
MAX_CONCURRENT_SLIDES = 3
COMPILE_MAX_TOKENS = 12_000
DEFAULT_COMPILE_MODEL = "google/gemini-2.5-pro"


def resolve_compile_model(override: Optional[str] = None) -> Optional[str]:
    if override:
        return override
    try:
        val = get_platform_setting("tutor.compile.model", default=DEFAULT_COMPILE_MODEL)
    except Exception:  # noqa: BLE001
        val = DEFAULT_COMPILE_MODEL
    return val or None


def _pydantic_errors(exc: ValidationError) -> List[str]:
    out = []
    for e in exc.errors()[:40]:
        loc = ".".join(str(p) for p in e.get("loc", []))
        out.append(f"{loc}: {e.get('msg')}")
    return out


class PlanCompiler:
    def __init__(
        self,
        *,
        institute_id: str,
        user_id: Optional[str],
        language: str = "en",
        teacher_name: str = "Asha",
        force: bool = False,
        generate_images: bool = False,
        kb_grounding: Optional[CompileKbGrounding] = None,
        compile_run_id: Optional[str] = None,
        model_override: Optional[str] = None,
    ) -> None:
        self.institute_id = institute_id
        self.user_id = user_id
        self.language = language if language in ("en", "hi") else "en"
        self.teacher_name = teacher_name or "Asha"
        self.force = force
        self.generate_images = generate_images
        self.kb_grounding = kb_grounding
        self.compile_run_id = compile_run_id
        self.model = resolve_compile_model(model_override)

    # ── public ───────────────────────────────────────────────────────────

    async def compile_many(self, slide_ids: List[str]) -> AsyncIterator[Dict[str, Any]]:
        queue: asyncio.Queue = asyncio.Queue()
        sem = asyncio.Semaphore(MAX_CONCURRENT_SLIDES)
        _DONE = object()

        async def _one(sid: str) -> None:
            async with sem:
                await queue.put({"type": "PLAN_STARTED", "slide_id": sid})
                try:
                    ev = await self.compile_slide(sid)
                except asyncio.CancelledError:
                    raise
                except Exception as exc:  # noqa: BLE001
                    logger.exception("compile_slide crashed for %s", sid)
                    ev = {"type": "PLAN_ERROR", "slide_id": sid, "error": str(exc)[:500]}
                await queue.put(ev)

        tasks = [asyncio.create_task(_one(s)) for s in slide_ids]

        async def _waiter() -> None:
            try:
                await asyncio.gather(*tasks, return_exceptions=True)
            finally:
                await queue.put(_DONE)

        waiter = asyncio.create_task(_waiter())
        try:
            while True:
                ev = await queue.get()
                if ev is _DONE:
                    break
                yield ev
        finally:
            for t in tasks:
                t.cancel()
            waiter.cancel()

    async def compile_slide(self, slide_id: str) -> Dict[str, Any]:
        # 1. Load + gate
        with db_session() as db:
            if not slide_belongs_to_institute(db, slide_id, self.institute_id):
                return {"type": "PLAN_ERROR", "slide_id": slide_id, "error": "Slide not found in this institute"}
            source = load_slide_source(db, slide_id)
            if source is None:
                return {"type": "PLAN_ERROR", "slide_id": slide_id, "error": "Slide not found"}
            existing = plan_store.latest_plan(db, slide_id)
            description = existing.source_description if existing else None

            if source.kind == "other":
                return {"type": "PLAN_SKIPPED", "slide_id": slide_id,
                        "reason": f"{source.source_type or 'this'} slides are not compiled in phase 1"}

            if source.kind in ("video", "pdf") and not (description or "").strip():
                # Park the slide in NEEDS_DETAILS (once) so the course page can
                # list it; the admin's description flips it to STALE.
                if existing is None or existing.status != "NEEDS_DETAILS":
                    plan_store.start_plan(
                        db, slide_id=slide_id, institute_id=self.institute_id,
                        content_hash=source.content_hash, language=self.language,
                        user_id=self.user_id, source_description=None, status="NEEDS_DETAILS",
                    )
                    db.commit()
                return {"type": "PLAN_NEEDS_DETAILS", "slide_id": slide_id,
                        "reason": "Add what this video / PDF teaches before it can be compiled"}

            if (existing is not None and existing.status == "READY"
                    and existing.content_hash == source.content_hash and not self.force):
                counts = plan_store.plan_counts(db, existing.id)
                return {"type": "PLAN_UP_TO_DATE", "slide_id": slide_id, "plan_id": existing.id,
                        "version": existing.version, **counts}

            plan = plan_store.start_plan(
                db, slide_id=slide_id, institute_id=self.institute_id,
                content_hash=source.content_hash, language=self.language,
                user_id=self.user_id, source_description=description, status="COMPILING",
            )
            db.commit()
            plan_id, version = plan.id, plan.version

        # 2. Build the draft
        try:
            draft, raw, usage, model_used = await self._build_draft(source, description)
        except Exception as exc:  # noqa: BLE001
            logger.warning("Compile failed for slide %s: %s", slide_id, exc, exc_info=True)
            with db_session() as db:
                plan = db.get(TeachingPlan, plan_id)
                if plan:
                    plan_store.fail_plan(db, plan, str(exc))
                    db.commit()
            return {"type": "PLAN_ERROR", "slide_id": slide_id, "plan_id": plan_id, "error": str(exc)[:500]}

        # 3. Persist + bill
        with db_session() as db:
            plan = db.get(TeachingPlan, plan_id)
            if plan is None:
                return {"type": "PLAN_ERROR", "slide_id": slide_id, "error": "plan row vanished"}
            plan_store.store_draft(
                db, plan, draft, model=model_used, raw=raw,
                compile_inputs={
                    "kb": self.kb_grounding.model_dump() if self.kb_grounding else None,
                    "teacher_name": self.teacher_name, "language": self.language,
                    "generate_images": self.generate_images, "kind": source.kind,
                    "compile_run_id": self.compile_run_id,
                },
            )
            db.commit()
            counts = plan_store.plan_counts(db, plan_id)

        if source.kind != "quiz":
            record_tool_billing(
                tool_key="tutor_compile_slide",
                tool_params={},
                request_type=RequestType.CONTENT,
                model=model_used or "unknown",
                prompt_tokens=int(usage.get("prompt_tokens") or 0),
                completion_tokens=int(usage.get("completion_tokens") or 0),
                institute_id=self.institute_id,
                user_id=self.user_id,
                user_role="ADMIN",
                request_id=self.compile_run_id,
                idempotency_key=f"tutor_compile:{plan_id}",
            )
        return {"type": "PLAN_READY", "slide_id": slide_id, "plan_id": plan_id, "version": version,
                "kind": source.kind, "model": model_used, **counts}

    # ── draft building ───────────────────────────────────────────────────

    async def _build_draft(
        self, source: SlideSource, description: Optional[str]
    ) -> Tuple[TeachingPlanDraft, Optional[Dict[str, Any]], Dict[str, int], Optional[str]]:
        if source.kind == "quiz":
            draft = compile_quiz(source, self.language)
            errors = validate_plan(draft, self.language)
            if errors:
                raise RuntimeError("quiz plan failed validation: " + "; ".join(errors[:5]))
            return draft, None, {"prompt_tokens": 0, "completion_tokens": 0}, "deterministic"

        kb_block = await self._kb_block(source)
        system = prompts.system_prompt(self.teacher_name, self.language)
        if source.kind in ("video", "pdf"):
            user = prompts.media_task_user_prompt(
                slide_title=source.title, chapter_title=source.chapter_name, course_title=source.course_name,
                kind=source.kind, description=description or "", lang=self.language,
            )
        else:
            user = prompts.user_prompt(
                slide_title=source.title, chapter_title=source.chapter_name, course_title=source.course_name,
                slide_kind="document", source_text=source.text, lang=self.language, kb_block=kb_block,
            )
        messages: List[Dict[str, Any]] = [{"role": "system", "content": system}, {"role": "user", "content": user}]

        usage_total = {"prompt_tokens": 0, "completion_tokens": 0}
        model_used: Optional[str] = None
        last_json = ""
        draft: Optional[TeachingPlanDraft] = None
        errors: List[str] = []

        for attempt in range(MAX_REPAIRS + 1):
            content, usage, model_used = await self._chat(messages)
            for k in usage_total:
                usage_total[k] += int((usage or {}).get(k) or 0)
            data = prompts.extract_json(content)
            if data is None:
                errors = ["the reply was not a single JSON object"]
                last_json = (content or "")[:4000]
            else:
                last_json = json.dumps(data, ensure_ascii=False)
                try:
                    candidate = TeachingPlanDraft.model_validate(data)
                    errors = validate_plan(candidate, self.language)
                    if not errors:
                        draft = candidate
                        break
                except ValidationError as ve:
                    errors = _pydantic_errors(ve)
            if attempt < MAX_REPAIRS:
                messages.append({"role": "assistant", "content": last_json[:60000] or content or ""})
                messages.append({"role": "user", "content": prompts.repair_prompt(errors, last_json)})
        if draft is None:
            raise RuntimeError("plan failed validation after repairs: " + "; ".join(errors[:6]))

        raw = json.loads(last_json) if last_json else None
        await self._resolve_media(draft, source)
        errors = validate_plan(draft, self.language)
        if errors:
            raise RuntimeError("plan invalid after media stage: " + "; ".join(errors[:6]))
        return draft, raw, usage_total, model_used

    async def _chat(self, messages: List[Dict[str, Any]]) -> Tuple[str, Dict[str, Any], Optional[str]]:
        """One model call; falls back to the institute's default model when the
        configured compile model is rejected by the provider."""
        with db_session() as db:
            client = ChatLLMClient(ApiKeyResolver(db))
            for model in (self.model, None) if self.model else (None,):
                try:
                    resp = await client.chat_completion(
                        messages, temperature=0.2, max_tokens=COMPILE_MAX_TOKENS,
                        institute_id=self.institute_id, user_id=self.user_id, model=model,
                    )
                    return resp.get("content") or "", resp.get("usage") or {}, resp.get("model") or model
                except Exception as exc:  # noqa: BLE001
                    if model is None:
                        raise
                    logger.warning("Compile model %s failed (%s); retrying with the default model", model, exc)
        raise RuntimeError("no model answered")

    async def _kb_block(self, source: SlideSource) -> Optional[str]:
        if not self.kb_grounding or source.kind != "document":
            return None
        try:
            from ..kb import course_grounding
            with db_session() as db:
                g = await course_grounding.ground_slide(
                    db, kb_id=self.kb_grounding.knowledge_base_id, institute_id=self.institute_id,
                    query=" ".join(p for p in [source.chapter_name, source.title] if p),
                    mode=self.kb_grounding.mode, faithful=True,
                )
            if g and g.supported:
                return course_grounding.slide_prompt_block(g, self.kb_grounding.mode)
        except Exception:  # noqa: BLE001
            logger.warning("KB grounding unavailable for slide %s", source.slide_id, exc_info=True)
        return None

    async def _resolve_media(self, draft: TeachingPlanDraft, source: SlideSource) -> None:
        """Fill media-task urls, generate or drop requested images."""
        for topic in draft.topics:
            for concept in topic.concepts:
                kept = []
                dropped_ids = set()
                for op in concept.board_ops:
                    kind = getattr(op, "op", None)
                    if kind == "media_task":
                        op.url = source.media_url or op.url
                        op.file_id = source.media_file_id or op.file_id
                        if not (op.url or op.file_id):
                            dropped_ids.add(op.id)
                            continue
                    if kind == "image" and not op.url:
                        url = await self._generate_image(op.generate or op.description) if self.generate_images else None
                        if not url:
                            dropped_ids.add(op.id)
                            continue
                        op.url = url
                    kept.append(op)
                if dropped_ids:
                    kept = [op for op in kept
                            if getattr(op, "target", None) not in dropped_ids
                            and getattr(op, "from_", None) not in dropped_ids
                            and getattr(op, "to", None) not in dropped_ids]
                concept.board_ops = kept
        # A media task must start with the task itself.
        if source.kind in ("video", "pdf") and draft.topics and draft.topics[0].concepts:
            first = draft.topics[0].concepts[0]
            if not any(getattr(op, "op", None) == "media_task" for op in first.board_ops):
                if source.media_url or source.media_file_id:
                    first.board_ops.insert(0, MediaTaskOp(
                        op="media_task", id="t1c1-m", kind="video" if source.kind == "video" else "pdf",
                        url=source.media_url, file_id=source.media_file_id,
                        description=f"{'Watch' if source.kind == 'video' else 'Read'}: {source.title}",
                    ))

    async def _generate_image(self, prompt: Optional[str]) -> Optional[str]:
        if not prompt:
            return None
        try:
            from ..image_service import ImageGenerationService
            svc = ImageGenerationService()
            url, usage = await svc._generate_and_upload_media(prompt)  # noqa: SLF001 — existing internal helper
            if url:
                record_tool_billing(
                    tool_key="tutor_media_image", tool_params={}, request_type=RequestType.IMAGE,
                    model="image", prompt_tokens=int((usage or {}).get("prompt_tokens") or 0),
                    completion_tokens=int((usage or {}).get("completion_tokens") or 0),
                    institute_id=self.institute_id, user_id=self.user_id, user_role="ADMIN",
                    request_id=self.compile_run_id, idempotency_key=f"tutor_media:{url}",
                )
            return url
        except Exception:  # noqa: BLE001
            logger.warning("Tutor image generation failed", exc_info=True)
            return None
