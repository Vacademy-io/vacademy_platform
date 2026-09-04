"""Tutor sessions: start/resume, learner state, attempts, transcript, end.

All DB work for the socket lives here so the socket handler stays a protocol
loop. Every method opens its own short session (the socket must never pin a
pool connection across a model or TTS await).
"""
from __future__ import annotations

import json
import logging
import math
import re
from dataclasses import asdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from ....db import db_session
from ....models.ai_token_usage import ApiProvider, RequestType
from ....models.teaching_plan import TeachingConcept, TeachingTopic
from ...ai_billing import preflight_tool_credits, record_tool_billing
from ....models.tutor_runtime import TutorConceptAttempt, TutorLearnerState, TutorSession
from ....repositories.chat_message_repository import ChatMessageRepository
from ....repositories.chat_session_repository import ChatSessionRepository
from ...platform_settings_service import get_platform_setting
from ...token_usage_service import TokenUsageService
from .. import plan_store
from ..slide_source import list_package_slides, slide_in_package_session
from .settings import TutorSettings, resolve_settings
from . import prompts
from . import state as sm
from .state import LessonPlan, Pointer, from_plan_view

logger = logging.getLogger(__name__)

SUPPORTED = {"DOCUMENT", "QUIZ", "VIDEO", "HTML_VIDEO"}


# ── enrolment / lookups ──────────────────────────────────────────────────────

def learner_is_enrolled(db: Session, *, user_id: str, package_session_id: str, institute_id: str) -> bool:
    row = db.execute(text("""
        SELECT 1 FROM student_session_institute_group_mapping
        WHERE user_id = :u AND package_session_id = :ps AND institute_id = :i
          AND status = 'ACTIVE'
        LIMIT 1
    """), {"u": user_id, "ps": package_session_id, "i": institute_id}).first()
    return row is not None


def package_of_session(db: Session, package_session_id: str) -> Optional[Tuple[str, str]]:
    row = db.execute(text("""
        SELECT ps.package_id, p.package_name FROM package_session ps
        JOIN package p ON p.id = ps.package_id WHERE ps.id = :ps
    """), {"ps": package_session_id}).first()
    return (row[0], row[1]) if row else None


def learner_name(db: Session, user_id: str) -> Optional[str]:
    try:
        row = db.execute(text("SELECT full_name FROM student WHERE user_id = :u LIMIT 1"), {"u": user_id}).first()
        if row and row[0]:
            return str(row[0]).split(" ")[0]
    except Exception:  # noqa: BLE001
        pass
    return None


def chapter_lineage(db: Session, chapter_id: str) -> Dict[str, Optional[str]]:
    """module_id / subject_id of a chapter: the learner app needs both to
    write progress (mark-completion, quiz activity) for a slide."""
    row = db.execute(text("""
        SELECT mcm.module_id, smm.subject_id
        FROM module_chapter_mapping mcm
        LEFT JOIN subject_module_mapping smm ON smm.module_id = mcm.module_id
        WHERE mcm.chapter_id = :c
        LIMIT 1
    """), {"c": chapter_id}).first()
    return {"module_id": row[0] if row else None, "subject_id": row[1] if row else None}


def chapter_slides(db: Session, *, package_session_id: str, chapter_id: str) -> List[Dict[str, Any]]:
    """Ordered slides of one chapter in one batch with their plan status."""
    rows = db.execute(text("""
        SELECT sl.id, sl.title, sl.source_type, cts.slide_order
        FROM chapter_package_session_mapping cpsm
        JOIN chapter_to_slides cts ON cts.chapter_id = cpsm.chapter_id AND cts.status <> 'DELETED'
        JOIN slide sl ON sl.id = cts.slide_id AND sl.status IN ('PUBLISHED', 'UNSYNC')
        WHERE cpsm.package_session_id = :ps AND cpsm.chapter_id = :c AND cpsm.status = 'ACTIVE'
        ORDER BY cts.slide_order NULLS LAST, sl.title
    """), {"ps": package_session_id, "c": chapter_id}).fetchall()
    ids = [r[0] for r in rows]
    ready = plan_store.latest_plans_for_slides(db, ids, ready_only=True)
    lineage = chapter_lineage(db, chapter_id)
    return [
        {"slide_id": r[0], "title": r[1], "source_type": (r[2] or "").upper(), "order": r[3],
         "teachable": (r[2] or "").upper() in SUPPORTED and r[0] in ready,
         "plan_id": ready[r[0]].id if r[0] in ready else None,
         "chapter_id": chapter_id, **lineage}
        for r in rows
    ]


# ── knowledge base passages for doubt / remediation turns (design §6.5) ─────

KB_SOURCE_MAX_CHARS = 6000


