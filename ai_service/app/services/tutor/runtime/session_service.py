"""Tutor sessions: start/resume, learner state, attempts, transcript, end.

All DB work for the socket lives here so the socket handler stays a protocol
loop. Every method opens its own short session (the socket must never pin a
pool connection across a model or TTS await).
"""
from __future__ import annotations

import json
import logging
import math
from dataclasses import asdict
from datetime import datetime
from typing import Any, Dict, List, Optional, Tuple
from uuid import uuid4

from sqlalchemy import text
from sqlalchemy.orm import Session

from ....db import db_session
from ....models.tutor_runtime import TutorConceptAttempt, TutorLearnerState, TutorSession
from ....repositories.chat_message_repository import ChatMessageRepository
from ....repositories.chat_session_repository import ChatSessionRepository
from .. import plan_store
from ..slide_source import list_package_slides
from .settings import TutorSettings, resolve_settings
from .state import LessonPlan, Pointer, from_plan_view

logger = logging.getLogger(__name__)

SUPPORTED = {"DOCUMENT", "QUIZ", "VIDEO", "HTML_VIDEO"}


# ── enrolment / lookups ──────────────────────────────────────────────────────

def learner_is_enrolled(db: Session, *, user_id: str, package_session_id: str, institute_id: str) -> bool:
    row = db.execute(text("""
        SELECT 1 FROM student_session_institute_group_mapping
        WHERE user_id = :u AND package_session_id = :ps AND institute_id = :i
          AND status IN ('ACTIVE', 'PENDING_FOR_APPROVAL', 'INVITED')
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


def chapter_slides(db: Session, *, package_session_id: str, chapter_id: str) -> List[Dict[str, Any]]:
    """Ordered slides of one chapter in one batch with their plan status."""
    rows = db.execute(text("""
        SELECT sl.id, sl.title, sl.source_type, cts.slide_order
        FROM chapter_package_session_mapping cpsm
        JOIN chapter_to_slides cts ON cts.chapter_id = cpsm.chapter_id AND cts.status <> 'DELETED'
        JOIN slide sl ON sl.id = cts.slide_id AND sl.status = 'PUBLISHED'
        WHERE cpsm.package_session_id = :ps AND cpsm.chapter_id = :c AND cpsm.status = 'ACTIVE'
        ORDER BY cts.slide_order NULLS LAST, sl.title
    """), {"ps": package_session_id, "c": chapter_id}).fetchall()
    ids = [r[0] for r in rows]
    ready = plan_store.latest_plans_for_slides(db, ids, ready_only=True)
    return [
        {"slide_id": r[0], "title": r[1], "source_type": (r[2] or "").upper(), "order": r[3],
         "teachable": (r[2] or "").upper() in SUPPORTED and r[0] in ready,
         "plan_id": ready[r[0]].id if r[0] in ready else None}
        for r in rows
    ]


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
    return {
        "resume_slide_id": resume["slide_id"] if resume else None,
        "resume_chapter_id": resume["chapter_id"] if resume else None,
        "first_slide_id": first["slide_id"] if first else None,
        "first_chapter_id": first["chapter_id"] if first else None,
        "enabled": bool(s.enabled),
        "default_on": bool(s.default_on),
        "teacher_name": s.teacher_name,
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
        "current_concept_id": st.current_concept_id, "mastery_json": dict(st.mastery_json or {}),
        "misconceptions_json": list(st.misconceptions_json or []), "weak_concepts_json": list(st.weak_concepts_json or []),
        "rolling_summary": st.rolling_summary, "preferred_language": st.preferred_language, "pace": st.pace,
    }


def load_lesson(db: Session, slide_id: str) -> Optional[LessonPlan]:
    plan = plan_store.latest_ready_plan(db, slide_id)
    if plan is None:
        return None
    return from_plan_view(plan_store.plan_view(db, plan))


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
        lesson = load_lesson(db, target_slide)
        if lesson is None:
            raise LookupError("This slide has no teaching plan yet")
        lang = language if language in ("en", "hi") else (st.preferred_language if settings.session_language == "learner" and st.preferred_language in ("en", "hi") else settings.course_language)
        resumed = st.current_slide_id == target_slide and st.current_concept_id is not None
        pointer = lesson.find(st.current_concept_id) if resumed else None
        if pointer is None:
            pointer = Pointer()
            resumed = False
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
        lesson = load_lesson(db, slide_id)
        if lesson is None:
            raise LookupError("This slide has no teaching plan yet")
        st = db.query(TutorLearnerState).filter(TutorLearnerState.user_id == user_id,
                                                TutorLearnerState.package_session_id == package_session_id).first()
        resumed = bool(st and st.current_slide_id == slide_id and st.current_concept_id)
        pointer = lesson.find(st.current_concept_id) if resumed and st else None
        if pointer is None:
            pointer, resumed = Pointer(), False
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
            st.current_slide_id = lesson.slide_id
            st.current_topic_id = topic.id if topic else None
            st.current_concept_id = concept.id if concept else None
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
            ts = db.get(TutorSession, tutor_session_id)
            if ts is None:
                return out
            ts.ended_at = datetime.utcnow()
            ts.status = status
            secs = max(0.0, (ts.ended_at - ts.started_at).total_seconds())
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
                weak = [a.concept_id for a in attempts if a.action_taken == "advance_weak"]
                line = (f"Session on {ts.started_at.date().isoformat()}: {len(attempts)} answer(s), "
                        f"average score {summ['avg_score'] if summ['avg_score'] is not None else 'n/a'}; "
                        + (f"{len(set(weak))} concept(s) flagged for review. " if weak else "no weak spots flagged. "))
                prev = (st.rolling_summary or "").strip()
                st.rolling_summary = (line + " " + prev)[:1500]
                st.updated_at = datetime.utcnow()
            if ts.chat_session_id:
                ChatSessionRepository(db).close_session(ts.chat_session_id)
            db.commit()
            out = {"tutor_session_id": tutor_session_id, "minutes": ts.minutes_billed, "summary": summ}
    except Exception:  # noqa: BLE001
        logger.warning("end_session failed", exc_info=True)
    return out
