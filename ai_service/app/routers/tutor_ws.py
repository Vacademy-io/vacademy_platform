"""Live AI Tutor — learner runtime: REST to start/end a session, WebSocket to
teach (design §6). Builds on the voice-call socket's audio pipeline by import.

Protocol (client → server): auth{token} FIRST, then config{language?},
continue, answer{text}, ask{text}, control{intent}, next_slide{slide_id},
audio_chunk{data}, audio_end{mime}, audio_discard, interrupt, end_session, ping.
Server → client: ready, state, board{ops, clear}, ai_text, audio_chunk,
audio_segment_end, audio_end{reason}, check{...}, transcript_final, slide_done,
summary, error, pong.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import time
from collections import OrderedDict
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..core.security import decode_access_token, get_pinned_principal
from ..db import db_dependency, db_session, get_sessionmaker
from ..models.tutor_runtime import TutorSession
from ..services.platform_settings_service import get_platform_setting
from ..services.sarvam_service import SarvamService, SarvamSTTError
from ..services.tutor.runtime import session_service as svc
from ..services.tutor.runtime import state as sm
from ..services.tutor.runtime.decision import run_turn
from ..services.tutor.runtime.intents import detect_intent
from ..services.tutor.runtime import prompts
from ..services.tutor.runtime.settings import TutorSettings
from ..services.tutor.slide_source import package_belongs_to_institute
from ..services.voice_tts import default_voice_for, synthesize_speech
from .voice_agent import (
    MIN_SPEECH_WAV_BYTES, TTS_CHUNK_SIZE, _build_voice_session_service, _split_for_speech, _transcode_to_wav,
)

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tutor", tags=["tutor-runtime"])

STAFF_ROLES = {"ADMIN", "TEACHER", "SUPER_ADMIN", "COURSE_CREATOR"}
SESSION_MAX_SECONDS = 90 * 60
IDLE_SECONDS = 5 * 60
LANG_TO_STT = {"en": "en-IN", "hi": "hi-IN"}

# ── in-process TTS cache (compiled narration repeats across learners) ────────
_TTS_CACHE: "OrderedDict[str, bytes]" = OrderedDict()
_TTS_CACHE_MAX = 300


def _cache_key(provider: str, voice: str, lang: str, text_: str) -> str:
    return hashlib.sha256(f"{provider}|{voice}|{lang}|{text_}".encode("utf-8")).hexdigest()


def _cache_get(k: str) -> Optional[bytes]:
    v = _TTS_CACHE.get(k)
    if v is not None:
        _TTS_CACHE.move_to_end(k)
    return v


def _cache_put(k: str, v: bytes) -> None:
    _TTS_CACHE[k] = v
    _TTS_CACHE.move_to_end(k)
    while len(_TTS_CACHE) > _TTS_CACHE_MAX:
        _TTS_CACHE.popitem(last=False)


# ── REST ─────────────────────────────────────────────────────────────────────

class Caller:
    def __init__(self, institute_id: str, user_id: str, roles: List[str], is_root: bool):
        self.institute_id, self.user_id, self.roles, self.is_root = institute_id, user_id, roles, is_root

    @property
    def is_staff(self) -> bool:
        return self.is_root or bool(set(self.roles) & STAFF_ROLES)


async def _caller(request: Request, authorization: Optional[str] = Header(default=None),
                  settings: Settings = Depends(get_settings)) -> Caller:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization: Bearer <jwt> (with a clientId header)")
    p = await get_pinned_principal(request, authorization, settings)
    return Caller(p.institute_id, p.user_id, [str(r).upper() for r in (p.roles or [])], bool(p.is_root_user))


class StartSessionRequest(BaseModel):
    package_session_id: str = Field(..., min_length=1, max_length=255)
    slide_id: Optional[str] = Field(default=None, max_length=255)
    mode: str = Field(default="TEXT", pattern=r"^(TEXT|VOICE)$")
    language: Optional[str] = Field(default=None, pattern=r"^(en|hi)$")


@router.get("/v1/learner/packages/{package_id}/availability", summary="Is tutor mode available on this course?")
def learner_availability(
    package_id: str,
    package_session_id: Optional[str] = Query(default=None),
    caller: Caller = Depends(_caller),
    db: Session = Depends(db_dependency),
) -> Dict[str, Any]:
    if not package_belongs_to_institute(db, package_id, caller.institute_id):
        raise HTTPException(status_code=404, detail="Course not found in this institute")
    return svc.availability(db, package_id=package_id, package_session_id=package_session_id, institute_id=caller.institute_id)


@router.get("/v1/learner/chapters/{chapter_id}/slides", summary="Ordered slides of a chapter with tutor readiness")
def learner_chapter_slides(
    chapter_id: str,
    package_session_id: str = Query(...),
    caller: Caller = Depends(_caller),
    db: Session = Depends(db_dependency),
) -> Dict[str, Any]:
    if not caller.is_staff and not svc.learner_is_enrolled(db, user_id=caller.user_id, package_session_id=package_session_id, institute_id=caller.institute_id):
        raise HTTPException(status_code=403, detail="Not enrolled in this batch")
    return {"chapter_id": chapter_id, "slides": svc.chapter_slides(db, package_session_id=package_session_id, chapter_id=chapter_id)}


@router.post("/v1/sessions", summary="Start (or resume) a tutor session")
def start_session(
    payload: StartSessionRequest,
    caller: Caller = Depends(_caller),
    db: Session = Depends(db_dependency),
) -> Dict[str, Any]:
    if not caller.is_staff and not svc.learner_is_enrolled(db, user_id=caller.user_id, package_session_id=payload.package_session_id, institute_id=caller.institute_id):
        raise HTTPException(status_code=403, detail="Not enrolled in this batch")
    try:
        boot = svc.start_session(user_id=caller.user_id, institute_id=caller.institute_id,
                                 package_session_id=payload.package_session_id, slide_id=payload.slide_id,
                                 mode=payload.mode, language=payload.language)
    except PermissionError as e:
        raise HTTPException(status_code=403, detail=str(e))
    except LookupError as e:
        raise HTTPException(status_code=409, detail=str(e))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    lesson: sm.LessonPlan = boot["lesson"]
    settings: TutorSettings = boot["settings"]
    return {
        "tutor_session_id": boot["tutor_session_id"],
        "slide_id": lesson.slide_id,
        "language": boot["language"],
        "resumed": boot["resumed"],
        "teacher_name": settings.teacher_name,
        "learner_name": boot["learner_name"],
        "topics": [{"id": t.id, "title": t.title, "concepts": len(t.concepts)} for t in lesson.topics],
        "progress": boot["pointer"].progress(lesson),
        "socket_path": f"/tutor/ws/{boot['tutor_session_id']}",
    }


@router.post("/v1/sessions/{tutor_session_id}/end", summary="End a tutor session (fallback for closed sockets)")
def end_session_rest(tutor_session_id: str, caller: Caller = Depends(_caller), db: Session = Depends(db_dependency)) -> Dict[str, Any]:
    ts = db.get(TutorSession, tutor_session_id)
    if ts is None or ts.user_id != caller.user_id:
        raise HTTPException(status_code=404, detail="Session not found")
    if ts.status != "ACTIVE":
        return {"tutor_session_id": tutor_session_id, "status": ts.status}
    return svc.end_session(tutor_session_id=tutor_session_id, user_id=ts.user_id, package_session_id=ts.package_session_id,
                           lesson=None, pointer=None, status="ENDED")


# ── WebSocket ────────────────────────────────────────────────────────────────

@router.websocket("/ws/{tutor_session_id}")
async def tutor_socket(websocket: WebSocket, tutor_session_id: str) -> None:
    await websocket.accept()
    session_factory = get_sessionmaker()
    db = session_factory()
    send_lock = asyncio.Lock()
    current_task: Optional[asyncio.Task] = None
    audio_buffer = bytearray()
    started_at = time.time()
    last_activity = time.time()

    async def _send(payload: dict) -> None:
        async with send_lock:
            await websocket.send_json(payload)

    try:
        ts = db.get(TutorSession, tutor_session_id)
        if ts is None or ts.status != "ACTIVE":
            await _send({"type": "error", "message": "Tutor session not found or already ended"})
            await websocket.close(code=4004)
            return
        user_id, institute_id, package_session_id = ts.user_id, ts.institute_id, ts.package_session_id
        chat_session_id = ts.chat_session_id
        mode = "voice" if ts.mode == "VOICE" else "text"

        # ── 1. auth FIRST, always ──
        raw = await asyncio.wait_for(websocket.receive_text(), timeout=20)
        try:
            first = json.loads(raw)
        except json.JSONDecodeError:
            first = {}
        claims = decode_access_token(str(first.get("token") or "")) if first.get("type") == "auth" else None
        if not claims or str(claims.get("user") or "") != str(user_id):
            await _send({"type": "error", "message": "Authentication required"})
            await websocket.close(code=4401)
            return

        # ── 2. load lesson, settings, learner state ──
        pkg = svc.package_of_session(db, package_session_id)
        package_id = pkg[0] if pkg else ""
        from ..services.tutor.runtime.settings import resolve_settings
        settings = resolve_settings(db, package_id=package_id, institute_id=institute_id)
        lesson = svc.load_lesson(db, ts.started_slide_id or "")
        if lesson is None:
            await _send({"type": "error", "message": "This slide has no teaching plan"})
            await websocket.close(code=4009)
            return
        st = svc.get_or_create_state(db, user_id=user_id, package_session_id=package_session_id, institute_id=institute_id)
        state = svc.state_dict(st)
        db.commit()
        lang = ts.language if ts.language in ("en", "hi") else settings.course_language
        learner = svc.learner_name(db, user_id)
        pointer = lesson.find(st.current_concept_id) if st.current_slide_id == lesson.slide_id else None
        resumed = pointer is not None
        pointer = pointer or sm.Pointer()
        voice_service = _build_voice_session_service(db)
        sarvam = SarvamService()
        tts_provider = settings.tts_provider or str(get_platform_setting("tutor.voice.provider", default="sarvam", db=db) or "sarvam")
        if tts_provider not in ("sarvam", "google", "edge"):
            tts_provider = "sarvam"    # Smallest lands in the browser path in WP7
        tts_voice = settings.tts_voice or str(get_platform_setting("tutor.voice.voice", default="", db=db) or "")
        pace = st.pace or "normal"
        board: List[Dict[str, Any]] = []          # cumulative ops of the current topic
        transcript: List[Dict[str, str]] = []
        speak_enabled = mode == "voice"
        teacher = settings.teacher_name or "Asha"
        display_name = learner or ""

        def _lang_stt() -> str:
            return LANG_TO_STT.get(lang, "en-IN")

        def _personalize(text_: str) -> str:
            return text_.replace("{student_name}", display_name or ("there" if lang == "en" else "दोस्त"))

        async def _speak(text_: str) -> None:
            if not speak_enabled or not text_.strip():
                return
            voice = tts_voice or default_voice_for(tts_provider, _lang_stt()) if tts_provider != "sarvam" else (tts_voice or "anushka")
            for segment in _split_for_speech(text_):
                key = _cache_key(tts_provider, voice, _lang_stt(), segment)
                audio = _cache_get(key)
                provider_used = tts_provider
                if audio is None:
                    audio, _mime, provider_used = await synthesize_speech(text=segment, language=_lang_stt(), voice=voice, provider=tts_provider)
                    if audio:
                        _cache_put(key, audio)
                    voice_service.record_voice_media_usage(kind="tts", institute_id=institute_id, user_id=user_id,
                                                           session_id=tutor_session_id, language=_lang_stt(),
                                                           characters=len(segment), detail=f"tutor:{voice}", provider=provider_used)
                    svc.bump_telemetry(tutor_session_id, tts_chars=len(segment))
                else:
                    svc.bump_telemetry(tutor_session_id, tts_cache_hits=1)
                if not audio:
                    continue
                for i in range(0, len(audio), TTS_CHUNK_SIZE):
                    await _send({"type": "audio_chunk", "data": base64.b64encode(audio[i:i + TTS_CHUNK_SIZE]).decode("ascii")})
                await _send({"type": "audio_segment_end"})

        async def _say(text_: str, *, reason: str = "complete", meta: Optional[dict] = None) -> None:
            text_ = _personalize(text_)
            transcript.append({"role": "teacher", "text": text_})
            svc.append_transcript(chat_session_id, "assistant", text_, meta)
            await _send({"type": "ai_text", "text": text_})
            await _speak(text_)
            await _send({"type": "audio_end", "reason": reason})

        async def _emit_state(phase: str) -> None:
            c = lesson.concept_at(pointer)
            t = lesson.topic_at(pointer)
            await _send({"type": "state", "slide_id": lesson.slide_id, "topic_id": t.id if t else None,
                         "topic_title": t.title if t else None, "concept_id": c.id if c else None,
                         "concept_title": c.title if c else None, "phase": phase, "progress": pointer.progress(lesson),
                         "language": lang, "remediations": pointer.remediations})

        async def _apply_step(step: sm.Step, *, greeting: Optional[str] = None) -> None:
            nonlocal pointer, board
            pointer = step.pointer
            if step.kind in ("teach", "media_task"):
                if step.clear_board:
                    board = []
                    await _send({"type": "board", "clear": True, "ops": [], "topic_id": step.topic.id if step.topic else None})
                board = board + list(step.board_ops)
                await _emit_state(step.pointer.phase)
                await _send({"type": "board", "clear": False, "ops": step.board_ops, "topic_id": step.topic.id if step.topic else None,
                             "concept_id": step.concept.id if step.concept else None})
                text_ = (greeting + " " if greeting else "") + step.concept.narration(lang)
                if step.kind == "media_task":
                    kind = next((op.get("kind") for op in step.board_ops if op.get("op") == "media_task"), "video")
                    text_ = (greeting + " " if greeting else "") + prompts.tpl("media_task_video" if kind == "video" else "media_task_pdf", lang)
                await _say(text_, meta={"concept_id": step.concept.id if step.concept else None, "kind": step.kind})
                svc.save_pointer(user_id=user_id, package_session_id=package_session_id, lesson=lesson, pointer=pointer, language=lang, pace=pace)
                if step.kind == "teach" and step.concept and not step.concept.has_check:
                    # nothing to ask: the client sends `continue` when the audio ends
                    await _send({"type": "await", "what": "continue"})
                elif step.kind == "media_task":
                    await _send({"type": "await", "what": "done"})
            elif step.kind == "ask":
                await _emit_state(step.pointer.phase)
                c = step.concept
                chk = (c.check or {}) if c else {}
                await _send({"type": "check", "concept_id": c.id if c else None, "check_type": chk.get("type"),
                             "prompt": chk.get("prompt"), "options": chk.get("options") or [],
                             "remediation": step.pointer.remediations})
                await _say(prompts.tpl("ask", lang, prompt=chk.get("prompt") or ""), meta={"concept_id": c.id if c else None, "kind": "ask"})
            elif step.kind == "topic_summary":
                await _emit_state(step.pointer.phase)
                if step.board_ops:
                    board = board + list(step.board_ops)
                    await _send({"type": "board", "clear": False, "ops": step.board_ops, "topic_id": step.topic.id if step.topic else None})
                await _say(prompts.tpl("topic_summary", lang, topic=step.topic.title if step.topic else ""), meta={"kind": "topic_summary"})
                await _send({"type": "await", "what": "continue"})
            elif step.kind == "slide_done":
                await _emit_state(step.pointer.phase)
                weak = prompts.tpl("weak_note", lang, n=len(pointer.weak)) if pointer.weak else ""
                await _say(prompts.tpl("slide_done", lang, slide=lesson.topics[0].title if lesson.topics else "", name=display_name, weak=weak), meta={"kind": "slide_done"})
                svc.save_pointer(user_id=user_id, package_session_id=package_session_id, lesson=lesson, pointer=pointer, language=lang, pace=pace)
                await _send({"type": "slide_done", "slide_id": lesson.slide_id, "weak_concepts": list(pointer.weak),
                             "skipped_concepts": list(pointer.skipped), "done": pointer.done, "total": lesson.total_concepts})

        async def _open() -> None:
            slide_title = lesson.topics[0].title if lesson.topics else ""
            if resumed:
                greet = prompts.tpl("resume", lang, name=display_name, slide=slide_title, summary=(state.get("rolling_summary") or "").split(". ")[0][:160])
            else:
                greet = prompts.tpl("greet", lang, name=display_name, teacher=teacher, slide=slide_title)
            await _apply_step(sm.enter(lesson, pointer), greeting=greet)

        async def _handle_doubt(text_: str) -> None:
            await _handle_learner_text(text_, spoken=False, force_doubt=True)

        async def _handle_learner_text(text_: str, *, spoken: bool, force_doubt: bool = False) -> None:
            """Route a learner utterance: intent → answer → doubt."""
            nonlocal pointer, pace, lang
            text_ = (text_ or "").strip()
            if not text_:
                await _send({"type": "audio_end", "reason": "no_speech"})
                return
            transcript.append({"role": "learner", "text": text_})
            svc.append_transcript(chat_session_id, "user", text_, {"spoken": spoken})
            intent = None if force_doubt else detect_intent(text_)
            phase = pointer.phase
            if intent == "repeat":
                await _apply_step(sm.repeat(lesson, pointer)); return
            if intent == "skip":
                await _say(prompts.tpl("skipped", lang), meta={"kind": "skip"})
                await _apply_step(sm.skip(lesson, pointer)); return
            if intent in ("slower", "faster"):
                pace = "slow" if intent == "slower" else "fast"
                await _say(prompts.tpl(intent, lang), meta={"kind": intent})
                svc.save_pointer(user_id=user_id, package_session_id=package_session_id, lesson=lesson, pointer=pointer, language=lang, pace=pace)
                await _send({"type": "await", "what": "continue" if phase in (sm.TEACH, sm.TOPIC_SUMMARY) else "answer"}); return
            if intent == "done" and phase == sm.MEDIA_TASK:
                await _apply_step(sm.after_teach(lesson, pointer)); return
            if intent in ("pause", "resume"):
                await _send({"type": "await", "what": "answer" if phase in (sm.AWAIT_ANSWER, sm.REMEDIATE) else "continue"}); return
            if intent == "resume" or (intent is None and phase in (sm.TEACH, sm.TOPIC_SUMMARY) and text_.lower() in ("ok", "okay", "yes", "haan", "हाँ", "ji", "जी")):
                await _handle_continue(); return

            concept = lesson.concept_at(pointer)
            if concept is None:
                await _handle_continue(); return
            kind = "answer" if phase in (sm.AWAIT_ANSWER, sm.REMEDIATE) and intent != "doubt" and not force_doubt else "doubt"
            decision, usage = await run_turn(
                institute_id=institute_id, user_id=user_id, model=settings.llm_model, teacher=teacher, lang=lang,
                strictness=settings.strictness, learner_name=display_name or None, state=state, lesson=lesson,
                pointer=pointer, board_ops=board, transcript=transcript, learner_message=text_, kind=kind,
                mode="voice" if spoken else "text", tutor_session_id=tutor_session_id,
            )
            svc.bump_telemetry(tutor_session_id, turns=1, llm_prompt_tokens=usage.get("prompt_tokens", 0),
                               llm_completion_tokens=usage.get("completion_tokens", 0), fallbacks=1 if decision.get("fallback") else 0)
            if decision["board_ops"]:
                await _send({"type": "board", "clear": False, "ops": decision["board_ops"], "live": True})
            if kind == "answer":
                score = (decision.get("assessment") or {}).get("score")
                action = decision["action"]
                if action == "advance":
                    svc.record_attempt(tutor_session_id=tutor_session_id, user_id=user_id, package_session_id=package_session_id,
                                       concept_id=concept.id, tags=concept.tags, attempt_no=pointer.remediations + 1, answer=text_,
                                       score=score, misconception=(decision.get("assessment") or {}).get("misconception"),
                                       action="advance", session_ops=decision["board_ops"], note=(decision.get("learner_state_delta") or {}).get("note"))
                    await _say(decision["say"], meta={"kind": "evaluate", "score": score})
                    await _apply_step(sm.advance(lesson, pointer, mark_done=True))
                elif action == "remediate":
                    step = sm.remediate(lesson, pointer)
                    weak_now = step.kind != "ask"      # remediation budget exhausted → advanced weak
                    svc.record_attempt(tutor_session_id=tutor_session_id, user_id=user_id, package_session_id=package_session_id,
                                       concept_id=concept.id, tags=concept.tags, attempt_no=pointer.remediations + 1, answer=text_,
                                       score=score, misconception=(decision.get("assessment") or {}).get("misconception"),
                                       action="advance_weak" if weak_now else "remediate", session_ops=decision["board_ops"],
                                       note=(decision.get("learner_state_delta") or {}).get("note"))
                    await _say(decision["say"], meta={"kind": "remediate", "score": score})
                    if step.kind == "ask":
                        pointer = step.pointer
                        await _emit_state(pointer.phase)
                        await _send({"type": "await", "what": "answer"})
                    else:
                        await _apply_step(step)
                else:  # answer_doubt / wait: respond and re-open the check
                    await _say(decision["say"], meta={"kind": decision["action"]})
                    await _send({"type": "await", "what": "answer"})
            else:
                await _say(decision["say"], meta={"kind": "answer_doubt"})
                await _send({"type": "await", "what": "answer" if phase in (sm.AWAIT_ANSWER, sm.REMEDIATE) else "continue"})

        async def _handle_continue() -> None:
            nonlocal pointer
            phase = pointer.phase
            if phase in (sm.TEACH, sm.MEDIA_TASK):
                await _apply_step(sm.after_teach(lesson, pointer))
            elif phase == sm.TOPIC_SUMMARY:
                await _apply_step(sm.next_topic(lesson, pointer))
            elif phase in (sm.AWAIT_ANSWER, sm.REMEDIATE):
                await _send({"type": "await", "what": "answer"})
            elif phase == sm.SLIDE_DONE:
                await _send({"type": "slide_done", "slide_id": lesson.slide_id, "weak_concepts": list(pointer.weak),
                             "skipped_concepts": list(pointer.skipped), "done": pointer.done, "total": lesson.total_concepts})

        async def _run_audio_turn(audio: bytes, mime: str) -> None:
            reason, detail = "complete", ""
            try:
                audio, mime, note = await _transcode_to_wav(audio, mime)
                detail = note
                if mime == "audio/wav" and len(audio) < MIN_SPEECH_WAV_BYTES:
                    await _send({"type": "audio_end", "reason": "no_speech", "detail": f"too_short;{note}"})
                    return
                try:
                    text_ = await sarvam.speech_to_text(audio_bytes=audio, language=_lang_stt(), mime_type=mime)
                except SarvamSTTError as e:
                    await _send({"type": "transcript_final", "text": ""})
                    await _send({"type": "error", "message": "Speech recognition failed"})
                    await _send({"type": "audio_end", "reason": "error", "detail": f"stt_http_{e.status or 'err'};{note}"})
                    return
                voice_service.record_voice_media_usage(kind="stt", institute_id=institute_id, user_id=user_id, session_id=tutor_session_id,
                                                       language=_lang_stt(), characters=len(text_ or ""), detail="tutor")
                await _send({"type": "transcript_final", "text": text_ or ""})
                await _handle_learner_text(text_ or "", spoken=True)
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001
                logger.exception("tutor audio turn failed for %s", tutor_session_id)
                await _send({"type": "error", "message": str(e)[:200]})
                await _send({"type": "audio_end", "reason": "error", "detail": detail})

        async def _cancel_current() -> None:
            nonlocal current_task
            if current_task and not current_task.done():
                current_task.cancel()
                try:
                    await current_task
                except (asyncio.CancelledError, Exception):  # noqa: BLE001
                    pass
            current_task = None

        def _spawn(coro) -> None:
            nonlocal current_task
            current_task = asyncio.create_task(coro)

        # ── 3. ready + opening ──
        await _send({"type": "ready", "tutor_session_id": tutor_session_id, "mode": mode, "language": lang,
                     "teacher_name": teacher, "learner_name": display_name,
                     "topics": [{"id": t.id, "title": t.title, "concepts": len(t.concepts)} for t in lesson.topics]})
        _spawn(_open())

        # ── 4. loop ──
        while True:
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=IDLE_SECONDS)
            except asyncio.TimeoutError:
                await _send({"type": "error", "message": "Session idle; ending"})
                break
            if time.time() - started_at > SESSION_MAX_SECONDS:
                await _send({"type": "error", "message": "Session limit reached; ending"})
                break
            last_activity = time.time()
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await _send({"type": "error", "message": "Invalid JSON"}); continue
            t = msg.get("type")
            if t == "ping":
                await _send({"type": "pong"})
            elif t == "auth":
                continue
            elif t == "config":
                new_lang = msg.get("language")
                if new_lang in ("en", "hi") and new_lang != lang and settings.session_language != "course_only":
                    lang = new_lang
                    svc.save_pointer(user_id=user_id, package_session_id=package_session_id, lesson=lesson, pointer=pointer, language=lang, pace=pace)
                    await _emit_state(pointer.phase)
                if isinstance(msg.get("speak"), bool):
                    speak_enabled = msg["speak"] and mode == "voice"
            elif t == "continue":
                await _cancel_current()
                _spawn(_handle_continue())
            elif t == "answer" or t == "ask":
                await _cancel_current()
                text_ = str(msg.get("text") or "")[:2000]
                _spawn(_handle_learner_text(text_, spoken=False) if t == "answer" else _handle_doubt(text_))
            elif t == "control":
                await _cancel_current()
                intent = str(msg.get("intent") or "")
                _spawn(_handle_learner_text(intent if intent in ("repeat", "skip", "slower", "faster", "done", "pause", "resume") else "", spoken=False))
            elif t == "audio_chunk":
                data = msg.get("data") or ""
                if data:
                    try:
                        audio_buffer.extend(base64.b64decode(data))
                    except Exception:  # noqa: BLE001
                        await _send({"type": "error", "message": "Invalid base64 audio data"})
            elif t == "audio_end":
                if not audio_buffer:
                    await _send({"type": "audio_end", "reason": "no_audio"}); continue
                await _cancel_current()
                audio = bytes(audio_buffer); audio_buffer.clear()
                _spawn(_run_audio_turn(audio, msg.get("mime") or "audio/wav"))
            elif t == "audio_discard":
                audio_buffer.clear()
            elif t == "interrupt":
                await _cancel_current()
            elif t == "next_slide":
                await _cancel_current()
                sid = str(msg.get("slide_id") or "")
                try:
                    lesson, pointer, resumed = svc.switch_slide(tutor_session_id=tutor_session_id, user_id=user_id,
                                                                package_session_id=package_session_id, slide_id=sid)
                    board = []
                    _spawn(_open())
                except LookupError as e:
                    await _send({"type": "error", "message": str(e)})
            elif t == "end_session":
                await _cancel_current()
                summary = svc.end_session(tutor_session_id=tutor_session_id, user_id=user_id, package_session_id=package_session_id,
                                          lesson=lesson, pointer=pointer)
                await _send({"type": "summary", "data": summary})
                break
            else:
                await _send({"type": "error", "message": f"Unknown message type: {t}"})
    except WebSocketDisconnect:
        logger.info("tutor socket disconnected %s", tutor_session_id)
    except Exception as e:  # noqa: BLE001
        logger.exception("tutor socket error %s", tutor_session_id)
        try:
            await websocket.send_json({"type": "error", "message": str(e)[:200]})
        except Exception:  # noqa: BLE001
            pass
    finally:
        if current_task and not current_task.done():
            current_task.cancel()
        try:
            with db_session() as db2:
                ts2 = db2.get(TutorSession, tutor_session_id)
                if ts2 is not None and ts2.status == "ACTIVE":
                    db2.close()
                    svc.end_session(tutor_session_id=tutor_session_id, user_id=ts2.user_id, package_session_id=ts2.package_session_id,
                                    lesson=None, pointer=None, status="ABANDONED")
        except Exception:  # noqa: BLE001
            pass
        db.close()


__all__ = ["router"]