async def kb_source_block(lesson: LessonPlan, institute_id: str, concept_title: str, question: str) -> Optional[str]:
    """Passages from the course's own knowledge base for this concept and
    question, budgeted to ~1.5k tokens. None when the plan was not grounded
    or the KB does not cover the question."""
    if not lesson.kb or not lesson.kb.get("knowledge_base_id"):
        return None
    try:
        from ...kb import course_grounding
        with db_session() as db:
            g = await course_grounding.ground_slide(
                db, kb_id=str(lesson.kb["knowledge_base_id"]), institute_id=institute_id,
                query=" ".join(p for p in [lesson.slide_title, concept_title, (question or "")[:300]] if p),
                mode=str(lesson.kb.get("mode") or "STRICT"), faithful=False,
            )
        if not g or not g.supported or not (g.passages or "").strip():
            return None
        return g.passages.strip()[:KB_SOURCE_MAX_CHARS]
    except Exception:  # noqa: BLE001
        logger.warning("KB passages unavailable for doubt turn", exc_info=True)
        return None


# ── quiz slides: what to write back to the activity log ─────────────────────

_OPTION_REF = re.compile(r"\b(?:option\s*)?([1-6]|[a-f])\b")


def quiz_results(lesson: LessonPlan, attempt_log: Dict[str, Dict[str, Any]]) -> List[Dict[str, Any]]:
    """One row per quiz question with what the tutor recorded, in the shape
    the learner app writes to the quiz activity log. The tracking service
    re-grades from option ids, so a correct answer carries the correct ids,
    a wrong MCQ answer the option the learner named (or a sentinel that can
    never match), and an open answer whatever the model decided."""
    out: List[Dict[str, Any]] = []
    for t in lesson.topics:
        for c in t.concepts:
            chk = c.check or {}
            qid = chk.get("question_id")
            if not qid:
                continue
            att = attempt_log.get(c.id) or {}
            options = list(chk.get("options") or [])
            option_ids = list(chk.get("option_ids") or [])
            expected = (chk.get("expected") or "").lower()
            correct_ids = [oid for oid, txt in zip(option_ids, options) if txt and txt.strip().lower() in expected]
            answer = str(att.get("answer") or "")
            correct = bool(att.get("correct"))
            selected: List[str] = []
            if option_ids:
                if correct:
                    selected = list(correct_ids)
                elif answer:
                    low = answer.lower()
                    match = next((oid for oid, txt in zip(option_ids, options) if txt and txt.strip().lower() in low), None)
                    if match is None:
                        ref = _OPTION_REF.search(low)
                        if ref:
                            tok = ref.group(1)
                            idx = int(tok) - 1 if tok.isdigit() else ord(tok) - ord("a")
                            if 0 <= idx < len(option_ids):
                                match = option_ids[idx]
                    selected = [match] if match else ["tutor:unmatched"]
            out.append({
                "question_id": qid, "question_name": chk.get("prompt") or c.title,
                "answered": bool(att), "correct": correct, "answer": answer[:1000],
                "selected_option_ids": selected, "correct_option_ids": correct_ids,
                "options": [{"id": oid, "name": txt} for oid, txt in zip(option_ids, options)],
                "score": att.get("score"), "skipped": att.get("action") == "skipped",
            })
    return out


# ── live-minute meter (voice lessons) ────────────────────────────────────────

LIVE_MINUTE_TOOL = "tutor_live_minute"
LIVE_PREFLIGHT_MINUTES = 5


def preflight_minutes(db: Optional[Session] = None) -> int:
    try:
        return max(0, int(float(get_platform_setting("tutor.live.preflight_minutes", default=LIVE_PREFLIGHT_MINUTES, db=db) or 0)))
    except Exception:  # noqa: BLE001
        return LIVE_PREFLIGHT_MINUTES


def session_max_seconds(db: Optional[Session] = None) -> int:
    try:
        minutes = int(float(get_platform_setting("tutor.live.max_minutes", default=90, db=db) or 90))
    except Exception:  # noqa: BLE001
        minutes = 90
    return max(10, min(240, minutes)) * 60


def preflight_live_session(db: Session, institute_id: str) -> Optional[str]:
    """Voice lessons cost credits per minute: refuse to start one the
    institute cannot afford for a few minutes (super-admin setting). Returns
    the 402 detail, or None when the session may start (unknown balance
    never blocks)."""
    minutes = preflight_minutes(db)
    if minutes <= 0:
        return None
    try:
        est = preflight_tool_credits(db, tool_key=LIVE_MINUTE_TOOL,
                                     tool_params={"audio_minutes": minutes}, institute_id=institute_id)
    except Exception:  # noqa: BLE001
        return None
    if est.get("sufficient") is False:
        return (f"Not enough credits for a voice lesson: {minutes} minutes need ≈"
                f"{est.get('estimated_credits')} credits, balance is {est.get('current_balance')}.")
    return None


def bill_live_minute(*, tutor_session_id: str, institute_id: str, user_id: str, minute_no: int) -> bool:
    """Charge minute `minute_no` (1-based; idempotent per session+minute) and
    report whether the institute can still afford the next one."""
    record_tool_billing(
        tool_key=LIVE_MINUTE_TOOL, tool_params={"audio_minutes": 1}, request_type=RequestType.CONVERSATION,
        model="tutor-live", institute_id=institute_id, user_id=user_id, user_role="STUDENT",
        request_id=tutor_session_id, idempotency_key=f"tutor_live:{tutor_session_id}:{minute_no}",
    )
    bump_telemetry(tutor_session_id, minutes_charged=1)
    try:
        with db_session() as db:
            est = preflight_tool_credits(db, tool_key=LIVE_MINUTE_TOOL, tool_params={"audio_minutes": 1},
                                         institute_id=institute_id)
        return est.get("sufficient") is not False
    except Exception:  # noqa: BLE001
        return True


