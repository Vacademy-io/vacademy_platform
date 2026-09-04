"""Live AI Tutor — learner runtime: REST to start/end a session, WebSocket to
teach (design §6). Builds on the voice-call socket's audio pipeline by import.

Protocol (client → server): auth{token} FIRST, then config{language?,speak?},
continue, answer{text}, ask{text}, control{intent}, next_slide{slide_id},
audio_chunk{data}, audio_end{mime}, audio_discard, interrupt, end_session, ping.
Server → client: ready, lesson (after next_slide), state, board{ops, clear},
ai_text, audio_chunk, audio_segment_end, audio_end{reason}, check{...},
await{what}, transcript_final, slide_done, summary, ended{reason},
error{message, fatal}, pong.

The handler holds NO database connection: every read/write goes through
session_service in its own short session, so a 90-minute lesson never pins
a pool connection across a model or TTS await.
"""
from __future__ import annotations

import asyncio
import base64
import hashlib
import json
import logging
import time
from collections import OrderedDict, deque
from typing import Any, Deque, Dict, List, Optional, Tuple

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request, WebSocket, WebSocketDisconnect, status
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..config import Settings, get_settings
from ..core.security import decode_access_token, get_pinned_principal
from ..db import db_dependency
from ..models.tutor_runtime import TutorSession
from ..services.sarvam_service import SarvamService, SarvamSTTError
from ..services.tutor.roles import is_staff, normalize_roles
from ..services.tutor.runtime import session_service as svc
from ..services.tutor.runtime import state as sm
from ..services.tutor.runtime.decision import run_turn
from ..services.tutor.runtime.intents import detect_intent
from ..services.tutor.runtime import prompts
from ..services.tutor.runtime.settings import TutorSettings
from ..services.tutor.slide_source import package_belongs_to_institute
from ..services.voice_tts import (
    SARVAM_DEFAULT_FEMALE, SMALLEST_DEFAULT_VOICE, default_voice_for, sarvam_speaker, smallest_available,
    synthesize_speech,
)
from .voice_agent import MIN_SPEECH_WAV_BYTES, TTS_CHUNK_SIZE, _split_for_speech, _transcode_to_wav

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/tutor", tags=["tutor-runtime"])

SESSION_MAX_SECONDS = 90 * 60
# Idle = no learner frame other than keep-alive pings. Watching a video or
# reading a PDF is legitimately silent for much longer.
IDLE_SECONDS = 5 * 60
MEDIA_IDLE_SECONDS = 30 * 60
# Every learner utterance is one model call; bound what a runaway client (or
# a script with the learner's token) can spend.
MAX_TURNS_PER_MINUTE = 20
MAX_TURNS_PER_SESSION = 400
LANG_TO_STT = {"en": "en-IN", "hi": "hi-IN"}
PACE_MULTIPLIER = {"slow": 0.85, "normal": 1.0, "fast": 1.2}
SERVER_TTS_PROVIDERS = ("smallest", "sarvam", "google", "edge")
# Voice lessons are metered per started minute (design §4.8, tool
# tutor_live_minute); the first minute is charged at open, the next every 60 s.
LIVE_METER_SECONDS = 60

# ── in-process TTS cache (compiled narration repeats across learners) ────────
_TTS_CACHE: "OrderedDict[str, bytes]" = OrderedDict()
_TTS_CACHE_MAX = 300


def _cache_key(provider: str, voice: str, lang: str, pace: str, text_: str) -> str:
    return hashlib.sha256(f"{provider}|{voice}|{lang}|{pace}|{text_}".encode("utf-8")).hexdigest()


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
        return is_staff(self.roles, is_root=self.is_root)


async def _caller(request: Request, authorization: Optional[str] = Header(default=None),
                  settings: Settings = Depends(get_settings)) -> Caller:
    if not authorization:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Missing Authorization: Bearer <jwt> (with a clientId header)")
    p = await get_pinned_principal(request, authorization, settings)
    return Caller(p.institute_id, p.user_id, sorted(normalize_roles(p.roles)), bool(p.is_root_user))


