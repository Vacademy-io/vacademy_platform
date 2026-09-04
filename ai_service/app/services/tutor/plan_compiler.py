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
from ..ai_billing import record_llm_billing, record_tool_billing
from ..api_key_resolver import ApiKeyResolver
from ..chat_llm_client import ChatLLMClient
from ..platform_settings_service import get_platform_setting
from . import compile_prompts as prompts
from . import plan_store
from .plan_validator import DEFAULT_LIMITS, QUIZ_LIMITS, validate_plan
from .quiz_compiler import compile_quiz
from .slide_source import SlideSource, load_slide_source, slide_belongs_to_institute

logger = logging.getLogger(__name__)

MAX_REPAIRS = 2
MAX_CONCURRENT_SLIDES = 3
# AI images are the expensive visual; SVG diagrams are free. Cap per slide.
MAX_GENERATED_IMAGES_PER_SLIDE = 4
COMPILE_MAX_TOKENS = 12_000
# Flash, not Pro: on this platform's credit pricing a single failed Pro compile
# (3 × ~7k output tokens) cost 35 credits on 2026-09-03; Flash is an order of
# magnitude cheaper and the validator + repair loop carries the quality. Raise
# it per platform setting tutor.compile.model when the economics allow.
DEFAULT_COMPILE_MODEL = "google/gemini-2.5-flash"


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


class _Skip(Exception):
    """Raised by the draft stage when a slide should be reported as skipped
    (not failed): nothing to teach, no model call made."""