def availability(db: Session, *, package_id: str, package_session_id: Optional[str], institute_id: str,
                 user_id: Optional[str] = None) -> Dict[str, Any]:
    s = resolve_settings(db, package_id=package_id, institute_id=institute_id)
    slides = list_package_slides(db, package_id)
    supported = [x for x in slides if (x["source_type"] or "").upper() in SUPPORTED]
    ready = plan_store.latest_plans_for_slides(db, [x["slide_id"] for x in supported], ready_only=True)
    ordered_ready = [x for x in supported if x["slide_id"] in ready]
    first = ordered_ready[0] if ordered_ready else None
    resume = None
    if user_id and package_session_id:
        st = (db.query(TutorLearnerState)
              .filter(TutorLearnerState.user_id == user_id, TutorLearnerState.package_session_id == package_session_id)
              .first())
        if st and st.current_slide_id and st.current_slide_id in ready:
            resume = next((x for x in ordered_ready if x["slide_id"] == st.current_slide_id), None)
    first_lin = chapter_lineage(db, first["chapter_id"]) if first and first.get("chapter_id") else {}
    resume_lin = chapter_lineage(db, resume["chapter_id"]) if resume and resume.get("chapter_id") else {}
    return {
        "resume_slide_id": resume["slide_id"] if resume else None,
        "resume_chapter_id": resume["chapter_id"] if resume else None,
        "resume_module_id": resume_lin.get("module_id"),
        "resume_subject_id": resume_lin.get("subject_id"),
        "first_slide_id": first["slide_id"] if first else None,
        "first_chapter_id": first["chapter_id"] if first else None,
        "first_module_id": first_lin.get("module_id"),
        "first_subject_id": first_lin.get("subject_id"),
        "enabled": bool(s.enabled),
        "default_on": bool(s.default_on),
        "teacher_name": s.teacher_name,
        "teacher_avatar_file_id": s.teacher_avatar_file_id,
        "course_language": s.course_language,
        "languages": s.languages,
        "session_language": s.session_language,
        "tts_provider": s.tts_provider,
        "ready_slides": len(ready),
        "teachable_slides": len(supported),
        "available": bool(s.enabled) and len(ready) > 0,
    }


# ── learner state ────────────────────────────────────────────────────────────

def get_or_create_state(db: Session, *, user_id: str, package_session_id: str, institute_id: str) -> TutorLearnerState:
    st = (db.query(TutorLearnerState)
          .filter(TutorLearnerState.user_id == user_id, TutorLearnerState.package_session_id == package_session_id)
          .first())
    if st is None:
        st = TutorLearnerState(id=str(uuid4()), user_id=user_id, package_session_id=package_session_id,
                               institute_id=institute_id, mastery_json={}, misconceptions_json=[], weak_concepts_json=[])
        db.add(st)
        db.flush()
    return st


def state_dict(st: TutorLearnerState) -> Dict[str, Any]:
    return {
        "current_slide_id": st.current_slide_id, "current_topic_id": st.current_topic_id,
        "current_concept_id": st.current_concept_id, "current_phase": st.current_phase,
        "progress_json": dict(st.progress_json or {}), "mastery_json": dict(st.mastery_json or {}),
        "misconceptions_json": list(st.misconceptions_json or []), "weak_concepts_json": list(st.weak_concepts_json or []),
        "rolling_summary": st.rolling_summary, "preferred_language": st.preferred_language, "pace": st.pace,
    }


def load_lesson(db: Session, slide_id: str) -> Optional[LessonPlan]:
    plan = plan_store.latest_ready_plan(db, slide_id)
    if plan is None:
        return None
    view = plan_store.plan_view(db, plan)
    row = db.execute(text("SELECT title FROM slide WHERE id = :s"), {"s": slide_id}).first()
    view["slide_title"] = (row[0] if row else None) or ""
    return from_plan_view(view)


def _norm_title(t: Optional[str]) -> str:
    return " ".join((t or "").lower().split())


def slide_progress(st: TutorLearnerState, slide_id: str) -> Dict[str, Any]:
    """This slide's saved position (V497); falls back to the legacy columns
    when the row predates them."""
    prog = (st.progress_json or {}).get(slide_id) if st.progress_json else None
    if isinstance(prog, dict) and (prog.get("concept_id") or prog.get("phase")):
        return dict(prog)
    if st.current_slide_id == slide_id and (st.current_concept_id or st.current_phase):
        return {"concept_id": st.current_concept_id, "topic_id": st.current_topic_id, "phase": st.current_phase}
    return {}