class StartSessionRequest(BaseModel):
    package_session_id: str = Field(..., min_length=1, max_length=255)
    slide_id: Optional[str] = Field(default=None, max_length=255)
    mode: str = Field(default="TEXT", pattern=r"^(TEXT|VOICE)$")
    language: Optional[str] = Field(default=None, pattern=r"^(en|hi)$")


def _batch_access(db: Session, caller: Caller, package_session_id: str) -> None:
    """Learners must be ACTIVE in the batch; staff must at least be in the
    batch's institute (a teacher token cannot open another institute's course)."""
    if caller.is_staff:
        pkg = svc.package_of_session(db, package_session_id)
        if not pkg or not package_belongs_to_institute(db, pkg[0], caller.institute_id):
            raise HTTPException(status_code=404, detail="Batch not found in this institute")
        return
    if not svc.learner_is_enrolled(db, user_id=caller.user_id, package_session_id=package_session_id, institute_id=caller.institute_id):
        raise HTTPException(status_code=403, detail="Not enrolled in this batch")


@router.get("/v1/learner/packages/{package_id}/availability", summary="Is tutor mode available on this course?")
def learner_availability(
    package_id: str,
    package_session_id: Optional[str] = Query(default=None),
    caller: Caller = Depends(_caller),
    db: Session = Depends(db_dependency),
) -> Dict[str, Any]:
    if not package_belongs_to_institute(db, package_id, caller.institute_id):
        raise HTTPException(status_code=404, detail="Course not found in this institute")
    return svc.availability(db, package_id=package_id, package_session_id=package_session_id,
                            institute_id=caller.institute_id, user_id=caller.user_id)


@router.get("/v1/learner/chapters/{chapter_id}/slides", summary="Ordered slides of a chapter with tutor readiness")
def learner_chapter_slides(
    chapter_id: str,
    package_session_id: str = Query(...),
    caller: Caller = Depends(_caller),
    db: Session = Depends(db_dependency),
) -> Dict[str, Any]:
    _batch_access(db, caller, package_session_id)
    return {"chapter_id": chapter_id, "slides": svc.chapter_slides(db, package_session_id=package_session_id, chapter_id=chapter_id)}