class _FixedKeys:
    """Pre-resolved API keys, so no DB session is held across a model call.
    Duck-types ApiKeyResolver.resolve_keys (same trick as the chat agent)."""

    def __init__(self, keys: Tuple[Optional[str], Optional[str], Optional[str]]):
        self._keys = keys

    def resolve_keys(self, institute_id=None, user_id=None, request_model=None, **_ignored):
        return self._keys


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
        self.teacher_name = (teacher_name or "Asha")[:60]
        self.force = force
        self.generate_images = generate_images
        self.kb_grounding = kb_grounding
        self.compile_run_id = (compile_run_id or "")[:64] or None
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

            plan_store.retire_stuck_compiling(db, slide_id)
            in_progress = plan_store.active_compiling(db, slide_id)
            if in_progress is not None:
                db.commit()
                return {"type": "PLAN_IN_PROGRESS", "slide_id": slide_id, "plan_id": in_progress.id,
                        "reason": "a compile of this slide is already running"}

            existing = plan_store.latest_plan(db, slide_id)
            description = existing.source_description if existing else None

            if source.kind == "other":
                db.commit()
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
                    and existing.content_hash == source.content_hash
                    and existing.language == self.language and not self.force):
                counts = plan_store.plan_counts(db, existing.id)
                db.commit()
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
        self._usage = {"prompt_tokens": 0, "completion_tokens": 0}
        self._model_used: Optional[str] = None
        try:
            draft, raw = await self._build_draft(source, description)
        except _Skip as skip:
            self._fail(plan_id, f"skipped: {skip}")
            return {"type": "PLAN_SKIPPED", "slide_id": slide_id, "plan_id": plan_id, "reason": str(skip)}
        except asyncio.CancelledError:
            # Client went away or the server is shutting down: never leave the
            # row COMPILING. The write is synchronous, so it completes even
            # though this task is being cancelled.
            self._fail(plan_id, "compile cancelled")
            self._bill_partial(slide_id)
            raise
        except Exception as exc:  # noqa: BLE001
            logger.warning("Compile failed for slide %s: %s", slide_id, exc, exc_info=True)
            self._fail(plan_id, str(exc))
            self._bill_partial(slide_id)
            return {"type": "PLAN_ERROR", "slide_id": slide_id, "plan_id": plan_id, "error": str(exc)[:500]}

        # 3. Persist + bill
        with db_session() as db:
            plan = db.get(TeachingPlan, plan_id)
            if plan is None:
                return {"type": "PLAN_ERROR", "slide_id": slide_id, "error": "plan row vanished"}
            plan_store.store_draft(
                db, plan, draft, model=self._model_used, raw=raw,
                compile_inputs={
                    "kb": self.kb_grounding.model_dump() if self.kb_grounding else None,
                    "teacher_name": self.teacher_name, "language": self.language,
                    "generate_images": self.generate_images, "kind": source.kind,
                    "compile_run_id": self.compile_run_id,
                },
                compiled_with_description=description,
            )
            status_after = plan.status
            db.commit()
            counts = plan_store.plan_counts(db, plan_id)

        if source.kind != "quiz":
            record_tool_billing(
                tool_key="tutor_compile_slide",
                tool_params={},
                request_type=RequestType.CONTENT,
                model=self._model_used or "unknown",
                prompt_tokens=int(self._usage.get("prompt_tokens") or 0),
                completion_tokens=int(self._usage.get("completion_tokens") or 0),
                institute_id=self.institute_id,
                user_id=self.user_id,
                user_role="ADMIN",
                request_id=self.compile_run_id,
                # A retried request (same run id) or a concurrent duplicate of
                # the same slide must not bill twice.
                idempotency_key=(f"tutor_compile:{self.compile_run_id}:{slide_id}"
                                 if self.compile_run_id else f"tutor_compile:{plan_id}"),
            )
        return {"type": "PLAN_READY" if status_after == "READY" else "PLAN_STALE",
                "slide_id": slide_id, "plan_id": plan_id, "version": version,
                "kind": source.kind, "model": self._model_used, "status": status_after, **counts}

    # ── failure paths ────────────────────────────────────────────────────

    def _fail(self, plan_id: str, error: str) -> None:
        try:
            with db_session() as db:
                plan = db.get(TeachingPlan, plan_id)
                if plan is not None:
                    plan_store.fail_plan(db, plan, error)
                    db.commit()
        except Exception:  # noqa: BLE001
            logger.warning("Could not mark plan %s failed", plan_id, exc_info=True)

    def _bill_partial(self, slide_id: str) -> None:
        """A failed compile still spent model tokens: log and charge the
        ACTUAL usage (no parametric floor — nothing was delivered)."""
        pt, ct = int(self._usage.get("prompt_tokens") or 0), int(self._usage.get("completion_tokens") or 0)
        if pt + ct <= 0:
            return
        record_llm_billing(
            request_type=RequestType.CONTENT, model=self._model_used or "unknown",
            prompt_tokens=pt, completion_tokens=ct, total_tokens=pt + ct,
            institute_id=self.institute_id, user_id=self.user_id, request_id=self.compile_run_id,
            metadata={"tool": "tutor_compile_slide", "slide_id": slide_id, "outcome": "failed"},
        )

    # ── draft building ───────────────────────────────────────────────────

    async def _build_draft(
        self, source: SlideSource, description: Optional[str]
    ) -> Tuple[TeachingPlanDraft, Optional[Dict[str, Any]]]:
        if source.kind == "quiz":
            if not source.questions:
                raise _Skip("this quiz has no questions yet")
            draft = compile_quiz(source, self.language)
            errors = validate_plan(draft, self.language, limits=QUIZ_LIMITS)
            if errors:
                raise RuntimeError("quiz plan failed validation: " + "; ".join(errors[:5]))
            self._model_used = "deterministic"
            return draft, None

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

        last_json = ""
        draft: Optional[TeachingPlanDraft] = None
        errors: List[str] = []
        for attempt in range(MAX_REPAIRS + 1):
            content = await self._chat(messages)
            data = prompts.extract_json(content)
            if data is None:
                shape = prompts.describe_reply(content)
                logger.warning("Tutor compile: reply %d was not JSON for slide %s: %s", attempt + 1, source.slide_id, shape)
                errors = [f"the reply was not a single JSON object ({shape})"]
                last_json = (content or "")[:4000]
            else:
                last_json = json.dumps(data, ensure_ascii=False)
                try:
                    candidate = TeachingPlanDraft.model_validate(data)
                    # Media urls are filled by the system after this loop.
                    errors = validate_plan(candidate, self.language, limits=DEFAULT_LIMITS,
                                           require_media_urls=False)
                    if not errors:
                        draft = candidate
                        break
                except ValidationError as ve:
                    errors = _pydantic_errors(ve)
            # Which rules bounce plans is what tunes the prompt; keep it visible.
            logger.info("Tutor compile attempt %d for slide %s: %d validation error(s): %s",
                        attempt + 1, source.slide_id, len(errors), "; ".join(errors[:4])[:600])
            if attempt < MAX_REPAIRS:
                messages.append({"role": "assistant", "content": last_json[:60000] or content or ""})
                messages.append({"role": "user", "content": prompts.repair_prompt(errors, last_json)})
        if draft is None:
            raise RuntimeError("plan failed validation after repairs: " + "; ".join(errors[:6]))

        raw = json.loads(last_json) if last_json else None
        await self._resolve_media(draft, source)
        errors = validate_plan(draft, self.language, limits=DEFAULT_LIMITS, require_media_urls=True)
        if errors:
            raise RuntimeError("plan invalid after media stage: " + "; ".join(errors[:6]))
        return draft, raw

    async def _chat(self, messages: List[Dict[str, Any]]) -> str:
        """One model call. Keys are resolved in a short-lived session and the
        session is closed BEFORE the await, so no pool connection sits idle in
        an open transaction for the length of a model call. Falls back to the
        institute's default model when the configured compile model is
        rejected by the provider."""
        candidates = (self.model, None) if self.model else (None,)
        last_exc: Optional[Exception] = None
        for model in candidates:
            with db_session() as db:
                keys = ApiKeyResolver(db).resolve_keys(self.institute_id, self.user_id, request_model=model)
            client = ChatLLMClient(_FixedKeys(keys))
            try:
                resp = await client.chat_completion(
                    messages, temperature=0.2, max_tokens=COMPILE_MAX_TOKENS,
                    institute_id=self.institute_id, user_id=self.user_id, model=model,
                )
            except Exception as exc:  # noqa: BLE001
                last_exc = exc
                if model is None:
                    raise
                logger.warning("Compile model %s failed (%s); retrying with the default model", model, exc)
                continue
            usage = resp.get("usage") or {}
            for k in self._usage:
                self._usage[k] += int(usage.get(k) or 0)
            self._model_used = resp.get("model") or model or self._model_used
            return resp.get("content") or ""
        raise last_exc or RuntimeError("no model answered")

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
        """Fill media-task urls, generate or drop requested images. References
        (annotate / arrow) to a dropped element are pruned across the whole
        topic, since a later concept may point at an earlier concept's image."""
        images_left = MAX_GENERATED_IMAGES_PER_SLIDE
        for topic in draft.topics:
            dropped_ids: set = set()
            for concept in topic.concepts:
                kept = []
                for op in concept.board_ops:
                    kind = getattr(op, "op", None)
                    if kind == "media_task":
                        op.url = source.media_url or op.url
                        op.file_id = source.media_file_id or op.file_id
                        if not (op.url or op.file_id):
                            dropped_ids.add(op.id)
                            continue
                    if kind == "image" and not op.url:
                        url = None
                        if self.generate_images and images_left > 0:
                            url = await self._generate_image(op.generate or op.description, source.course_name)
                            if url:
                                images_left -= 1
                        if not url:
                            dropped_ids.add(op.id)
                            continue
                        op.url = url
                    kept.append(op)
                concept.board_ops = kept
            if dropped_ids:
                for concept in topic.concepts:
                    concept.board_ops = [
                        op for op in concept.board_ops
                        if getattr(op, "target", None) not in dropped_ids
                        and getattr(op, "from_", None) not in dropped_ids
                        and getattr(op, "to", None) not in dropped_ids
                    ]
                topic.summary_ops = [
                    op for op in topic.summary_ops
                    if getattr(op, "target", None) not in dropped_ids
                    and getattr(op, "from_", None) not in dropped_ids
                    and getattr(op, "to", None) not in dropped_ids
                ]
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

    async def _generate_image(self, prompt: Optional[str], course_name: Optional[str]) -> Optional[str]:
        if not prompt:
            return None
        try:
            from ...dependencies import get_image_service
            svc = get_image_service()
            url, usage = await svc._generate_and_upload_media(  # noqa: SLF001 — existing internal helper
                course_name=course_name or "tutor", prompt=prompt,
            )
            if url:
                record_tool_billing(
                    tool_key="tutor_media_image", tool_params={}, request_type=RequestType.IMAGE,
                    model="image", prompt_tokens=int((usage or {}).get("prompt_tokens") or 0),
                    completion_tokens=int((usage or {}).get("completion_tokens") or 0),
                    institute_id=self.institute_id, user_id=self.user_id, user_role="ADMIN",
                    request_id=self.compile_run_id, idempotency_key=f"tutor_media:{url}"[:255],
                )
            return url
        except Exception:  # noqa: BLE001
            logger.warning("Tutor image generation failed", exc_info=True)
            return None