def previous_slide(st: TutorLearnerState, exclude_slide_id: str) -> Optional[Dict[str, Any]]:
    """The slide the learner worked on most recently, other than this one
    (for the "last time we worked on …" greeting)."""
    best = None
    for sid, prog in (st.progress_json or {}).items():
        if sid == exclude_slide_id or not isinstance(prog, dict):
            continue
        if best is None or str(prog.get("updated_at") or "") > str(best[1].get("updated_at") or ""):
            best = (sid, prog)
    if best is None:
        return None
    return {"slide_id": best[0], "slide_title": best[1].get("slide_title") or "", "phase": best[1].get("phase")}


def resume_position(db: Session, lesson: LessonPlan, st: TutorLearnerState) -> Optional[Pointer]:
    """Where to resume THIS slide: a concept (remapped if the plan was
    recompiled), a topic summary, or slide-done. None = start fresh."""
    prog = slide_progress(st, lesson.slide_id)
    if not prog:
        return None
    phase = prog.get("phase")
    if phase == sm.SLIDE_DONE:
        return sm.pointer_at_slide_end(lesson)
    if phase == sm.TOPIC_SUMMARY:
        ti = next((i for i, t in enumerate(lesson.topics) if t.id == prog.get("topic_id")), None)
        if ti is None:
            p = resolve_pointer(db, lesson, prog.get("concept_id"))
            ti = p.topic if p is not None else None
        if ti is None:
            return None
        return sm.pointer_at_topic_end(lesson, ti)
    return resolve_pointer(db, lesson, prog.get("concept_id"))


def resolve_pointer(db: Session, lesson: LessonPlan, concept_id: Optional[str]) -> Optional[Pointer]:
    """Where to resume. Concept ids are new on every recompile, so a saved id
    that is not in this plan is remapped through the OLD concept's title and
    position (its row survives: plans are marked DELETED, never dropped)."""
    if not concept_id:
        return None
    p = lesson.find(concept_id)
    if p is not None:
        return p
    old = (db.query(TeachingConcept.title, TeachingConcept.concept_order, TeachingTopic.title, TeachingTopic.topic_order)
           .join(TeachingTopic, TeachingTopic.id == TeachingConcept.topic_id)
           .filter(TeachingConcept.id == concept_id).first())
    if old is None or not lesson.topics:
        return None
    c_title, c_order, t_title, t_order = old
    # 1. Same concept title anywhere in the new plan.
    for t in lesson.topics:
        for c in t.concepts:
            if _norm_title(c.title) == _norm_title(c_title):
                return lesson.find(c.id)
    # 2. Same topic title (or position) → same concept position, clamped.
    ti = next((i for i, t in enumerate(lesson.topics) if _norm_title(t.title) == _norm_title(t_title)), None)
    if ti is None:
        ti = min(max(int(t_order or 1) - 1, 0), len(lesson.topics) - 1)
    topic = lesson.topics[ti]
    if not topic.concepts:
        return None
    ci = min(max(int(c_order or 1) - 1, 0), len(topic.concepts) - 1)
    return lesson.find(topic.concepts[ci].id)


def reload_state(user_id: str, package_session_id: str) -> Optional[Dict[str, Any]]:
    """Fresh learner-state snapshot (after an attempt was recorded) so the
    next decision prompt sees what this session just learned."""
    try:
        with db_session() as db:
            st = (db.query(TutorLearnerState)
                  .filter(TutorLearnerState.user_id == user_id, TutorLearnerState.package_session_id == package_session_id)
                  .first())
            return state_dict(st) if st is not None else None
    except Exception:  # noqa: BLE001
        logger.warning("reload_state failed", exc_info=True)
        return None


def note_start_progress(tutor_session_id: str, slide_id: str, done: int) -> None:
    """Where the learner stood on this slide when the session opened it, so the
    session summary can report what was done TODAY (progress_json is cumulative)."""
    try:
        with db_session() as db:
            ts = db.get(TutorSession, tutor_session_id)
            if ts is None:
                return
            summ = dict(ts.summary_json or {})
            start = dict(summ.get("start_done") or {})
            start.setdefault(slide_id, int(done or 0))
            summ["start_done"] = start
            ts.summary_json = summ
            db.commit()
    except Exception:  # noqa: BLE001
        pass


def summary_context(tutor_session_id: str) -> Optional[Dict[str, Any]]:
    """Arguments for summary.rewrite_rolling_summary when the socket is not
    around to supply them (REST end)."""
    try:
        with db_session() as db:
            ts = db.get(TutorSession, tutor_session_id)
            if ts is None:
                return None
            pkg = package_of_session(db, ts.package_session_id)
            settings = resolve_settings(db, package_id=pkg[0] if pkg else "", institute_id=ts.institute_id)
            try:
                live_model = settings.llm_model or get_platform_setting("tutor.live.model", default=None, db=db) or None
            except Exception:  # noqa: BLE001
                live_model = settings.llm_model or None
            return {"tutor_session_id": ts.id, "user_id": ts.user_id, "institute_id": ts.institute_id,
                    "package_session_id": ts.package_session_id, "model": live_model,
                    "teacher": settings.teacher_name or "Asha",
                    "lang": ts.language if ts.language in ("en", "hi") else settings.course_language,
                    "learner_name": learner_name(db, ts.user_id)}
    except Exception:  # noqa: BLE001
        logger.warning("summary_context failed", exc_info=True)
        return None