@router.post("/v1/sessions", summary="Start (or resume) a tutor session")
def start_session(
    payload: StartSessionRequest,
    caller: Caller = Depends(_caller),
    db: Session = Depends(db_dependency),
) -> Dict[str, Any]:
    _batch_access(db, caller, payload.package_session_id)
    if payload.mode == "VOICE":
        short = svc.preflight_live_session(db, caller.institute_id)
        if short:
            raise HTTPException(status_code=status.HTTP_402_PAYMENT_REQUIRED, detail=short)
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
        "slide_title": lesson.slide_title,
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
    send_lock = asyncio.Lock()
    current_task: Optional[asyncio.Task] = None
    audio_buffer = bytearray()
    started_at = time.time()
    last_activity = time.time()
    reached_ready = False
    turn_times: Deque[float] = deque()
    turns = 0
    meter_task: Optional[asyncio.Task] = None

    async def _send(payload: dict) -> None:
        async with send_lock:
            await websocket.send_json(payload)

    async def _fatal(message: str, code: int) -> None:
        await _send({"type": "error", "message": message, "fatal": True})
        await websocket.close(code=code)

    try:
        owner = svc.session_owner(tutor_session_id)
        if owner is None or owner["status"] != "ACTIVE":
            await _fatal("Tutor session not found or already ended", 4004)
            return
        user_id = owner["user_id"]

        # ── 1. auth FIRST, always ──
        try:
            raw = await asyncio.wait_for(websocket.receive_text(), timeout=20)
        except asyncio.TimeoutError:
            await _fatal("Authentication timed out", 4401)
            return
        try:
            first = json.loads(raw)
        except json.JSONDecodeError:
            first = {}
        claims = decode_access_token(str(first.get("token") or "")) if first.get("type") == "auth" else None
        if not claims or str(claims.get("user") or "") != str(user_id):
            await _fatal("Authentication required", 4401)
            return

        # ── 2. load lesson, settings, learner state (one short session) ──
        ctx = svc.boot_context(tutor_session_id)
        if ctx is None:
            await _fatal("Tutor session not found", 4004)
            return
        lesson: Optional[sm.LessonPlan] = ctx["lesson"]
        if lesson is None:
            await _fatal("This slide has no teaching plan", 4009)
            return
        institute_id, package_session_id = ctx["institute_id"], ctx["package_session_id"]
        chat_session_id = ctx["chat_session_id"]
        mode = "voice" if ctx["mode"] == "VOICE" else "text"
        settings: TutorSettings = ctx["settings"]
        state: Dict[str, Any] = ctx["state"]
        lang = ctx["language"] if ctx["language"] in ("en", "hi") else settings.course_language
        display_name = ctx["learner_name"] or ""
        pointer = ctx.get("pointer")
        resumed = pointer is not None
        pointer = pointer or sm.Pointer()
        sarvam = SarvamService()
        tts_provider = ctx["tts_provider"]
        if tts_provider not in SERVER_TTS_PROVIDERS or (tts_provider == "smallest" and not smallest_available()):
            tts_provider = "sarvam"
        tts_voice = ctx["tts_voice"]
        # What the learner answered per concept this session; quiz slides
        # write it back as a quiz activity log when the slide is done.
        attempt_log: Dict[str, Dict[str, Any]] = {}
        pace = state.get("pace") or "normal"
        board: List[Dict[str, Any]] = []          # cumulative ops of the current topic
        transcript: List[Dict[str, str]] = []
        speak_enabled = mode == "voice"
        teacher = settings.teacher_name or "Asha"
        # A transition already committed (pointer + DB) whose narration was
        # interrupted before the next board was shown: (step, concept it closed).
        pending: Optional[Tuple[sm.Step, Optional[sm.Concept]]] = None

        def _lang_stt() -> str:
            return LANG_TO_STT.get(lang, "en-IN")

        def _personalize(text_: str) -> str:
            return text_.replace("{student_name}", display_name or ("there" if lang == "en" else "दोस्त"))

        def _slide_name() -> str:
            return lesson.slide_title or (lesson.topics[0].title if lesson.topics else "")

        def _save() -> None:
            svc.save_pointer(user_id=user_id, package_session_id=package_session_id, lesson=lesson, pointer=pointer,
                             language=lang, pace=pace)

        async def _speak(text_: str) -> None:
            if not speak_enabled or not text_.strip():
                return
            # The teacher is female by default (owner decision); a voice name
            # Sarvam does not serve (v2 names, Smallest voices) falls back to it.
            if tts_provider == "sarvam":
                voice = sarvam_speaker(tts_voice, SARVAM_DEFAULT_FEMALE)
            elif tts_provider == "smallest":
                voice = (tts_voice or SMALLEST_DEFAULT_VOICE).strip()
            else:
                voice = tts_voice or default_voice_for(tts_provider, _lang_stt())
            for segment in _split_for_speech(text_):
                key = _cache_key(tts_provider, voice, _lang_stt(), pace, segment)
                audio = _cache_get(key)
                provider_used = tts_provider
                if audio is None:
                    audio, _mime, provider_used = await synthesize_speech(
                        text=segment, language=_lang_stt(), voice=voice, provider=tts_provider,
                        pace=PACE_MULTIPLIER.get(pace, 1.0),
                    )
                    if audio:
                        _cache_put(key, audio)
                        # Only synthesised audio costs money; a failed engine is not usage.
                        svc.record_media_usage(kind="tts", institute_id=institute_id, user_id=user_id,
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

        async def _send_slide_done() -> None:
            frame: Dict[str, Any] = {"type": "slide_done", "slide_id": lesson.slide_id, "weak_concepts": list(pointer.weak),
                                     "skipped_concepts": list(pointer.skipped), "done": pointer.done, "total": lesson.total_concepts}
            qr = svc.quiz_results(lesson, attempt_log)
            if qr:
                frame["quiz_results"] = qr
            await _send(frame)

        async def _meter() -> None:
            """Charge the first minute now, then one per minute; stop the
            lesson politely when the institute cannot afford the next one."""
            minute = 0
            while True:
                minute += 1
                ok = await asyncio.to_thread(svc.bill_live_minute, tutor_session_id=tutor_session_id,
                                             institute_id=institute_id, user_id=user_id, minute_no=minute)
                if not ok:
                    await _cancel_current()
                    await _say(prompts.tpl("credits_end", lang), meta={"kind": "credits_end"})
                    await _send({"type": "ended", "reason": "credits"})
                    try:
                        await websocket.close(code=4402)
                    except Exception:  # noqa: BLE001
                        pass
                    return
                await asyncio.sleep(LIVE_METER_SECONDS)

        async def _apply_step(step: sm.Step, *, greeting: Optional[str] = None) -> None:
            nonlocal pointer, board
            # Commit the transition BEFORE any await: an interrupted narration
            # must never leave memory one concept ahead of the database.
            pointer = step.pointer
            _save()
            if step.kind in ("teach", "media_task"):
                if step.clear_board:
                    board = []
                    await _send({"type": "board", "clear": True, "ops": [], "topic_id": step.topic.id if step.topic else None})
                board = board + list(step.board_ops)
                await _emit_state(step.pointer.phase)
                await _send({"type": "board", "clear": False, "ops": step.board_ops, "topic_id": step.topic.id if step.topic else None,
                             "concept_id": step.concept.id if step.concept else None})
                narration = step.concept.narration(lang)
                # Compiled first concepts often open with their own "Hi {name}";
                # don't greet twice.
                if greeting and narration.lstrip()[:12].lower().startswith(("hi ", "hi,", "hello", "नमस्ते", "namaste")):
                    greeting = None
                text_ = (greeting + " " if greeting else "") + narration
                if step.kind == "media_task":
                    kind = next((op.get("kind") for op in step.board_ops if op.get("op") == "media_task"), "video")
                    text_ = (greeting + " " if greeting else "") + prompts.tpl("media_task_video" if kind == "video" else "media_task_pdf", lang)
                await _say(text_, meta={"concept_id": step.concept.id if step.concept else None, "kind": step.kind})
                if step.kind == "media_task":
                    await _send({"type": "await", "what": "done"})
                elif step.concept and step.concept.has_check:
                    # Explain, then ask — in one breath, like a teacher would.
                    await _apply_step(sm.after_teach(lesson, pointer))
                else:
                    # nothing to ask: the client sends `continue` when the audio ends
                    await _send({"type": "await", "what": "continue"})
            elif step.kind == "ask":
                await _emit_state(step.pointer.phase)
                c = step.concept
                chk = (c.check or {}) if c else {}
                await _send({"type": "check", "concept_id": c.id if c else None, "check_type": chk.get("type"),
                             "prompt": chk.get("prompt"), "options": chk.get("options") or [],
                             "remediation": step.pointer.remediations})
                await _say(prompts.tpl("ask", lang, prompt=chk.get("prompt") or ""), meta={"concept_id": c.id if c else None, "kind": "ask"})
                await _send({"type": "await", "what": "answer"})
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
                await _say(prompts.tpl("slide_done", lang, slide=_slide_name(), name=display_name, weak=weak), meta={"kind": "slide_done"})
                await _send_slide_done()

        async def _open(*, first: bool) -> None:
            nonlocal board
            if resumed:
                # Put back what the topic's earlier concepts drew, so "look at
                # the arrow" still points at something after a refresh.
                replay = sm.replay_ops(lesson, pointer)
                if replay:
                    board = list(replay)
                    t = lesson.topic_at(pointer)
                    await _send({"type": "board", "clear": True, "ops": [], "topic_id": t.id if t else None})
                    await _send({"type": "board", "clear": False, "ops": replay, "topic_id": t.id if t else None, "replay": True})
                # The rolling summary is bookkeeping, not conversation: only the
                # part a learner would want to hear survives into the greeting.
                weak_n = len(state.get("weak_concepts_json") or [])
                summary = prompts.tpl("weak_note", lang, n=weak_n) if weak_n else ""
                greet = prompts.tpl("resume", lang, name=display_name, slide=_slide_name(), summary=summary)
            elif first:
                greet = prompts.tpl("greet", lang, name=display_name, teacher=teacher, slide=_slide_name())
            else:
                greet = prompts.tpl("next_slide", lang, slide=_slide_name())
            await _apply_step(sm.enter(lesson, pointer), greeting=greet)

        async def _commit_then_say(step: sm.Step, closed: Optional[sm.Concept], text_: str, meta: dict) -> None:
            """Verdict pattern: the transition is committed first; if the
            learner barges in during the verdict, `pending` carries the
            step so the next `continue` (or utterance) picks it up."""
            nonlocal pointer, pending
            pending = (step, closed)
            pointer = step.pointer
            _save()
            await _say(text_, meta=meta)
            pending = None
            await _apply_step(step)

        async def _answer_doubt(text_: str, concept: sm.Concept, *, spoken: bool, what_next: str) -> None:
            decision, usage = await run_turn(
                institute_id=institute_id, user_id=user_id, model=settings.llm_model, teacher=teacher, lang=lang,
                strictness=settings.strictness, learner_name=display_name or None, state=state, lesson=lesson,
                pointer=pointer, board_ops=board, transcript=transcript, learner_message=text_, kind="doubt",
                mode="voice" if spoken else "text", tutor_session_id=tutor_session_id, concept=concept,
            )
            svc.bump_telemetry(tutor_session_id, turns=1, llm_prompt_tokens=usage.get("prompt_tokens", 0),
                               llm_completion_tokens=usage.get("completion_tokens", 0), fallbacks=1 if decision.get("fallback") else 0)
            if decision["board_ops"]:
                await _send({"type": "board", "clear": False, "ops": decision["board_ops"], "live": True})
            await _say(decision["say"], meta={"kind": "answer_doubt"})
            if what_next == "slide_done":
                await _send_slide_done()
            else:
                await _send({"type": "await", "what": what_next})

        async def _handle_doubt(text_: str) -> None:
            await _handle_learner_text(text_, spoken=False, force_doubt=True)

        async def _handle_learner_text(text_: str, *, spoken: bool, force_doubt: bool = False) -> None:
            """Route a learner utterance: intent → answer → doubt."""
            nonlocal pointer, pace, lang, pending, state
            text_ = (text_ or "").strip()
            if not text_:
                await _send({"type": "audio_end", "reason": "no_speech"})
                return
            transcript.append({"role": "learner", "text": text_})
            svc.append_transcript(chat_session_id, "user", text_, {"spoken": spoken})
            intent = None if force_doubt else detect_intent(text_)
            phase = pointer.phase
            short_ok = text_.lower().strip(" .!") in ("ok", "okay", "yes", "haan", "हाँ", "ji", "जी", "hmm", "sure", "next", "fine")

            # A verdict was interrupted: the learner either wants to go on or
            # has a question about what was just closed.
            if pending is not None:
                step, closed = pending
                if intent in ("resume", "skip", "repeat", "done") or (intent is None and short_ok):
                    pending = None
                    await _apply_step(step)
                    return
                if closed is not None:
                    await _answer_doubt(text_, closed, spoken=spoken, what_next="continue")
                    return
                pending = None
                await _apply_step(step)
                return

            if intent == "repeat":
                await _apply_step(sm.repeat(lesson, pointer)); return
            if intent == "skip":
                concept = lesson.concept_at(pointer)
                if concept is not None:
                    svc.record_attempt(tutor_session_id=tutor_session_id, user_id=user_id, package_session_id=package_session_id,
                                       concept_id=concept.id, tags=concept.tags, attempt_no=pointer.remediations + 1, answer=text_,
                                       score=None, misconception=None, action="skipped", session_ops=None, note=None)
                    attempt_log.setdefault(concept.id, {"answer": "", "score": None, "correct": False, "action": "skipped"})
                await _say(prompts.tpl("skipped", lang), meta={"kind": "skip"})
                await _apply_step(sm.skip(lesson, pointer)); return
            if intent in ("slower", "faster"):
                pace = "slow" if intent == "slower" else "fast"
                _save()
                await _say(prompts.tpl(intent, lang), meta={"kind": intent})
                await _send({"type": "await", "what": "continue" if phase in (sm.TEACH, sm.TOPIC_SUMMARY) else "answer"}); return
            if intent == "done" and phase == sm.MEDIA_TASK:
                await _apply_step(sm.after_teach(lesson, pointer)); return
            if intent == "pause":
                await _say(prompts.tpl("pause", lang), meta={"kind": "pause"})
                await _send({"type": "await", "what": "answer" if phase in (sm.AWAIT_ANSWER, sm.REMEDIATE) else "continue"}); return
            if intent == "resume" or (intent is None and phase in (sm.TEACH, sm.TOPIC_SUMMARY, sm.SLIDE_DONE) and short_ok):
                await _handle_continue(); return

            concept = lesson.concept_at(pointer)
            if concept is None:
                # Topic summary or slide done: no concept to grade, but a
                # question is still a question — answer it about the last
                # concept taught, then re-open the same wait.
                if intent is None and not force_doubt and len(text_.split()) <= 2:
                    await _handle_continue(); return
                topic = lesson.topic_at(pointer) or (lesson.topics[-1] if lesson.topics else None)
                last = topic.concepts[-1] if topic and topic.concepts else None
                if last is None:
                    await _handle_continue(); return
                await _answer_doubt(text_, last, spoken=spoken, what_next="slide_done" if phase == sm.SLIDE_DONE else "continue")
                return

            kind = "answer" if phase in (sm.AWAIT_ANSWER, sm.REMEDIATE) and intent != "doubt" and not force_doubt else "doubt"
            final_attempt = kind == "answer" and pointer.remediations + 1 >= sm.MAX_REMEDIATIONS
            decision, usage = await run_turn(
                institute_id=institute_id, user_id=user_id, model=settings.llm_model, teacher=teacher, lang=lang,
                strictness=settings.strictness, learner_name=display_name or None, state=state, lesson=lesson,
                pointer=pointer, board_ops=board, transcript=transcript, learner_message=text_, kind=kind,
                mode="voice" if spoken else "text", tutor_session_id=tutor_session_id, final_attempt=final_attempt,
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
                    state = svc.reload_state(user_id, package_session_id) or state
                    attempt_log[concept.id] = {"answer": text_, "score": score, "correct": True, "action": "advance"}
                    await _commit_then_say(sm.advance(lesson, pointer, mark_done=True), concept, decision["say"],
                                           {"kind": "evaluate", "score": score})
                elif action == "remediate":
                    step = sm.remediate(lesson, pointer)
                    weak_now = step.kind != "ask"      # remediation budget exhausted → advanced weak
                    svc.record_attempt(tutor_session_id=tutor_session_id, user_id=user_id, package_session_id=package_session_id,
                                       concept_id=concept.id, tags=concept.tags, attempt_no=pointer.remediations + 1, answer=text_,
                                       score=score, misconception=(decision.get("assessment") or {}).get("misconception"),
                                       action="advance_weak" if weak_now else "remediate", session_ops=decision["board_ops"],
                                       note=(decision.get("learner_state_delta") or {}).get("note"))
                    state = svc.reload_state(user_id, package_session_id) or state
                    attempt_log[concept.id] = {"answer": text_, "score": score, "correct": False,
                                               "action": "advance_weak" if weak_now else "remediate"}
                    if step.kind == "ask":
                        pointer = step.pointer
                        _save()
                        await _say(decision["say"], meta={"kind": "remediate", "score": score})
                        await _emit_state(pointer.phase)
                        await _send({"type": "await", "what": "answer"})
                    else:
                        # The prompt told the model this was the last attempt
                        # (no re-ask); if it re-asked anyway, close the loop
                        # ourselves rather than leave a question unanswerable.
                        say = decision["say"]
                        if decision.get("fallback") or say.rstrip().endswith("?"):
                            say = prompts.tpl("fallback_move_on", lang, expected=((concept.check or {}).get("expected") or "")[:160])
                        await _commit_then_say(step, concept, say, {"kind": "remediate", "score": score})
                else:  # answer_doubt / wait: respond and re-open the check
                    await _say(decision["say"], meta={"kind": decision["action"]})
                    await _send({"type": "await", "what": "answer"})
            else:
                await _say(decision["say"], meta={"kind": "answer_doubt"})
                await _send({"type": "await", "what": "answer" if phase in (sm.AWAIT_ANSWER, sm.REMEDIATE) else "continue"})

        async def _handle_continue() -> None:
            nonlocal pointer, pending
            if pending is not None:
                step, _closed = pending
                pending = None
                await _apply_step(step)
                return
            phase = pointer.phase
            if phase in (sm.TEACH, sm.MEDIA_TASK):
                await _apply_step(sm.after_teach(lesson, pointer))
            elif phase == sm.TOPIC_SUMMARY:
                await _apply_step(sm.next_topic(lesson, pointer))
            elif phase in (sm.AWAIT_ANSWER, sm.REMEDIATE):
                await _send({"type": "await", "what": "answer"})
            elif phase == sm.SLIDE_DONE:
                await _send_slide_done()

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
                    await _send({"type": "error", "message": "I couldn't hear that. Please try again.", "fatal": False})
                    await _send({"type": "audio_end", "reason": "error", "detail": f"stt_http_{e.status or 'err'};{note}"})
                    return
                svc.record_media_usage(kind="stt", institute_id=institute_id, user_id=user_id, session_id=tutor_session_id,
                                       language=_lang_stt(), characters=len(text_ or ""), detail="tutor")
                await _send({"type": "transcript_final", "text": text_ or ""})
                await _handle_learner_text(text_ or "", spoken=True)
            except asyncio.CancelledError:
                raise
            except Exception as e:  # noqa: BLE001
                logger.exception("tutor audio turn failed for %s", tutor_session_id)
                await _send({"type": "error", "message": str(e)[:200], "fatal": False})
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

        def _turn_allowed() -> bool:
            nonlocal turns
            now = time.time()
            while turn_times and now - turn_times[0] > 60:
                turn_times.popleft()
            if len(turn_times) >= MAX_TURNS_PER_MINUTE or turns >= MAX_TURNS_PER_SESSION:
                return False
            turn_times.append(now)
            turns += 1
            return True

        def _lesson_frame() -> dict:
            return {"type": "lesson", "slide_id": lesson.slide_id, "slide_title": lesson.slide_title, "resumed": resumed,
                    "topics": [{"id": t.id, "title": t.title, "concepts": len(t.concepts)} for t in lesson.topics],
                    "progress": pointer.progress(lesson)}

        # ── 3. ready + opening ──
        await _send({"type": "ready", "tutor_session_id": tutor_session_id, "mode": mode, "language": lang,
                     "teacher_name": teacher, "learner_name": display_name, "slide_id": lesson.slide_id,
                     "slide_title": lesson.slide_title,
                     "topics": [{"id": t.id, "title": t.title, "concepts": len(t.concepts)} for t in lesson.topics]})
        reached_ready = True
        if mode == "voice":
            meter_task = asyncio.create_task(_meter())
        _spawn(_open(first=True))

        # ── 4. loop ──
        while True:
            idle_limit = MEDIA_IDLE_SECONDS if pointer.phase == sm.MEDIA_TASK else IDLE_SECONDS
            try:
                raw = await asyncio.wait_for(websocket.receive_text(), timeout=idle_limit + 60)
            except asyncio.TimeoutError:
                await _send({"type": "ended", "reason": "idle"})
                break
            now = time.time()
            if now - started_at > SESSION_MAX_SECONDS:
                await _send({"type": "ended", "reason": "limit"})
                break
            try:
                msg = json.loads(raw)
            except json.JSONDecodeError:
                await _send({"type": "error", "message": "Invalid JSON", "fatal": False}); continue
            t = msg.get("type")
            if t == "ping":
                # Keep-alives are not activity: an abandoned tab still idles out.
                busy = current_task is not None and not current_task.done()
                if now - last_activity > idle_limit and not busy:
                    await _cancel_current()
                    await _say(prompts.tpl("idle_end", lang), meta={"kind": "idle_end"})
                    await _send({"type": "ended", "reason": "idle"})
                    break
                await _send({"type": "pong"})
                continue
            last_activity = now
            if t == "auth":
                continue
            elif t == "config":
                new_lang = msg.get("language")
                if new_lang in ("en", "hi") and new_lang != lang:
                    lang = new_lang
                    _save()
                    await _emit_state(pointer.phase)
                if isinstance(msg.get("speak"), bool):
                    speak_enabled = msg["speak"] and mode == "voice"
            elif t == "continue":
                await _cancel_current()
                _spawn(_handle_continue())
            elif t == "answer" or t == "ask":
                if not _turn_allowed():
                    await _send({"type": "error", "message": "Too many messages in a row; please slow down.", "fatal": False}); continue
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
                        await _send({"type": "error", "message": "Invalid base64 audio data", "fatal": False})
            elif t == "audio_end":
                if not audio_buffer:
                    await _send({"type": "audio_end", "reason": "no_audio"}); continue
                if not _turn_allowed():
                    audio_buffer.clear()
                    await _send({"type": "audio_end", "reason": "rate_limited"})
                    await _send({"type": "error", "message": "Too many messages in a row; please slow down.", "fatal": False}); continue
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
                    pending = None
                    await _send(_lesson_frame())
                    _spawn(_open(first=False))
                except LookupError as e:
                    await _send({"type": "error", "message": str(e), "fatal": False})
            elif t == "end_session":
                await _cancel_current()
                summary = svc.end_session(tutor_session_id=tutor_session_id, user_id=user_id, package_session_id=package_session_id,
                                          lesson=lesson, pointer=pointer)
                await _send({"type": "summary", "data": summary})
                break
            else:
                await _send({"type": "error", "message": f"Unknown message type: {t}", "fatal": False})
    except WebSocketDisconnect:
        logger.info("tutor socket disconnected %s", tutor_session_id)
    except Exception as e:  # noqa: BLE001
        logger.exception("tutor socket error %s", tutor_session_id)
        try:
            await websocket.send_json({"type": "error", "message": str(e)[:200], "fatal": True})
        except Exception:  # noqa: BLE001
            pass
    finally:
        if current_task and not current_task.done():
            current_task.cancel()
        if meter_task is not None and not meter_task.done():
            meter_task.cancel()
        try:
            owner = svc.session_owner(tutor_session_id)
            if owner is not None and owner["status"] == "ACTIVE":
                ts_status = "ABANDONED" if reached_ready else "ENDED"
                svc.end_session(tutor_session_id=tutor_session_id, user_id=owner["user_id"],
                                package_session_id=owner["package_session_id"],
                                lesson=None, pointer=None, status=ts_status)
        except Exception:  # noqa: BLE001
            pass


__all__ = ["router"]