def session_owner(tutor_session_id: str) -> Optional[Dict[str, Any]]:
    """Who owns the session and whether it is still ACTIVE — the only thing
    the socket needs before the auth frame arrives."""
    with db_session() as db:
        ts = db.get(TutorSession, tutor_session_id)
        if ts is None:
            return None
        return {"user_id": ts.user_id, "status": ts.status, "package_session_id": ts.package_session_id}


def boot_context(tutor_session_id: str) -> Optional[Dict[str, Any]]:
    """Everything the socket needs to open, read in ONE short session that is
    closed before the first model or TTS await: the handler itself never
    holds a pool connection."""
    with db_session() as db:
        ts = db.get(TutorSession, tutor_session_id)
        if ts is None:
            return None
        pkg = package_of_session(db, ts.package_session_id)
        package_id = pkg[0] if pkg else ""
        settings = resolve_settings(db, package_id=package_id, institute_id=ts.institute_id)
        lesson = load_lesson(db, ts.started_slide_id or "")
        st = get_or_create_state(db, user_id=ts.user_id, package_session_id=ts.package_session_id, institute_id=ts.institute_id)
        state = state_dict(st)
        pointer = resume_position(db, lesson, st) if lesson is not None else None
        previous = previous_slide(st, lesson.slide_id) if lesson is not None else None
        db.commit()
        try:
            tts_provider = settings.tts_provider or str(get_platform_setting("tutor.voice.provider", default="sarvam", db=db) or "sarvam")
            tts_voice = settings.tts_voice or str(get_platform_setting("tutor.voice.voice", default="", db=db) or "")
        except Exception:  # noqa: BLE001
            tts_provider, tts_voice = settings.tts_provider or "sarvam", settings.tts_voice or ""
        # Live decision turns: course/institute "Live model" → platform
        # tutor.live.model → (None =) the chatbot model inside run_turn.
        try:
            live_model = settings.llm_model or get_platform_setting("tutor.live.model", default=None, db=db) or None
        except Exception:  # noqa: BLE001
            live_model = settings.llm_model or None
        return {
            "user_id": ts.user_id, "institute_id": ts.institute_id, "package_session_id": ts.package_session_id,
            "package_id": package_id, "chat_session_id": ts.chat_session_id, "mode": ts.mode,
            "language": ts.language, "started_slide_id": ts.started_slide_id,
            "settings": settings, "lesson": lesson, "state": state, "pointer": pointer,
            "previous_slide": previous,
            "learner_name": learner_name(db, ts.user_id),
            # What the teacher says about last time (model-written summary).
            "resume_line": prompts.resume_line(st.rolling_summary),
            "tts_provider": tts_provider, "tts_voice": tts_voice, "live_model": live_model,
            "max_seconds": session_max_seconds(db),
        }


def record_media_usage(*, kind: str, institute_id: str, user_id: str, session_id: str, language: str,
                       characters: int, detail: Optional[str] = None, provider: str = "sarvam") -> None:
    """Attribute TTS / STT spend to the institute (same row shape as the
    voice call's metering), in its own short session."""
    try:
        with db_session() as db:
            TokenUsageService(db).record_usage(
                api_provider=ApiProvider.GOOGLE_TTS,
                prompt_tokens=0, completion_tokens=0, total_tokens=0,
                request_type=RequestType.TTS_PREMIUM if kind == "tts" else RequestType.TRANSCRIPTION,
                institute_id=institute_id, user_id=user_id,
                model=({"sarvam": "sarvam:bulbul-v3", "google": "google:chirp3-hd", "edge": "edge:neural"}.get(provider, provider)
                       if kind == "tts" else "sarvam:saaras-v3"),
                request_id=session_id,
                tts_provider=provider if kind == "tts" else "sarvam",
                character_count=max(int(characters or 0), 0),
                metadata={"surface": "tutor", "language": language, "detail": detail},
            )
            db.commit()
    except Exception:  # noqa: BLE001
        logger.warning("tutor media usage not recorded for %s", session_id, exc_info=True)


# ── session lifecycle ────────────────────────────────────────────────────────

def start_session(
    *, user_id: str, institute_id: str, package_session_id: str, slide_id: Optional[str], mode: str,
    language: Optional[str],
) -> Dict[str, Any]:
    """Create the tutor session (+ its chat session for the transcript) and
    return everything the socket needs to open: settings, lesson, pointer."""
    with db_session() as db:
        pkg = package_of_session(db, package_session_id)
        if not pkg:
            raise ValueError("Batch not found")
        package_id, package_name = pkg
        settings = resolve_settings(db, package_id=package_id, institute_id=institute_id)
        if not settings.enabled:
            raise PermissionError("Tutor mode is not enabled for this course")
        st = get_or_create_state(db, user_id=user_id, package_session_id=package_session_id, institute_id=institute_id)
        target_slide = slide_id or st.current_slide_id
        if not target_slide:
            raise ValueError("No slide to teach: pass slide_id")
        # The session teaches only what this batch exposes: a slide id from
        # another course (or an unpublished one) is not a plan lookup.
        if not slide_in_package_session(db, target_slide, package_session_id):
            if slide_id:
                raise LookupError("This slide is not part of this batch")
            raise ValueError("No slide to teach: pass slide_id")
        lesson = load_lesson(db, target_slide)
        if lesson is None:
            raise LookupError("This slide has no teaching plan yet")
        lang = language if language in ("en", "hi") else (st.preferred_language if settings.session_language == "learner" and st.preferred_language in ("en", "hi") else settings.course_language)
        pointer = resume_position(db, lesson, st)
        resumed = pointer is not None
        if pointer is None:
            pointer = Pointer()
        chat = ChatSessionRepository(db).create_session(
            user_id=user_id, institute_id=institute_id, context_type="tutor",
            context_meta={"package_session_id": package_session_id, "package_id": package_id, "slide_id": target_slide,
                          "mode": mode, "language": lang},
            session_mode="tutor_voice" if mode == "VOICE" else "tutor_text",
        )
        ts = TutorSession(
            id=str(uuid4()), user_id=user_id, institute_id=institute_id, package_session_id=package_session_id,
            chat_session_id=chat.id, mode=mode, tts_provider=settings.tts_provider, tts_voice=settings.tts_voice,
            language=lang, started_slide_id=target_slide, status="ACTIVE", summary_json={"turns": 0},
        )
        db.add(ts)
        st.current_slide_id = target_slide
        st.updated_at = datetime.utcnow()
        db.commit()
        name = learner_name(db, user_id)
        return {
            "tutor_session_id": ts.id, "chat_session_id": chat.id, "package_id": package_id,
            "package_name": package_name, "settings": settings, "lesson": lesson, "pointer": pointer,
            "resumed": resumed, "language": lang, "learner_name": name, "state": state_dict(st),
        }


def switch_slide(*, tutor_session_id: str, user_id: str, package_session_id: str, slide_id: str) -> Tuple[LessonPlan, Pointer, bool]:
    with db_session() as db:
        if not slide_in_package_session(db, slide_id, package_session_id):
            raise LookupError("This slide is not part of this batch")
        lesson = load_lesson(db, slide_id)
        if lesson is None:
            raise LookupError("This slide has no teaching plan yet")
        st = db.query(TutorLearnerState).filter(TutorLearnerState.user_id == user_id,
                                                TutorLearnerState.package_session_id == package_session_id).first()
        pointer = resume_position(db, lesson, st) if st else None
        resumed = pointer is not None
        if pointer is None:
            pointer = Pointer()
        if st:
            st.current_slide_id = slide_id
            st.updated_at = datetime.utcnow()
        db.execute(text("UPDATE chat_sessions SET context_meta = context_meta || CAST(:m AS jsonb) WHERE id = "
                        "(SELECT chat_session_id FROM tutor_session WHERE id = :t)"),
                   {"m": json.dumps({"slide_id": slide_id}), "t": tutor_session_id})
        db.commit()
        return lesson, pointer, resumed


def save_pointer(*, user_id: str, package_session_id: str, lesson: LessonPlan, pointer: Pointer, language: Optional[str], pace: Optional[str]) -> None:
    try:
        with db_session() as db:
            st = db.query(TutorLearnerState).filter(TutorLearnerState.user_id == user_id,
                                                    TutorLearnerState.package_session_id == package_session_id).first()
            if st is None:
                return
            concept = lesson.concept_at(pointer)
            topic = lesson.topic_at(pointer)
            # At a topic summary / slide end there is no current concept: keep
            # the last taught one so a legacy reader still lands nearby, and
            # persist the phase so the next session resumes exactly there.
            if concept is None and topic is not None and topic.concepts:
                concept = topic.concepts[-1]
            if concept is None and pointer.phase == sm.SLIDE_DONE and lesson.topics and lesson.topics[-1].concepts:
                topic = lesson.topics[-1]
                concept = topic.concepts[-1]
            st.current_slide_id = lesson.slide_id
            st.current_topic_id = topic.id if topic else None
            st.current_concept_id = concept.id if concept else None
            st.current_phase = pointer.phase
            prog = dict(st.progress_json or {})
            prog[lesson.slide_id] = {
                "topic_id": topic.id if topic else None, "concept_id": concept.id if concept else None,
                "phase": pointer.phase, "done": int(pointer.done), "total": int(lesson.total_concepts),
                "slide_title": lesson.slide_title, "updated_at": datetime.utcnow().isoformat(),
            }
            st.progress_json = prog
            if language in ("en", "hi"):
                st.preferred_language = language
            if pace:
                st.pace = pace
            weak = set(st.weak_concepts_json or [])
            weak.update(pointer.weak)
            st.weak_concepts_json = sorted(weak)
            st.updated_at = datetime.utcnow()
            db.commit()
    except Exception:  # noqa: BLE001
        logger.warning("save_pointer failed", exc_info=True)


def clear_weak(*, user_id: str, package_session_id: str, concept_id: str) -> None:
    """A revisit was answered correctly: the concept leaves the weak list."""
    try:
        with db_session() as db:
            st = db.query(TutorLearnerState).filter(TutorLearnerState.user_id == user_id,
                                                    TutorLearnerState.package_session_id == package_session_id).first()
            if st is None:
                return
            st.weak_concepts_json = [c for c in (st.weak_concepts_json or []) if c != concept_id]
            st.updated_at = datetime.utcnow()
            db.commit()
    except Exception:  # noqa: BLE001
        logger.warning("clear_weak failed", exc_info=True)


def write_rolling_summary(*, user_id: str, package_session_id: str, text_: str) -> None:
    try:
        with db_session() as db:
            st = db.query(TutorLearnerState).filter(TutorLearnerState.user_id == user_id,
                                                    TutorLearnerState.package_session_id == package_session_id).first()
            if st is None:
                return
            st.rolling_summary = (text_ or "")[:1500] or None
            st.updated_at = datetime.utcnow()
            db.commit()
    except Exception:  # noqa: BLE001
        logger.warning("write_rolling_summary failed", exc_info=True)


def session_digest(tutor_session_id: str) -> Optional[Dict[str, Any]]:
    """What happened in one session, for the summary rewrite: the slides
    touched, every answer with its concept title, what is still weak, the
    previous notes."""
    try:
        with db_session() as db:
            ts = db.get(TutorSession, tutor_session_id)
            if ts is None:
                return None
            attempts = (db.query(TutorConceptAttempt).filter(TutorConceptAttempt.tutor_session_id == tutor_session_id)
                        .order_by(TutorConceptAttempt.created_at).all())
            st = db.query(TutorLearnerState).filter(TutorLearnerState.user_id == ts.user_id,
                                                    TutorLearnerState.package_session_id == ts.package_session_id).first()
            weak_ids = list((st.weak_concepts_json or []) if st else [])
            ids = {a.concept_id for a in attempts} | set(weak_ids)
            titles: Dict[str, str] = {}
            if ids:
                for cid, title in db.query(TeachingConcept.id, TeachingConcept.title).filter(TeachingConcept.id.in_(list(ids))).all():
                    titles[cid] = title
            started = ts.started_at.isoformat() if ts.started_at else ""
            slides = []
            for sid, prog in ((st.progress_json or {}) if st else {}).items():
                if isinstance(prog, dict) and (sid == ts.started_slide_id or str(prog.get("updated_at") or "") >= started):
                    slides.append({"slide_id": sid, "title": prog.get("slide_title") or "", "done": prog.get("done") or 0,
                                   "total": prog.get("total") or 0, "phase": prog.get("phase")})
            ended = ts.ended_at or datetime.utcnow()
            summ = dict(ts.summary_json or {})
            start_done = summ.get("start_done") or {}
            for s in slides:
                s["done_today"] = max(0, int(s["done"] or 0) - int(start_done.get(s["slide_id"]) or 0))
            return {
                "turns": int(summ.get("turns") or 0), "concepts_taught": int(summ.get("concepts_taught") or 0),
                "date": ts.started_at.date().isoformat() if ts.started_at else "",
                "duration_minutes": int(max(0.0, (ended - ts.started_at).total_seconds()) // 60) if ts.started_at else 0,
                "slides": slides,
                "attempts": [{"concept": titles.get(a.concept_id, a.concept_id), "score": float(a.score) if a.score is not None else None,
                              "action": a.action_taken, "misconception": a.misconception,
                              "answer": (a.student_answer or "")[:120]} for a in attempts],
                "weak_titles": [titles[c] for c in weak_ids if c in titles],
                "previous_summary": st.rolling_summary if st else None,
                "pace": st.pace if st else None,
            }
    except Exception:  # noqa: BLE001
        logger.warning("session_digest failed", exc_info=True)
        return None


def record_attempt(
    *, tutor_session_id: str, user_id: str, package_session_id: str, concept_id: str, tags: List[str],
    attempt_no: int, answer: str, score: Optional[float], misconception: Optional[str], action: str,
    session_ops: Optional[List[Dict[str, Any]]], note: Optional[str],
) -> None:
    try:
        with db_session() as db:
            db.add(TutorConceptAttempt(
                id=str(uuid4()), tutor_session_id=tutor_session_id, user_id=user_id, concept_id=concept_id,
                attempt_no=attempt_no, student_answer=(answer or "")[:4000], score=score,
                misconception=(misconception or None), action_taken=action, session_ops_json=session_ops or None,
            ))
            st = db.query(TutorLearnerState).filter(TutorLearnerState.user_id == user_id,
                                                    TutorLearnerState.package_session_id == package_session_id).first()
            if st is not None and score is not None:
                mastery = dict(st.mastery_json or {})
                for tag in tags or [concept_id]:
                    prev = mastery.get(tag) or {"score": 0.0, "attempts": 0}
                    ema = 0.6 * float(score) + 0.4 * float(prev.get("score") or 0.0) if prev.get("attempts") else float(score)
                    mastery[tag] = {"score": round(ema, 3), "attempts": int(prev.get("attempts") or 0) + 1,
                                    "last_at": datetime.utcnow().isoformat()}
                st.mastery_json = mastery
                if misconception or note:
                    mis = list(st.misconceptions_json or [])
                    mis.append({"tag": (tags or [concept_id])[0], "note": misconception or note,
                                "seen_at": datetime.utcnow().isoformat()})
                    st.misconceptions_json = mis[-30:]
                st.updated_at = datetime.utcnow()
            ts = db.get(TutorSession, tutor_session_id)
            if ts is not None:
                summ = dict(ts.summary_json or {})
                summ["attempts"] = int(summ.get("attempts") or 0) + 1
                ts.summary_json = summ
            db.commit()
    except Exception:  # noqa: BLE001
        logger.warning("record_attempt failed", exc_info=True)


def append_transcript(chat_session_id: Optional[str], role: str, text_: str, meta: Optional[Dict[str, Any]] = None) -> None:
    if not chat_session_id or not text_:
        return
    try:
        with db_session() as db:
            ChatMessageRepository(db).create_message(
                session_id=chat_session_id, message_type="user" if role == "user" else "assistant",
                content=text_[:8000], metadata=meta or {},
            )
            db.commit()
    except Exception:  # noqa: BLE001
        logger.warning("append_transcript failed", exc_info=True)


def bump_telemetry(tutor_session_id: str, **counters: int) -> None:
    try:
        with db_session() as db:
            ts = db.get(TutorSession, tutor_session_id)
            if ts is None:
                return
            summ = dict(ts.summary_json or {})
            for k, v in counters.items():
                summ[k] = int(summ.get(k) or 0) + int(v)
            ts.summary_json = summ
            db.commit()
    except Exception:  # noqa: BLE001
        pass


def end_session(*, tutor_session_id: str, user_id: str, package_session_id: str, lesson: Optional[LessonPlan],
                pointer: Optional[Pointer], status: str = "ENDED") -> Dict[str, Any]:
    """Close the session, stamp minutes, write a short rolling summary from the
    attempts (no model call: cheap and deterministic)."""
    out: Dict[str, Any] = {}
    try:
        with db_session() as db:
            # Exactly one caller closes a session (the socket's finally and the
            # REST fallback can race): the row flips ACTIVE → status atomically.
            flipped = db.execute(text("""
                UPDATE tutor_session SET status = :s, ended_at = CURRENT_TIMESTAMP
                WHERE id = :id AND status = 'ACTIVE' RETURNING id
            """), {"s": status, "id": tutor_session_id}).first()
            if flipped is None:
                db.commit()
                return {"tutor_session_id": tutor_session_id, "transitioned": False}
            ts = db.get(TutorSession, tutor_session_id)
            if ts is None:
                return out
            db.refresh(ts)
            secs = max(0.0, ((ts.ended_at or datetime.utcnow()) - ts.started_at).total_seconds())
            ts.minutes_billed = int(math.ceil(secs / 60.0))
            summ = dict(ts.summary_json or {})
            summ["duration_seconds"] = int(secs)
            attempts = db.query(TutorConceptAttempt).filter(TutorConceptAttempt.tutor_session_id == tutor_session_id).all()
            scored = [float(a.score) for a in attempts if a.score is not None]
            summ["avg_score"] = round(sum(scored) / len(scored), 3) if scored else None
            ts.summary_json = summ
            st = db.query(TutorLearnerState).filter(TutorLearnerState.user_id == user_id,
                                                    TutorLearnerState.package_session_id == package_session_id).first()
            if st is not None:
                weak = [a.concept_id for a in attempts if a.action_taken in ("advance_weak", "revisit_weak")]
                cleared = {a.concept_id for a in attempts if a.action_taken == "revisit_ok"}
                line = (f"Session on {ts.started_at.date().isoformat()}: {len(attempts)} answer(s), "
                        f"average score {summ['avg_score'] if summ['avg_score'] is not None else 'n/a'}; "
                        + (f"{len(set(weak) - cleared)} concept(s) flagged for review. " if set(weak) - cleared else "no weak spots flagged. ")
                        + (f"{len(cleared)} cleared on revisit. " if cleared else ""))
                prev = (st.rolling_summary or "").strip()
                # A model-written summary keeps its spoken line first; the
                # background rewrite (summary.py) replaces the whole thing.
                st.rolling_summary = ((prev + " " + line) if prompts.resume_line(prev) else (line + " " + prev))[:1500]
                st.updated_at = datetime.utcnow()
            if ts.chat_session_id:
                ChatSessionRepository(db).close_session(ts.chat_session_id)
            db.commit()
            out = {"tutor_session_id": tutor_session_id, "minutes": ts.minutes_billed, "summary": summ, "transitioned": True}
    except Exception:  # noqa: BLE001
        logger.warning("end_session failed", exc_info=True)
    return out
