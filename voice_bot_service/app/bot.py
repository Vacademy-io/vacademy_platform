"""The Pipecat call pipeline — productionization of the validated POC bot.py
(github.com/shreyash-jain/sales-poc-ai).

Pipeline (same order as the POC):
    transport.input() → STT → transcript(user) → user_agg → LLM
        → SentinelGate → TTS → transport.output() → assistant_agg

Two hidden markers steer the call (sentinel pattern proven in the POC — no
dependency on provider tool-calling):
    <<END_CALL>>  — the LLM decided the conversation is over; say the farewell,
                    then stop the task (Plivo falls through to <Redirect> which
                    hangs up via /plivo/ai-next).
    <<TRANSFER>>  — the caller wants a human; register the handoff with
                    admin_core, speak the bridge line, then stop the task
                    (Plivo's <Redirect> then <Dial>s the registered target).

NOTE ON PIPECAT IMPORTS: this file targets pipecat-ai 0.0.95 (pinned in
requirements.txt; every module path below verified against that wheel). If you
bump pipecat, re-verify each import — paths have moved between minor versions.
"""
from __future__ import annotations

import asyncio
import logging
import random
import re
import time
from collections import deque
from datetime import datetime, timedelta
from zoneinfo import ZoneInfo
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from pipecat.frames.frames import (
    BotStartedSpeakingFrame,
    BotStoppedSpeakingFrame,
    EndFrame,
    Frame,
    InterruptionFrame,
    LLMFullResponseEndFrame,
    LLMFullResponseStartFrame,
    LLMMessagesAppendFrame,
    LLMTextFrame,
    TranscriptionFrame,
    TTSAudioRawFrame,
    TTSSpeakFrame,
    TTSStartedFrame,
    TTSStoppedFrame,
    TTSTextFrame,
    UserStartedSpeakingFrame,
    UserStoppedSpeakingFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response import LLMUserAggregatorParams
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.audio.interruptions.min_words_interruption_strategy import (
    MinWordsInterruptionStrategy,
)

from . import admin_core
from .callstate import (CallState, WatchdogConfig, Decision, watchdog_decide,
                        apply_decision, stall_recovery_still_needed, unplayed_confirmed,
                        NONE, CANCEL_STARVED, REISSUE_STOP,
                        CAP_FAREWELL, STALL_RECOVER, ORPHAN_ASK, NUDGE, IDLE_HANGUP,
                        HEARING_FAILED, ARM_STOP, DUCK_RESUME)
from .config import get_settings
from . import diagnostics as diag_mod
from .providers import build_llm, build_stt, build_tts
from .turntake import mid_reply_action, ABSORB

logger = logging.getLogger(__name__)

END_MARKER = "<<END_CALL>>"
TRANSFER_MARKER = "<<TRANSFER>>"

# If a graceful stop (stop_when_done) hasn't ended the runner within this many
# seconds, hard-cancel — a chatty caller can otherwise starve the drain forever.
_GRACEFUL_STOP_DEADLINE_SECS = 25.0


@dataclass
class CallOutcome:
    """Everything report.py needs after the call ends. Owned by the CALLER of
    run_bot (main.py) so a mid-pipeline crash still leaves a reportable object —
    a lost report strands the paused workflow until its safety timeout."""

    corr: str
    context: Dict[str, Any]
    connected_at: float = field(default_factory=time.time)
    ended_at: Optional[float] = None
    transcript: List[Dict[str, str]] = field(default_factory=list)  # {role, text}
    transfer_requested: bool = False
    transfer_registered: bool = False
    end_requested: bool = False
    # Set by main.py when run_bot raises: the report must say "failed", not
    # "no-answer" — a crash is our fault and must never read as the lead's.
    crashed: bool = False
    crash_detail: Optional[str] = None
    # Per-call technical diagnostics (app/diagnostics.CallDiagnostics). Owned by
    # run_bot; None when the pipeline died before setup.
    diagnostics: Any = None

    def duration_seconds(self) -> int:
        end = self.ended_at or time.time()
        return max(0, int(end - self.connected_at))


class TranscriptCollector(FrameProcessor):
    """Records the caller's words (final transcriptions), refreshes the idle clock,
    and speaks an instant filler acknowledgment ("Hmm…") while the LLM composes —
    the reply's hard floor is ~1.5s of silence otherwise (VAD window + STT final +
    LLM TTFT), and a human-style acknowledgment makes it read as attentiveness."""

    def __init__(self, outcome: CallOutcome, on_activity, is_bot_speaking,
                 set_user_speaking=None, filler_phrases=None, on_transcript=None,
                 fillers_armed=None, bot_stopped_t=None, duck=None,
                 on_absorb=None, backchannel_extra=frozenset()):
        super().__init__()
        self._outcome = outcome
        self._on_activity = on_activity
        self._is_bot_speaking = is_bot_speaking
        self._set_user_speaking = set_user_speaking or (lambda speaking: None)
        self._on_transcript = on_transcript or (lambda backchannel=False: None)
        # Duck path (see DuckGate): while a reply is held, THIS processor is the
        # decision point — it sits before aggregators.user(), so an absorbed
        # backchannel never reaches the aggregator that would delete it or run
        # the LLM on it.
        self._duck = duck

        async def _noop_absorb(text):
            return None

        self._on_absorb = on_absorb or _noop_absorb
        self._backchannel_extra = frozenset(backchannel_extra)
        # Fillers only AFTER the bot has completed its first real utterance: during
        # the setup dead-air callers say "hello? hello?" and a filler was the FIRST
        # thing they ever heard ("starts with Hmm" — live complaint).
        self._fillers_armed = fillers_armed or (lambda: True)
        # When the bot last FINISHED speaking — a repeat is only greeting-spam if
        # the bot has said nothing since the first copy; if it asked a NEW question
        # in between, an identical short answer ("haan") is a REAL answer.
        self._bot_stopped_t = bot_stopped_t or (lambda: 0.0)
        # Dedupe window for identical consecutive transcripts ("Hello" x3 while the
        # pipeline warms up): each repeat triggered its own LLM run → the intro was
        # spoken twice back-to-back on a live call.
        self._last_text = ""
        self._last_text_t = 0.0
        s = get_settings()
        self._filler_phrases = list(filler_phrases if filler_phrases is not None
                                    else s.filler_phrases)
        self._filler_probability = max(0.0, min(1.0, s.filler_probability))

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        # VAD user-speech frames re-arm the idle clock. Sarvam STT emits FINAL
        # transcripts only (no interims), so without this the clock goes stale during
        # a LONG caller utterance and the watchdog spoke "kya aap sun paa rahe hain?"
        # WHILE THE CALLER WAS TALKING (observed 13x in 48h of live calls).
        if isinstance(frame, UserStartedSpeakingFrame):
            self._set_user_speaking(True)
            self._on_activity(user=True)
        elif isinstance(frame, UserStoppedSpeakingFrame):
            self._set_user_speaking(False)
            self._on_activity(user=True)  # give them thinking time from speech END
        if isinstance(frame, TranscriptionFrame) and frame.text and frame.text.strip():
            text = frame.text.strip()
            now = time.time()
            # Drop an identical repeat within 4s (greeting spam: "Hello" x3 while the
            # bot warms up/opens). Recorded once; repeats never reach the LLM, so the
            # model can't answer the same hello twice.
            ducked = self._duck is not None and self._duck.is_ducked()
            if (text.casefold() == self._last_text and now - self._last_text_t < 4.0
                    and self._bot_stopped_t() < self._last_text_t):
                logger.info("transcript dedupe: dropping repeat %r", text[:30])
                self._on_activity(user=True)
                # The words WERE heard — stamp transcript time so the VAD-orphan
                # can't treat a heard-and-dropped repeat as a swallowed utterance
                # and apologise "I couldn't hear you" (deep-review A1).
                self._on_transcript()
                if ducked:
                    # A dropped repeat must still release the held reply, or the
                    # duck sits until the watchdog timeout for no reason.
                    await self._on_absorb(None)
                return
            self._last_text = text.casefold()
            self._last_text_t = now
            self._outcome.transcript.append({"role": "user", "text": text})
            self._on_activity(user=True)
            if ducked:
                if text.startswith("["):
                    # Synthetic noise cue while a reply is held: just resume —
                    # there is nothing to answer and nothing worth interrupting.
                    self._on_transcript(backchannel=True)
                    await self._on_absorb(None)
                    return
                mid_reply = self._is_bot_speaking() or self._duck.has_pending_audio()
                if mid_reply and mid_reply_action(
                        text, extra_backchannels=self._backchannel_extra) == ABSORB:
                    # "Absorb but never lose" (founder decision 2026-08-05): the
                    # reply resumes mid-sentence AND the ack still reaches the
                    # LLM context — run_llm omitted, so no generation. The
                    # aggregator never sees this turn, so pipecat's min-words
                    # path cannot delete it (the ANSWER_DELETED mechanism).
                    self._on_transcript(backchannel=True)
                    logger.info("duck: absorbed backchannel %r — reply continues",
                                text[:30])
                    await self.push_frame(LLMMessagesAppendFrame(
                        messages=[{"role": "user", "content": text}]), direction)
                    await self._on_absorb(text)
                    return
                self._on_transcript()
                if mid_reply:
                    # Real barge-in. The line is ALREADY silent (ducked at VAD
                    # onset) — this makes it formal: cancels the in-flight
                    # generation, drops the held tail in DuckGate, clears
                    # Plivo's buffer, resets the aggregator. The transcript is
                    # then forwarded below as a fresh, normal turn.
                    logger.info("duck: real barge-in %r — interrupting reply",
                                text[:40])
                    await self.push_interruption_task_frame_and_wait()
                else:
                    # The reply finished while we were ducked (nothing held,
                    # bot quiet): this is just a normal turn — release the
                    # duck flag and let the aggregator answer it.
                    await self._on_absorb(None)
            else:
                self._on_transcript()
            # Filler only when the bot is quiet AND has spoken once already — a
            # barge-in has audio to cancel, and a filler before the opening meant
            # the first thing the caller ever heard was "Hmm…".
            if (self._filler_phrases and not self._is_bot_speaking()
                    and not (self._duck is not None and self._duck.is_ducked())
                    and self._fillers_armed()
                    and not text.startswith("[")     # synthetic cue, not real speech
                    and random.random() < self._filler_probability):
                await self.push_frame(
                    TTSSpeakFrame(random.choice(self._filler_phrases)), direction)
        await self.push_frame(frame, direction)


class PlayedTranscriptRecorder(FrameProcessor):
    """Sits AFTER transport.output(): records assistant speech from TTSTextFrames,
    which the transport releases at PLAYOUT position — i.e. text the caller
    actually HEARD. Replaces generation-time commits (deep-review A3): stalled or
    interrupted replies used to enter the transcript in full, so the disposition
    analyzer judged conversations that never happened (live 'Wrong_Number' on a
    caller who heard nothing) — while nudges/farewells/fillers the caller DID
    hear were never recorded (they ride TTSSpeakFrame, which also emits
    TTSTextFrames, so this captures them too). Consecutive assistant clauses
    merge into one transcript entry until a caller turn intervenes."""

    def __init__(self, outcome: CallOutcome):
        super().__init__()
        self._outcome = outcome

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, TTSTextFrame) and frame.text and frame.text.strip():
            t = self._outcome.transcript
            if t and t[-1]["role"] == "assistant":
                t[-1]["text"] = (t[-1]["text"] + " " + frame.text.strip()).strip()
            else:
                t.append({"role": "assistant", "text": frame.text.strip()})
        await self.push_frame(frame, direction)


class DuckGate(FrameProcessor):
    """Between TTS and transport.output(): instant-stop barge-in ("ducking").

    THE PROBLEM (founder, 2026-08-05: "when the human talks the bot takes ages
    to stop"): with interruption_strategies set, pipecat 0.0.95 defers ALL
    interruption handling to the user aggregator, which only decides after the
    caller's turn fully ENDS — utterance + VAD stop + STT final + aggregation
    wait ≈ 2.5-4s of the bot talking over the caller. And a turn under the word
    minimum is silently discarded (ANSWER_DELETED on 67% of calls).

    THE FIX: the moment the caller audibly starts speaking over a reply
    (UserStartedSpeakingFrame is a SystemFrame — it jumps every queue), this
    gate HOLDS the reply's frames instead of forwarding them to the transport.
    The transport paces audio in real time (write_audio_frame emulates an audio
    device), so holding here silences the line within one Plivo jitter buffer
    (~200-300ms). Then TranscriptCollector decides on the caller's words:
    backchannel → resume() (the reply continues mid-sentence, nothing lost);
    real speech → a formal InterruptionFrame arrives here and drops the held
    tail (the caller already heard silence, not talk-over). A voiced sound with
    no words at all (cough) is resumed by the watchdog's DUCK_RESUME.

    Holds LLMFullResponseStart/End and TTSStarted/Stopped ALONGSIDE audio and
    text deliberately: the assistant aggregator downstream brackets its context
    commit on those frames, and letting an End overtake its held text would
    commit an empty assistant turn (the A2 repeat class all over again).
    """

    _HOLDABLE = (TTSAudioRawFrame, TTSTextFrame, TTSStartedFrame, TTSStoppedFrame,
                 LLMFullResponseStartFrame, LLMFullResponseEndFrame)

    def __init__(self, enabled, is_bot_speaking, on_duck, on_unduck, diag):
        super().__init__()
        self._enabled = enabled
        self._is_bot_speaking = is_bot_speaking
        self._on_duck = on_duck
        self._on_unduck = on_unduck
        self._diag = diag
        self._held: deque = deque()
        self._ducked = False
        # Bumped on every duck/interrupt so a resume() that lost the race to a
        # NEW duck (system frames run out-of-band) stops flushing and stays held.
        self._gen = 0

    def is_ducked(self) -> bool:
        return self._ducked

    def has_pending_audio(self) -> bool:
        return bool(self._held)

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, InterruptionFrame):
            # The reply is formally dead — the held tail must never play.
            if self._held or self._ducked:
                logger.info("duck: interruption — dropping %d held frame(s)",
                            len(self._held))
            self._held.clear()
            self._gen += 1
            if self._ducked:
                self._ducked = False
                self._on_unduck()
            await self.push_frame(frame, direction)
            return
        if isinstance(frame, UserStartedSpeakingFrame):
            if (self._enabled() and not self._ducked
                    and (self._is_bot_speaking() or self._held)):
                self._ducked = True
                self._gen += 1
                self._diag.bump("ducks")
                self._on_duck()
                logger.info("duck: caller speaking over reply — holding bot audio")
            await self.push_frame(frame, direction)
            return
        if isinstance(frame, EndFrame) and (self._ducked or self._held):
            # A graceful stop is draining the pipeline; a held farewell must
            # play BEFORE the line closes, not be leapfrogged by the EndFrame.
            await self.resume("end_frame")
            await self.push_frame(frame, direction)
            return
        if (self._ducked and direction == FrameDirection.DOWNSTREAM
                and isinstance(frame, self._HOLDABLE)):
            self._held.append(frame)
            return
        await self.push_frame(frame, direction)

    async def resume(self, reason: str = ""):
        """Release the held reply, in order. Safe to call when not ducked."""
        if not self._ducked and not self._held:
            return
        gen = self._gen
        n = 0
        while self._held and self._gen == gen:
            await self.push_frame(self._held.popleft(), FrameDirection.DOWNSTREAM)
            n += 1
        if self._gen == gen and self._ducked:
            self._ducked = False
            self._on_unduck()
        logger.info("duck: resumed (%s) — released %d held frame(s)", reason, n)


class TtfbObserver:
    """Corr-tagged per-turn latency telemetry. pipecat already computes per-service
    TTFB (enable_metrics=True) but only logs it uncorrelated at DEBUG inside the
    metrics module — useless for 'which call was slow'. This observer logs one INFO
    line per service per turn tagged with the call corr, so 'replies were slow on
    that call' is answerable from docker logs:  grep 'ttfb corr=<id>'."""

    def __init__(self, corr: str, diag=None):
        from pipecat.observers.base_observer import BaseObserver

        outer = self

        class _Obs(BaseObserver):
            async def on_push_frame(self, data):
                try:
                    from pipecat.frames.frames import MetricsFrame
                    from pipecat.metrics.metrics import TTFBMetricsData
                    if isinstance(data.frame, MetricsFrame):
                        # The SAME frame object is observed once per pipeline hop
                        # (~9x) — dedupe by object id or we log 9 duplicate lines
                        # per metric (measured 3.3k lines/day; real CPU on 1 vCPU).
                        fid = id(data.frame)
                        if fid in outer._seen:
                            return
                        outer._seen.append(fid)
                        if len(outer._seen) > 64:
                            outer._seen.pop(0)
                        for d in data.frame.data:
                            if isinstance(d, TTFBMetricsData) and d.value:
                                logger.info("ttfb corr=%s service=%s value=%.3f",
                                            outer._corr, d.processor, d.value)
                                # Same numbers, now CARRIED (not just logged) so
                                # "replies were slow on that call" is answerable
                                # from the UI instead of docker logs.
                                proc = (d.processor or "").lower()
                                if outer._diag is not None:
                                    # ORDER MATTERS: "ResilientSarvamSTTService"
                                    # lowercases to "...sarvamsttservice", which
                                    # CONTAINS the substring "tts" (s-TTS-ervice).
                                    # Testing "tts" first filed every STT latency
                                    # into the TTS bucket and produced a false
                                    # SLOW_TTS on a live call. "ttsservice" never
                                    # contains "stt", so checking stt first is
                                    # unambiguous both ways.
                                    if "stt" in proc:
                                        outer._diag.sample("stt_ttfb", d.value)
                                    elif "tts" in proc:
                                        outer._diag.sample("tts_ttfb", d.value)
                                    elif "llm" in proc or "vertex" in proc or "google" in proc:
                                        outer._diag.sample("llm_ttfb", d.value)
                except Exception:
                    pass

        self._corr = corr
        self._seen: list = []
        self._diag = diag
        self.observer = _Obs()


class SentinelGate(FrameProcessor):
    """Between LLM and TTS: strips the steering markers from the token stream so
    they are never spoken, accumulates the assistant transcript one utterance at
    a time, tracks bot-speaking state for the idle watchdog, and stops the
    pipeline after the final utterance finished playing."""

    def __init__(self, outcome: CallOutcome, on_activity, set_bot_speaking,
                 transfer_closing: str = "Ek moment, main aapko connect kar rahi hoon.",
                 end_closing: str = "Theek hai, dhanyavaad. Aapka din shubh ho!",
                 transfer_fail_closing: str = ("Mujhe abhi connect karne mein dikkat aa "
                                               "rahi hai — hamare counsellor aapko jald "
                                               "call karenge. Dhanyavaad!")):
        super().__init__()
        self._outcome = outcome
        self._on_activity = on_activity
        self._set_bot_speaking = set_bot_speaking
        self._transfer_closing = transfer_closing
        self._end_closing = end_closing
        self._transfer_fail_closing = transfer_fail_closing
        self._transfer_fallback_done = False
        self._task: Optional[PipelineTask] = None
        # run_bot injects _begin_stop so sentinel-initiated stops arm the SAME
        # graceful-stop deadline as watchdog stops (deep-review A6/F2: raw
        # stop_when_done left the drain starvable forever).
        self._arm_stop = None
        self._buffer = ""          # marker hold-back across token chunks
        self._utterance = ""       # current assistant utterance (one transcript entry)
        self._spoke_this_response = False
        self._response_active = False  # LLM tokens still streaming for this response
        # A2 shield: a barge-in DURING streaming cancels the LLM task, but its
        # finally-block still emits an orphan LLMFullResponseEndFrame. Downstream,
        # pipecat 0.0.95's assistant aggregator decrements its _started counter
        # for EVERY End it sees — the interruption already reset it to 0, so the
        # orphan End underflows it to -1 and ALL later assistant text is silently
        # dropped from the model's context (verbatim repeats / re-asking, deep-
        # review A2, verified against the wheel). Swallow exactly that one End.
        self._swallow_next_end = False
        # Injected by run_bot: disarms the audio-stall stamp when a reply dies
        # before playout (see the InterruptionFrame branch).
        self._on_interrupted_cb = None
        # Per-response end latch; promoted to outcome.end_requested only when the
        # response ENDS, so a marker seen mid-stream cannot make a later,
        # unrelated response close the call.
        self._end_this_response = False
        # True once the line is genuinely closing. After this an end intent can no
        # longer be revoked.
        self._stop_armed = False
        self._defer_stop_cb = None
        self._clear_end_pending_cb = None

    def set_task(self, task: PipelineTask):
        self._task = task

    def set_arm_stop(self, arm_stop):
        self._arm_stop = arm_stop

    def set_on_interrupted(self, cb):
        self._on_interrupted_cb = cb

    def set_end_hooks(self, defer_stop, clear_end_pending):
        """Wire the revocable close: defer_stop starts the grace, and
        clear_end_pending cancels it when the caller re-engages."""
        self._defer_stop_cb = defer_stop
        self._clear_end_pending_cb = clear_end_pending

    def _defer_stop(self) -> None:
        if self._defer_stop_cb is not None:
            try:
                self._defer_stop_cb()
            except Exception:
                logger.exception("sentinel: defer-stop hook failed")
        elif self._task is not None:
            # No hook wired (older caller): fall back to the old immediate close
            # rather than never closing at all.
            self._stop_armed = True

    def _clear_end_pending(self) -> None:
        if self._clear_end_pending_cb is not None:
            try:
                self._clear_end_pending_cb()
            except Exception:
                pass

    def _on_interrupted(self) -> None:
        if self._on_interrupted_cb is not None:
            try:
                self._on_interrupted_cb()
            except Exception:
                logger.exception("sentinel: on_interrupted callback failed")

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, InterruptionFrame):
            if self._response_active:
                # The LLM task is being cancelled mid-stream; its finally will
                # still emit one orphan End — mark it for swallowing (A2).
                self._swallow_next_end = True
            # Stale hold-back/utterance from the aborted response must not bleed
            # into the next one (deep-review B6).
            self._buffer = ""
            self._response_active = False
            # Disarm the audio-stall stamp. It is otherwise cleared ONLY on a
            # bot-speaking transition (set_bot_speaking), so a reply killed
            # BEFORE playout — no BotStarted, no BotStopped — leaves it armed and
            # the watchdog "recovers" by re-speaking a reply the caller
            # deliberately interrupted. 6-13% of generations die pre-playout.
            self._on_interrupted()
            await self.push_frame(frame, direction)
            return

        if isinstance(frame, LLMFullResponseStartFrame):
            # A bot generating a fresh reply is NOT closing. Live call ee8e2168:
            # the bot said goodbye, the caller re-engaged with "Yes, I can", the
            # bot asked "May I know a convenient date and time?" — and the stale
            # call-scoped end latch dropped the line before they could answer,
            # losing the booking. Revoke while the line is still open.
            if self._outcome.end_requested and not self._stop_armed:
                self._outcome.end_requested = False
                self._clear_end_pending()
                logger.info("sentinel: end intent superseded by a new response corr=%s",
                            self._outcome.corr)
            # A NEW response begins — any expected orphan End never arrived (or
            # was consumed upstream); swallowing this response's End instead
            # would corrupt the aggregator bracket the OTHER way.
            self._swallow_next_end = False
            await self.push_frame(frame, direction)
            return

        if isinstance(frame, LLMTextFrame):
            self._on_activity(user=False)
            self._response_active = True
            self._buffer += frame.text or ""
            if TRANSFER_MARKER in self._buffer:
                self._outcome.transfer_requested = True
                self._buffer = self._buffer.replace(TRANSFER_MARKER, "")
            if END_MARKER in self._buffer:
                # PER-RESPONSE latch. Promoted to outcome.end_requested only when
                # this response ENDS — a marker seen mid-stream must not make a
                # later, unrelated response close the call.
                self._end_this_response = True
                self._buffer = self._buffer.replace(END_MARKER, "")
            emit, self._buffer = self._split_safe(self._buffer)
            if emit:
                self._utterance += emit
                self._spoke_this_response = True
                await self.push_frame(LLMTextFrame(emit), direction)
            return

        if isinstance(frame, LLMFullResponseEndFrame):
            # A leftover hold-back can only be a partial marker prefix (e.g. a
            # max_tokens cutoff mid-"<<END_CA") — never speak it; treat a partial
            # END prefix as intent to end so the call can't stall.
            if self._buffer:
                logger.info("sentinel: dropping partial marker tail %r corr=%s",
                            self._buffer, self._outcome.corr)
                if self._buffer.startswith("<<T"):
                    # A max_tokens cut mid-"<<TRANSFER>>" is a request for a HUMAN —
                    # ending instead hung up on exactly the callers who asked for one.
                    self._outcome.transfer_requested = True
                elif self._buffer.startswith("<<"):
                    self._end_this_response = True
                self._buffer = ""
            if self._end_this_response:
                self._outcome.end_requested = True
                self._end_this_response = False
            self._response_active = False
            self._flush_utterance()
            if self._swallow_next_end:
                # The orphan End of an interrupted stream — local bookkeeping done
                # above; do NOT push it downstream (A2 underflow shield). An
                # interrupted response must also never drive the marker-only
                # close, and its spoke-flag must not leak into the next response.
                self._swallow_next_end = False
                self._spoke_this_response = False
                logger.info("sentinel: swallowed orphan response-End after interruption corr=%s",
                            self._outcome.corr)
                return
            await self.push_frame(frame, direction)
            # Marker-only response (nothing spoken): no BotStoppedSpeakingFrame
            # will ever arrive, so speak a short close to drive the stop path.
            if ((self._outcome.end_requested or self._outcome.transfer_requested)
                    and not self._spoke_this_response):
                closing = (self._transfer_closing if self._outcome.transfer_requested
                           else self._end_closing)
                self._utterance = closing
                self._spoke_this_response = True
                self._flush_utterance()
                await self.push_frame(TTSSpeakFrame(closing), direction)
            self._spoke_this_response = False
            return

        if isinstance(frame, BotStartedSpeakingFrame):
            self._set_bot_speaking(True)
            self._on_activity(user=False)
            await self.push_frame(frame, direction)
            return

        if isinstance(frame, BotStoppedSpeakingFrame):
            self._set_bot_speaking(False)
            self._on_activity(user=False)
            # Don't flush while LLM tokens are still streaming: a filler's playout
            # ending mid-response used to split ONE sentence across two transcript
            # entries ('...क्या' / 'यह दो मिनट...') — audio was continuous, only the
            # saved transcript fractured. Flush happens at LLMFullResponseEndFrame.
            if not self._response_active:
                self._flush_utterance()
            await self.push_frame(frame, direction)
            if self._outcome.transfer_requested and not self._outcome.transfer_registered:
                await self._register_handoff()
                if (not self._outcome.transfer_registered
                        and not self._transfer_fallback_done):
                    # Handoff registration failed (admin_core down / no target):
                    # do NOT end on an unfulfilled "connecting you now" — promise a
                    # callback instead, then close on that farewell's BotStopped.
                    self._transfer_fallback_done = True
                    self._outcome.transfer_requested = False
                    self._outcome.end_requested = True
                    logger.warning("sentinel: handoff failed — speaking callback fallback corr=%s",
                                   self._outcome.corr)
                    self._utterance = self._transfer_fail_closing
                    self._spoke_this_response = True
                    self._flush_utterance()
                    await self.push_frame(TTSSpeakFrame(self._transfer_fail_closing), direction)
                    return
            if self._outcome.transfer_requested and self._task:
                # Transfer closes immediately — the caller is waiting to be put
                # through, and a grace period here is dead air.
                logger.info("sentinel: stopping call corr=%s (transfer=True)",
                            self._outcome.corr)
                self._stop_armed = True
                if self._arm_stop is not None:
                    await self._arm_stop()
                else:
                    await self._task.stop_when_done()
            elif self._outcome.end_requested and self._task and not self._stop_armed:
                # The farewell has finished playing. Hold the line open briefly:
                # the watchdog closes it after end_grace_secs, and ANY real word
                # from the caller cancels the close instead (on_transcript).
                logger.info("sentinel: farewell played — closing after grace corr=%s",
                            self._outcome.corr)
                self._defer_stop()
            return

        await self.push_frame(frame, direction)

    def _flush_utterance(self):
        # Transcript commits moved to PlayedTranscriptRecorder (playout-ordered,
        # played-text-only — deep-review A3). The utterance accumulator remains
        # only as marker bookkeeping; clear it each response.
        self._utterance = ""

    async def _register_handoff(self):
        numbers = (self._outcome.context.get("handoff") or {}).get("numbers") or []
        if not numbers:
            logger.warning("transfer requested but no handoff target corr=%s", self._outcome.corr)
            return
        try:
            registered = await asyncio.wait_for(
                admin_core.post_handoff(self._outcome.corr, numbers[0]), timeout=4.0)
        except asyncio.TimeoutError:
            logger.warning("handoff registration timed out corr=%s", self._outcome.corr)
            registered = None
        self._outcome.transfer_registered = registered is not None

    @staticmethod
    def _split_safe(buffer: str) -> tuple[str, str]:
        """Emit everything except a trailing prefix that might grow into a marker."""
        for marker in (END_MARKER, TRANSFER_MARKER):
            for i in range(min(len(marker) - 1, len(buffer)), 0, -1):
                if buffer.endswith(marker[:i]):
                    return buffer[:-i], buffer[-i:]
        return buffer, ""


# Sarvam Bulbul voices → grammatical gender. Hindi/Hinglish first-person verbs are
# gendered, so a female voice saying masculine "kar raha hoon" is the #1 immersion
# breaker on Indian calls. We know the voice, so we pin the grammar to match it.
# Union across Bulbul versions (a name's gender doesn't change between versions, and
# there's no male/female name collision), so a voice picked from ANY version's palette
# is classified right. bulbul:v3 male speakers must be here or a v3 male voice would
# be spoken with FEMALE grammar (the bug this set exists to prevent).
_MALE_VOICES = {
    # bulbul:v3 male
    "shubh", "aditya", "rahul", "rohan", "amit", "dev", "ratan", "varun", "manan",
    "sumit", "kabir", "aayan", "ashutosh", "advait", "anand", "tarun", "sunny", "mani",
    "gokul", "vijay", "mohit", "rehan", "soham",
    # bulbul:v2 male
    "abhilash", "karun", "hitesh",
    # bulbul:v1 male (legacy)
    "amol", "amartya", "arvind", "neel", "vian",
    # Rumik Silk Mulberry 1.5 male presets. These MUST be here: this set is the
    # only thing that makes the LLM write masculine Hindi verb endings, and a
    # Rumik agent on "adam" would otherwise say "kar rahi hoon" in a male voice.
    "lucas", "noah", "theo", "adam",
}

# Rumik Mulberry 1.5 female presets, kept explicit rather than inferred from the
# male set's complement — _voice_gender defaults unknown names to female, so an
# unlisted female voice is harmless, but naming them documents the real palette
# for the picker and catches a typo'd voice at review time.
_RUMIK_FEMALE_VOICES = {
    "emma", "mia", "sophia", "ava", "ira", "siya", "aisha", "zoya",
}
_RUMIK_MALE_VOICES = {"lucas", "noah", "theo", "adam"}
RUMIK_VOICES = _RUMIK_FEMALE_VOICES | _RUMIK_MALE_VOICES


def _default_voice_for(agent) -> str:
    """Provider default voice — both are female, so grammar stays feminine."""
    return "ira" if _agent_tts_model(agent).startswith(("rumik", "silk")) else "priya"


def _voice_gender(voice) -> str:
    return "male" if (voice or "priya").strip().lower() in _MALE_VOICES else "female"


def _agent_tts_model(agent) -> str:
    """Which TTS vendor this agent speaks through.

    Explicit agent config wins; otherwise the env default. Institutes created
    before the picker existed have no tts_model, and they are billed at the
    Sarvam rate, so they must KEEP Sarvam — silently moving a paying institute
    to a different-sounding voice is not a config change, it is a product change.
    """
    m = (agent.get("tts_model") or "").strip().lower()
    return m or get_settings().tts_model


def _agent_voice(agent):
    """The configured voice, dropped if it belongs to the other vendor's palette.

    Voice names do not cross vendors, and the two engines fail DIFFERENTLY when you
    send the wrong one (both probed against the live APIs):

      * Sarvam REJECTS an unknown speaker outright ("Speaker 'x' is not compatible
        with model bulbul:v3", HTTP 400) — so a Rumik name on a Sarvam agent means
        no audio at all.
      * Rumik SILENTLY SUBSTITUTES its default voice. It returned 184 KB of clean
        audio for "priya". So the call is not mute — it is worse in a quieter way:
        the caller hears a voice nobody chose, and because the LLM's Hindi verb
        gender was conjugated for the CONFIGURED voice, a male-configured agent can
        end up speaking masculine Hindi in a female voice.

    Either way the stored name is not usable, so fall back to the provider default,
    which at least keeps voice and grammar consistent with each other.
    """
    voice = (agent.get("voice") or "").strip()
    if not voice:
        return None
    is_rumik = _agent_tts_model(agent).startswith(("rumik", "silk"))
    if is_rumik and voice.lower() not in RUMIK_VOICES:
        return None
    if not is_rumik and voice.lower() in RUMIK_VOICES:
        return None
    return voice


def _as_float(v) -> float | None:
    """Tolerant numeric read for call-context JSON (numbers arrive as int/float/str)."""
    if v is None:
        return None
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


# The agent's configured "language" (a UI value like "hinglish") → a Sarvam STT
# BCP-47 tag to PIN transcription, plus a human label for the prompt. Pinning matters:
# auto-detect drifts a Hindi/Hinglish caller into a neighbouring Indic language
# (Punjabi/Marathi), and once a turn is transcribed as that, the LLM replies and the
# TTS speaks it for the rest of the call. Hinglish pins to hi-IN — saarika still
# transcribes the English words in a Hinglish sentence, it just never leaves Hindi.
_STT_LANGS = {
    "hinglish": ("hi-IN", "Hindi or Hinglish"),
    "hindi": ("hi-IN", "Hindi"),
    "english": ("en-IN", "English"),
    "punjabi": ("pa-IN", "Punjabi"),
    "marathi": ("mr-IN", "Marathi"),
    "gujarati": ("gu-IN", "Gujarati"),
    "bengali": ("bn-IN", "Bengali"),
    "tamil": ("ta-IN", "Tamil"),
    "telugu": ("te-IN", "Telugu"),
    "kannada": ("kn-IN", "Kannada"),
    "malayalam": ("ml-IN", "Malayalam"),
    # Sarvam spells Odia "od-IN", NOT the ISO "or-IN" — verified against the
    # SDK's own Literal. The ISO form is rejected, so Odia agents failed.
    "odia": ("od-IN", "Odia"),
    "oriya": ("od-IN", "Odia"),
}


def _agent_stt_mode(agent) -> str:
    """Sarvam saaras `mode` for this agent.

    codemix keeps a Hinglish caller's code-switched words as they were spoken.
    The alternatives both lose information: transcribe with a hi-IN pin turned
    ENGLISH callers into Devanagari ("इफ यू रिकॉर्ड योर नेम"), and translate
    forces everyone into English so the model can no longer tell what language
    the caller actually used.
    """
    raw = (agent.get("language") or "").strip().lower()
    return "codemix" if raw in ("hinglish", "hindi-english", "hi-en") else "transcribe"


def _agent_language(agent) -> tuple[str | None, str]:
    """(BCP-47 STT tag or None, human label). None ⇒ let build_stt use its env default."""
    raw = (agent.get("language") or "").strip().lower()
    if not raw:
        return None, "Hindi or Hinglish"
    if raw in _STT_LANGS:
        return _STT_LANGS[raw]
    if "-" in raw and len(raw) <= 6:  # already a tag like "hi-in"
        parts = raw.split("-")
        return f"{parts[0]}-{parts[1].upper()}", agent.get("language")
    return None, agent.get("language")


def _lead_fields_line(context: Dict[str, Any]) -> str:
    """One prompt line listing the lead's captured form/custom fields, so the agent uses
    what it already knows (company, role, …) instead of re-asking. Capped so a lead with
    many fields can't blow up the prompt. Empty for unknown callers."""
    fields = context.get("leadFields") or {}
    if not isinstance(fields, dict) or not fields:
        return ""
    pairs = [f"{k}: {v}" for k, v in fields.items() if v and str(v).strip()][:15]
    if not pairs:
        return ""
    return ("What you ALREADY KNOW about this person (from the form they filled — use it to "
            "personalise, and do NOT ask again for anything already listed here): "
            + "; ".join(pairs) + ".")


_PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_ ]+?)\s*\}\}")

# Author-written placeholder names -> the lead-field names they should resolve
# against. EXACT alias match only (never fuzzy): a wrong name in a sentence is
# worse than a neutral one. Key = the field names to look up, value = the
# {{placeholders}} that mean it.
_PLACEHOLDER_SYNONYMS: Dict[tuple, set] = {
    ("child name", "children name", "student name", "kid name", "child"): {
        "child_name", "children_name", "student_name", "kid_name", "child",
        "childs_name", "child name", "student name",
    },
    ("parent name", "guardian name", "father name", "mother name"): {
        "parent_name", "guardian_name", "father_name", "mother_name",
        "parent name", "guardian name",
    },
}

# The lead IS the parent on these campaigns, so these may fall back to leadName.
# Deliberately NOT every *_name key — see _fill_placeholders step 3.
_PARENT_ALIASES = {
    "parent_name", "guardian_name", "parent name", "guardian name", "contact_name",
}


def _lead_field(context: Dict[str, Any], *names: str) -> str | None:
    """First non-blank lead custom field matching any of `names` (case-insensitive)."""
    fields = context.get("leadFields") or {}
    wanted = {n.strip().lower() for n in names}
    for k, v in fields.items():
        if str(k).strip().lower() in wanted and v is not None and str(v).strip():
            return str(v).strip()
    return None


def _fill_placeholders(text: str, context: Dict[str, Any], sink=None) -> str:
    """Substitute the author's {{placeholders}} with real call values BEFORE the model
    sees the prompt. Left literal, `{{institute_name}}` etc. reach the model, which then
    improvises or fills them wrong (observed: {{institute_name}} became our account's
    legal name, not the brand). Unknown/empty → a graceful neutral, never a literal
    '{{...}}'. NOTE: {{institute_name}} is the PROSPECT's institute — deliberately NOT
    our instituteName (that mash-up is what produced the wrong-company opening)."""
    if not text or "{{" not in text:
        return text
    lead_name = context.get("leadName")
    agent_cfg = context.get("agent") or {}
    values = {
        "lead_name": lead_name or "aap",
        "name": lead_name or "aap",
        "institute_name": _lead_field(context, "institute", "institute name", "company",
                                      "organisation", "organization") or "aapke institute",
        "lead_source": _lead_field(context, "source", "lead source", "lead_source",
                                   "enquiry source") or "apni enquiry",
        "lead_source_line": "",
        "booked_slot": _lead_field(context, "slot", "booked slot", "demo slot") or "",
    }
    # Date/time placeholders. A live agent's prompt used {{day}}, {{date}} and
    # {{time}} and every one rendered EMPTY (seen in a real call's diagnostics:
    # promptUnfilled ["day","date","time"]) — so the model was handed blanks
    # exactly where it needed to know "now", which is what the booking flow
    # depends on to resolve "tomorrow". Same tz rule as _now_line: the agent's
    # configured timezone, else Asia/Kolkata.
    _tz = (agent_cfg.get("timezone") or context.get("timezone") or "Asia/Kolkata").strip()
    try:
        _now = datetime.now(ZoneInfo(_tz))
    except Exception:
        _now = datetime.now(ZoneInfo("Asia/Kolkata"))
    values.update({
        "day": _now.strftime("%A"),
        "today": _now.strftime("%A, %-d %B %Y"),
        "date": _now.strftime("%-d %B %Y"),
        "time": _now.strftime("%-I:%M %p"),
        "datetime": _now.strftime("%A, %-d %B %Y, %-I:%M %p"),
        "now": _now.strftime("%A, %-d %B %Y, %-I:%M %p"),
        "tomorrow": (_now + timedelta(days=1)).strftime("%A, %-d %B %Y"),
        "year": _now.strftime("%Y"),
        "month": _now.strftime("%B"),
    })

    def repl(m: "re.Match[str]") -> str:
        key = m.group(1).strip().lower()
        # 1) A known key.
        if key in values:
            return values[key]
        # 2) The author's own field name, matched against the lead's captured
        #    fields (casefold + '_'<->' '), plus the common name synonyms. This is
        #    the fix for a 100% silent failure: the whitelist previously returned
        #    "" for ANY unknown key, so a prompt written with {{child_name}} /
        #    {{parent_name}} rendered as "with , whose child  studies" on all
        #    141/141 calls of that agent (2026-07-29 forensics).
        direct = _lead_field(context, key, key.replace("_", " "))
        if direct:
            return direct
        for canon, aliases in _PLACEHOLDER_SYNONYMS.items():
            if key in aliases:
                hit = _lead_field(context, *canon)
                if hit:
                    return hit
                break
        # 3) The person we are CALLING is the parent/guardian, so an unresolved
        #    {{parent_name}} is the lead themselves. Scoped to this alias set on
        #    purpose — a blanket "*name -> lead_name" would also fire for
        #    {{school_name}} / {{child_name}} and speak the wrong person's name.
        if key in _PARENT_ALIASES and lead_name:
            return lead_name
        # 4) Give up — but LOUDLY, so this can never be silent again.
        #    NO generic "*name -> lead_name" fallback: `endswith("name")` also
        #    matches {{school_name}}, {{agent_name}}, {{child_name}}, so an
        #    unresolved key would make the bot call the SCHOOL (or the child) by
        #    the parent's name. A hole in the sentence is bad; confidently
        #    speaking the wrong person's name is worse.
        logger.warning("prompt placeholder %r unresolved — rendering empty", key)
        # `sink` is passed per-call (never a module global): up to 10 calls run
        # concurrently in one process and a shared buffer would cross-contaminate.
        if sink is not None:
            try:
                sink(key)
            except Exception:
                pass
        return ""

    return _PLACEHOLDER_RE.sub(repl, text)


def _clean_opening(text: str) -> str:
    """Sanitize an authored openingLine for SPEECH. Admins paste whole script blocks
    into the field (observed live: '# VACADEMY AI – INTRODUCTION SPEECH', blank lines,
    '(Wait for confirmation)') and TTSSpeakFrame reads every character aloud. Keep only
    speakable words: drop markdown headings, stage directions (lines fully wrapped in
    brackets), and markdown emphasis; collapse whitespace."""
    if not text:
        return ""
    lines = []
    for raw in text.splitlines():
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if (line.startswith("(") and line.endswith(")")) or            (line.startswith("[") and line.endswith("]")):
            continue  # stage direction, not speech
        lines.append(line)
    out = " ".join(lines)
    out = out.replace("**", "").replace("*", "").replace("`", "")
    out = re.sub(r"\s+", " ", out).strip()
    # Authors wrap the line in quotes ('"Hi, this is Avni…"'). Spoken, a stray
    # quote is at best silent; worse, a clause that ends up holding ONLY the
    # closing quote is rejected by Sarvam and wedges the TTS socket open-but-dead
    # (see providers.has_word_char). Strip a matched wrapping pair, then any
    # leftover edge quotes.
    if len(out) >= 2 and out[0] in '"“”‘’\'' and out[-1] in '"“”‘’\'':
        out = out[1:-1].strip()
    out = out.strip('"“”‘’\'').strip()
    return out[:600]


def _now_line(context: Dict[str, Any]) -> str:
    """A prominent 'right now it is ...' line so the model can resolve relative dates
    ('tomorrow', 'day after', 'next Monday') the caller mentions. Without it the LLM
    has NO idea what today is and mis-schedules. Timezone: the agent's configured
    tz if set, else Asia/Kolkata (all current calls are India). Computed fresh per
    call so it never goes stale."""
    agent = context.get("agent") or {}
    tzname = (agent.get("timezone") or context.get("timezone") or "Asia/Kolkata").strip()
    try:
        now = datetime.now(ZoneInfo(tzname))
    except Exception:
        tzname = "Asia/Kolkata"
        now = datetime.now(ZoneInfo(tzname))
    # e.g. "Wednesday, 22 July 2026, 3:45 PM"
    stamp = now.strftime("%A, %-d %B %Y, %-I:%M %p")
    return (
        f"RIGHT NOW it is {stamp} ({tzname}). Use this as the current date and time. "
        "When the caller mentions a relative day — 'today', 'tomorrow', 'day after tomorrow', "
        "'this weekend', 'next Monday' — work out the ACTUAL calendar date from this, and when "
        "you confirm a time say the concrete day and date (e.g. 'tomorrow, Thursday the 23rd, at 3 PM'). "
        "Never guess the day of week or the date."
    )


def build_system_prompt(context: Dict[str, Any], sink=None) -> str:
    agent = context.get("agent") or {}
    lead_name = context.get("leadName")
    extraction = agent.get("extractionQuestions") or []
    dispositions = agent.get("dispositions") or []
    name = agent.get("name") or "the assistant"
    stt_tag, lang_label = _agent_language(agent)
    is_english = stt_tag == "en-IN"
    # _agent_voice, not agent["voice"]: if the name was dropped as belonging to
    # the other vendor we speak with the provider default, so the grammar has to
    # match THAT voice, not the discarded config.
    gender = _voice_gender(_agent_voice(agent) or _default_voice_for(agent))
    direction = str(context.get("direction") or agent.get("direction") or "OUTBOUND").upper()
    now_line = _now_line(context)

    if gender == "female":
        gender_line = (
            "You are a woman. When you speak Hindi or Hinglish, ALWAYS use FEMININE "
            "first-person verb forms for yourself — 'main kar rahi hoon', 'kar sakti hoon', "
            "'karungi', 'deti hoon', 'bataungi', 'samajh gayi' — and NEVER the masculine "
            "forms ('raha', 'sakta', 'karunga', 'deta', 'gaya'). Keep this consistent the whole call."
        )
    else:
        gender_line = (
            "You are a man. When you speak Hindi or Hinglish, ALWAYS use MASCULINE "
            "first-person verb forms for yourself — 'main kar raha hoon', 'kar sakta hoon', "
            "'karunga', 'deta hoon', 'samajh gaya' — and NEVER the feminine forms. "
            "Keep this consistent the whole call."
        )

    # SECOND-person agreement + HONORIFIC. Hindi addresses the LISTENER with gendered
    # forms ('aap kaisi hain' to a woman vs 'aap kaise hain' to a man), and the model's
    # reflex English honorific is 'sir' — wrong for a woman, the #1 gender complaint.
    # An explicit leadGender (resolved server-side from the user record, else the name)
    # wins; when it's UNKNOWN, forbid guessing a gendered honorific — use the name + 'ji'.
    lead_gender = str(context.get("leadGender") or "").strip().lower()
    if is_english:
        # English agents: the Hindi second-person grammar rules below would be an
        # unconditional instruction to speak Hindi ('aap kaise hain', name + 'ji') —
        # one of the two confirmed pushes that flipped English calls into Hindi.
        if lead_gender in ("female", "f", "woman"):
            addressee_line = ((f"{lead_name} is a woman" if lead_name else
                              "The person on the line is a woman")
                             + " — if you use an honorific, say 'ma'am', never 'sir'.")
        elif lead_gender in ("male", "m", "man"):
            addressee_line = ((f"{lead_name} is a man" if lead_name else
                              "The person on the line is a man")
                             + " — if you use an honorific, say 'sir', never 'ma'am'.")
        else:
            addressee_line = ("You do NOT know whether this person is a man or a woman "
                              "— never guess 'sir' or 'ma'am'; address them by "
                              + (f"name ({lead_name})" if lead_name else "name") + ".")
    elif lead_gender in ("female", "f", "woman"):
        who = f"{lead_name} is a WOMAN" if lead_name else "The person on the line is a WOMAN"
        addressee_line = (
            f"{who}. Use FEMININE second-person Hindi — 'aap kaisi hain', 'aap kya chahti hain', "
            "'aap bata sakti hain' — and, if you use an honorific, say 'ma'am' or "
            + (f"'{lead_name} ji'" if lead_name else "her name with 'ji'")
            + ". NEVER call her 'sir' and never use masculine forms for her."
        )
    elif lead_gender in ("male", "m", "man"):
        who = f"{lead_name} is a MAN" if lead_name else "The person on the line is a MAN"
        addressee_line = (
            f"{who}. Use MASCULINE second-person Hindi — 'aap kaise hain', 'aap kya chahte hain', "
            "'aap bata sakte hain' — and, if you use an honorific, say 'sir' or "
            + (f"'{lead_name} ji'" if lead_name else "his name with 'ji'")
            + ". Never use feminine forms for him."
        )
    else:
        addressee_line = (
            "You do NOT know whether this person is a man or a woman, so you MUST NOT guess a "
            "gendered honorific — NEVER say 'sir' or 'ma'am'. Address them by their name with 'ji' ("
            + (f"'{lead_name} ji'" if lead_name else "their name + ' ji'")
            + ") and use gender-neutral 'aap' forms ('aap kaise hain'). Only if they clearly reveal "
            "their gender by how they speak of themselves ('main aayi'/'karungi' = a woman, 'main "
            "aaya'/'karunga' = a man) may you switch to the matching feminine/masculine forms."
        )

    # Company identity comes from the AGENT'S OWN prompt (which names the brand it should
    # say, e.g. "Vacademy"). Do NOT also inject the institute's legal display name here — a
    # second, different company name ("Vidyayatan Technologies") makes the model mash the two
    # ("Vacancy"). Refer to it generically and let the prompt be the single source of the name.
    if direction == "INBOUND":
        intent_line = (
            "This person has CALLED your organisation. You are answering their call — greet them "
            "warmly, quickly find out why they called, and help them. Name your company EXACTLY as "
            "your instructions specify."
        )
    else:
        intent_line = (
            "You are PROACTIVELY CALLING this person — YOU placed this call, they did not call you. "
            "Never sound like you are answering their call. If they speak first (a 'hello'), your "
            "FIRST reply is your full opening — never a bare greeting word back. Open with a clear "
            "reason for calling, "
            "introduce yourself and your company EXACTLY as your instructions specify (never invent "
            "or alter the company name), lead the conversation confidently, and keep a warm, "
            "positive, forward-moving tone that gives them a reason to engage right now."
        )

    # Placed near the TOP (primacy matters under live-call latency) and applied to every
    # agent — the failure modes seen on real calls (verbatim loops, deflecting instead of
    # answering, ignoring rising frustration, ploughing on through mis-hears, switching
    # language unprompted) are conversation-level and no per-agent prompt reliably prevents
    # them. These are hard rules, phrased as mechanisms not vibes.
    non_negotiable = (
        "NON-NEGOTIABLE RULES — these override everything else:\n"
        "1) NEVER repeat a sentence you have already said. If the caller asks the same thing "
        "again, your previous answer FAILED — do NOT say it again. Acknowledge briefly ('Sorry, "
        "main clearly bata deti hoon —') and answer the LITERAL question they asked, even if it is "
        "outside your script. You may steer toward your goal (demo/next step) at most ONCE per "
        "topic; if they push again, ANSWER the question instead of steering.\n"
        "2) ANSWER direct questions directly FIRST, then invite the next step. Never stonewall or "
        "dodge (never say things like 'their strategy is different' to avoid answering). If you "
        "genuinely don't have a specific fact, say so honestly and offer to share it another way — "
        "do not invent, do not evade.\n"
        "3) FRUSTRATION = STOP. If the caller repeats a question, says 'main ye nahi pooch raha', or "
        "sounds annoyed: drop the script immediately, apologise briefly, and answer their exact "
        "question. If you cannot resolve it in one turn, offer a human callback rather than continuing.\n"
        "4) If the conversation stops making sense, or they seem to answer a different question than "
        "you asked, assume you MIS-HEARD: say 'Sorry, aapki awaaz thodi clear nahi aayi, ek baar phir "
        "boliye?' — do NOT plough ahead with your script.\n"
        f"5) Speak {lang_label} and STAY in it for the whole call. Every reply must be in the "
        f"same language and script as YOUR OWN previous turns — mirror yourself, not the "
        f"transcript. A single word from the caller in any other language ('yes', 'achha', "
        f"'haan') is NEVER a cue to switch; if a transcript looks like another language, treat "
        f"it as a mis-heard {lang_label} line. Switch only if the caller explicitly asks, or "
        f"speaks 3+ consecutive full sentences in the other language.\n"
        "6) End every turn with a question, a quick check-in ('right?') or a clear closing — "
        "then STOP COMPLETELY and wait for the caller's answer. NEVER answer your own question, "
        "NEVER say 'thank you' or continue as if they replied when they haven't. The caller's "
        "silence is NOT consent — wait for them.\n"
        "7) A neutral SPOKEN acknowledgment to your yes/no question ('okay', 'cool', 'hmm', "
        "'go ahead', 'haan', 'achha') means YES — move forward. Never re-ask a question you "
        "already asked, and never repeat any sentence verbatim; if you must clarify, rephrase "
        "it in under 8 words."
    )

    prompt = _fill_placeholders(agent.get("systemPrompt") or "", context, sink=sink)

    # Pieces the bot knows that NO agent prompt can — kept in BOTH paths:
    # the configured voice's grammatical gender, the TTS script rule (romanized Hindi
    # synthesizes worse than Devanagari — Sarvam docs), the live lead facts, and the
    # machine end/transfer MARKERS (the agent prompt has no idea these tokens exist).
    if is_english:
        script_rule = (
            "- SCRIPT: Write every reply in English (Latin letters) only. If you must echo an "
            "Indian-language word the caller used, keep it romanized in Latin letters — never "
            "switch to Devanagari or any Indic script."
        )
    else:
        script_rule = (
            "- SCRIPT: Write Hindi words in DEVANAGARI (हिंदी लिपि), and keep common English business "
            "words in English letters (demo, course, book, WhatsApp, offer, plan, confirm, link). "
            "So write 'मैं आपको एक demo book कर देती हूँ' — NOT romanized 'main aapko ek demo book kar "
            "deti hoon'. NEVER write Hindi words in Latin letters."
        )
    # The caller HEARS every character — markdown becomes spoken garbage (a live call
    # read out its own bullet list). And a short first clause reaches the ear sooner
    # (TTS synthesizes the first chunk while the rest streams).
    plain_speech_rule = (
        "- Speak plain text only: NEVER output markdown — no *, #, bullets, numbered lists or "
        "headings. No stage directions or parentheticals. Only words meant to be heard.\n"
        "- Write NUMBERS AS WORDS so they are spoken correctly: say 'a ten-minute demo' (not "
        "'10-minute'), 'two minutes', 'nine thirty', 'twenty five'. Digits like '10' get read "
        "out as 'one zero'. The ONLY exception is a phone number, which you read digit by digit."
    )
    fast_open_rule = (
        "- Keep the FIRST sentence of every reply short (a few words) so it reaches the "
        "caller fast — but make it SUBSTANCE, not a filler sound. Do NOT open replies with "
        "\u2018Hmm\u2019, \u2018Achha\u2019, \u2018Theek hai\u2019, \u2018Okay\u2019, \u2018Right\u2019 or similar acknowledgment noises "
        "more than about one reply in five — callers heard constant Hmm-ing as robotic. "
        "Usually answer directly: \u2018Haan, accommodation shivir mein hi hai\u2019 beats \u2018Achha. "
        "Toh accommodation\u2026\u2019."
    )
    # Live call went out in the evening but opened 'Good morning' — the authored script
    # hard-codes a greeting and nothing tied it to the clock. The RIGHT-NOW line above
    # gives the time; this makes the model USE it for the greeting, overriding a fixed one.
    greeting_rule = (
        "- GREET FOR THE CURRENT TIME shown above: say 'good morning' before 12 noon, "
        "'good afternoon' from 12 noon to 5 PM, and 'good evening' after 5 PM. If your "
        "scripted opening contains a fixed greeting, ADAPT it to the current time — never "
        "say 'good morning' in the afternoon or evening."
    )
    # Live call: the lead's real name was missing, so the model addressed the caller by the
    # AUDIENCE-LIST name ('Am I speaking with Mr. or Ms. Robotics STEM Programs for Schools?').
    name_sanity_rule = (
        "- NEVER say 'Mr.' or 'Ms.' with nothing (or a non-name) after it, and never invent a "
        "surname. If you do NOT have the person's real name — it is blank, a placeholder, the "
        "word 'hello', or looks like a company/program/list ('Robotics Programs for Schools', "
        "'AI and Machine Learning') — do NOT attempt 'Am I speaking with Mr./Ms. ___'. That "
        "produces a broken 'Mr. Hello' or a dangling 'Mr.'. Instead ask warmly 'May I know who "
        "I'm speaking with?' or confirm the organisation ('Am I speaking with someone from "
        "<org>?'). Only use 'Mr./Ms. <surname>' when you actually have a real surname."
    )
    # Live calls: the caller asked 'who are you?' / said 'we already spoke' and the agent
    # ignored it and ploughed the next scripted line. This forces a response FIRST.
    listen_rule = (
        "- LISTEN AND RESPOND to what the caller just said BEFORE moving to your next scripted "
        "line. If they ask 'who are you?', 'which company?', 'why are you calling?', 'where are "
        "you calling from?' — answer it plainly and immediately (your name, your company, one "
        "short reason), THEN continue. If they say you have ALREADY SPOKEN, 'we discussed this', "
        "or 'I explained already' — acknowledge it and do NOT repeat your introduction or pitch; "
        "pick up from there and ask what they'd like to do next. NEVER deliver the next script "
        "line as if the caller said nothing when they have just spoken."
    )
    # Live calls showed the model compressing several script steps into one turn
    # ("How are you? That's wonderful to hear." — answering its OWN question), and
    # closing on a vague "okay, thanks" with no day, no time, no contact captured.
    one_step_rule = (
        "- ONE STEP AT A TIME: if your instructions contain questions or steps, deliver "
        "exactly ONE question and then STOP — never answer your own question, never "
        "continue past a question mark in the same turn, never act out both sides. "
        "Break any long scripted passage into short turns (2-3 sentences), pausing for "
        "the caller between them."
    )
    goal_drive_rule = (
        "- SELL WITH INTENT — you are a sharp, warm salesperson working toward a goal "
        "(usually a short demo or meeting), NOT a passive form-filler. Tie your pitch to "
        "something the caller actually said (a pain, a tool they already use, their size) "
        "and lead with ONE crisp benefit, never a feature list.\n"
        "- DON'T ACCEPT THE FIRST BRUSH-OFF. Common deflections — 'just email me' / 'send a "
        "proposal' / 'we handle it ourselves' / 'we work directly' / 'not right now' / 'we're "
        "busy' — are not a no; they're a reflex. Acknowledge briefly, then redirect ONCE to "
        "value + a concrete small next step: a ten-minute demo at a specific time. Example — if "
        "they say 'email me the details', reply: 'Happy to — honestly it lands better as a "
        "quick 10-minute look so I show only what fits you. Would tomorrow evening or Thursday "
        "morning work?' Make ONE genuine, specific attempt like this. Only if they still "
        "decline do you take the email or a callback time gracefully and thank them.\n"
        "- CLOSE CONCRETELY: a vague acknowledgment ('okay', 'thanks', 'theek hai') is NOT a "
        "confirmation — when booking, propose two specific slots, get ONE explicitly confirmed "
        "(exact day + time), and confirm the contact channel (read a number back digit by "
        "digit). Never announce a meeting/demo as scheduled unless the caller named or accepted "
        "a specific day and time."
    )
    language_stability_rule = (
        "LANGUAGE STABILITY: every reply must be in the SAME language and script as YOUR OWN "
        "previous turns. One word from the caller in another language ('yes', 'achha', 'haan'), "
        "or one odd/garbled transcript line, is NEVER a cue to switch — treat it as a mis-hear. "
        "Switch languages only if the caller explicitly asks, or speaks 3+ consecutive full "
        "sentences in the other language. If your instructions define their own language "
        "rules, those take precedence."
    )
    lead_name_line = f"The caller's name is {lead_name}." if lead_name else ""
    fields_line = _lead_fields_line(context)
    end_line = (f"- When the conversation has reached a natural end, say a short goodbye and "
                f"append {END_MARKER}.")
    human_line = (
        f"- If the caller asks for a human, is upset, or you cannot help, say you are connecting "
        f"them and append {TRANSFER_MARKER}."
        if (context.get("handoff") or {}).get("enabled")
        else f"- If the caller asks for a human, say a counsellor will call them right back, "
             f"then append {END_MARKER}."
    )
    disposition_line = (("At the end you must be able to judge the caller's interest as one of: "
                         + ", ".join(dispositions)) if dispositions else "")

    # An agent whose author wrote a real prompt (opening choreography, identity rules,
    # language + conversation rules) is AUTHORITATIVE. Piling the generic scaffolding on
    # top DUPLICATES it and — via intent_line's "introduce yourself" vs a "confirm
    # identity first" prompt — CONTRADICTS it, which is what produced the double/triple
    # greeting on live calls. So defer: add ONLY the bot-only knowledge above, plus one
    # line telling the model its own instructions own the opening.
    if len(prompt.strip()) >= 600:
        lines = [
            prompt,
            "Your instructions above are AUTHORITATIVE for the opening, identity, language, "
            "pacing and conversation rules — follow them exactly. Greet and introduce yourself "
            "ONCE as they specify; never add a second greeting or re-introduce yourself. If the "
            "caller speaks first (a 'hello' or anything else), your FIRST reply IS your scripted "
            "opening — never reply with just a bare greeting word.",
            now_line,
            greeting_rule,
            name_sanity_rule,
            listen_rule,
            "End every turn with a question, a quick check-in (\u2018right?\u2019) or a clear closing — "
            "then STOP and wait for the caller\u2019s answer. Never answer your own question or "
            "continue as if they replied when they haven\u2019t; their silence is NOT consent.",
            "A neutral SPOKEN acknowledgment to your yes/no question (\u2018okay\u2019, \u2018cool\u2019, \u2018hmm\u2019, "
            "\u2018go ahead\u2019) means YES — move forward. Never re-ask a question you already asked, "
            "and never repeat any sentence verbatim; to clarify, rephrase in under 8 words.",
            language_stability_rule,
            f"{gender_line} {addressee_line}",
            script_rule,
            plain_speech_rule,
            fast_open_rule,
            one_step_rule,
            goal_drive_rule,
            lead_name_line,
            fields_line,
            end_line,
            human_line,
            disposition_line,
        ]
        return "\n".join(l for l in lines if l)

    # Thin / blank prompt → the full scaffolding it needs to behave at all.
    lines = [
        prompt or "You are a friendly, concise phone assistant.",
        non_negotiable,
        now_line,
        greeting_rule,
        name_sanity_rule,
        listen_rule,
        f"You are {name}. {gender_line}",
        addressee_line,
        intent_line,
        lead_name_line,
        fields_line,
        ("During the conversation, naturally find out: " + "; ".join(extraction))
        if extraction else "",
        "Rules:",
        "- 1-2 short sentences per reply. ONE question per turn. Never monologue.",
        script_rule,
        plain_speech_rule,
        fast_open_rule,
        one_step_rule,
        goal_drive_rule,
        ("- Mostly SKIP acknowledgment openers entirely and answer directly; when you do "
         "acknowledge, never use the same word twice in a row."),
        ("- Briefly reflect back the caller's specific point before you answer so they feel "
         "heard — not a generic 'I understand'."
         if is_english else
         "- Briefly reflect back the caller's specific point before you answer (e.g. 'अच्छा, आप "
         "timing को लेकर puchh rahe hain —') so they feel heard. Not a generic 'मैं समझती हूँ'."),
        "- Match the caller's energy: a brief, businesslike caller gets crisp efficiency; a "
        "chatty, warm caller gets a little more warmth. Don't be relentlessly peppy.",
        ("- Say clock times naturally in the 12-hour format — 'five PM', 'ten thirty AM'."
         if is_english else
         "- Clock times: ALWAYS the English 12-hour format — 'five PM', 'ten thirty AM', 'twelve "
         "noon', 'quarter past six'. NEVER the Hindi 'baje' form and NEVER a mix — 'five baje' and "
         "'paanch baje' are both WRONG; say 'five PM'."),
        "- Other numbers and money: whole spoken words in the sentence's one language, never spelled "
        "out digit-by-digit — 'do sau rupaye' / 'two hundred rupees' (NEVER 'two zero zero' or 'do "
        "zero zero'), 'pandrah tarikh'. Exception: a 10-digit phone number is read digit by digit.",
        end_line,
        human_line,
        disposition_line,
        f"IDENTITY LOCK (most important): your name is EXACTLY \"{name}\" — say it identically "
        f"every single time, and NEVER introduce yourself with any other name, spelling or "
        f"variation. Use the SAME company name you introduce yourself with for the whole call; "
        f"never change, translate or invent a different company name.",
    ]
    return "\n".join(l for l in lines if l)


async def run_bot(transport, corr: str, context: Dict[str, Any],
                  outcome: CallOutcome, *, aiohttp_session) -> CallOutcome:
    """Run one call end-to-end on an already-connected Plivo <Stream> transport.
    Mutates the caller-owned CallOutcome in place (crash-safe reporting)."""
    _run_bot_t0 = time.time()
    settings = get_settings()
    agent = context.get("agent") or {}

    # Idle/pacing state shared between the processors and the watchdog. The idle
    # clock only escalates while the bot is NOT speaking (TTS playout is real-time
    # and much slower than token generation), and only USER activity re-arms the
    # nudge — otherwise the nudge's own audio resets it and hangup never escalates.
    # Explicit state machine (see app/callstate.py — field docs + transition
    # contract live there; dict-style access kept for the frame callbacks).
    flags = CallState(t=time.time())
    # Per-call technical diagnostics. Pure counters; every hook below is cheap and
    # total (a diagnostics bug must never break a call). Carried to admin_core in
    # the end-of-call report so a bad call is a hover in the UI, not an SSH sweep.
    diag = diag_mod.CallDiagnostics()
    outcome.diagnostics = diag
    # Timestamps of orphan re-asks. A real transcript landing within 6s means we
    # apologised for something we HAD heard (the 72%-false-re-ask class).
    flags_orphan_marker: list = []

    def on_activity(user: bool = True):
        # VAD blips reset the idle CLOCK but no longer re-arm the nudge: on lines
        # with breathing/hold-music the re-arm made the hangup escalation
        # unreachable — the bot nudged every ~10s until the duration cap
        # (deep-review A10). Real words re-arm it in on_transcript below.
        flags["t"] = time.time()

    def set_bot_speaking(speaking: bool):
        if speaking:
            # Audio arrived after all: the reply was NOT lost. Clear the suspicion.
            flags["unplayed_pending_t"] = 0.0
        if speaking and not flags["bot_speaking"]:
            # Gap since either side last spoke = what the CALLER experienced as
            # silence. Measured on speech START only, so it is per-turn not
            # per-frame. The configured greet beat is recorded separately.
            _last = max(flags["bot_stopped_t"], flags["user_stopped_t"])
            if _last:
                diag.sample("dead_air", max(0.0, time.time() - _last))
            diag.bump("bot_turns")
        flags["bot_speaking"] = speaking
        # Clear the pending-audio stamp on BOTH transitions: audio starting means
        # no stall; audio STOPPING means the response played (a clause stamped
        # mid-playout must not read as "never heard" — the false-fire mechanism
        # behind the 2026-07-27 repeat-3x incident, deep-review B1).
        flags["tts_gen_t"] = 0.0
        if not speaking:
            flags["bot_stopped_t"] = time.time()
            flags["bot_spoke_once"] = True

    def set_user_speaking(speaking: bool):
        if speaking and not flags["user_speaking"]:
            _last = max(flags["bot_stopped_t"], flags["user_stopped_t"])
            if _last:
                diag.sample("dead_air", max(0.0, time.time() - _last))
            if flags["bot_speaking"]:
                diag.bump("barge_ins")
        elif not speaking and flags["user_speaking"]:
            _dur = time.time() - (flags["user_started_t"] or time.time())
            if _dur > diag.longest_user_secs:
                diag.longest_user_secs = _dur
        flags["user_speaking"] = speaking
        if speaking:
            flags["user_started_t"] = time.time()
        else:
            flags["user_stopped_t"] = time.time()

    stt_lang, _ = _agent_language(agent)
    # Operational utterances (nudge, closings, fillers) in the AGENT's language — an
    # English call getting a hardcoded Hindi "kya aap sun paa rahe hain?" both jars the
    # caller and hands the model a Hindi context line to drift onto.
    eng = stt_lang == "en-IN"
    nudge_text = ("Hello? Are you still there?" if eng
                  else "Hello? Kya aap sun paa rahe hain?")
    cap_farewell = ("I have to end the call now — our team will reach out to you shortly. "
                    "Thank you!" if eng else
                    "Mujhe ab call samaapt karni hogi. Hamari team aapse jald sampark karegi. "
                    "Dhanyavaad!")
    transfer_closing = ("One moment, connecting you now." if eng
                        else "Ek moment, main aapko connect kar rahi hoon.")
    idle_farewell = ("It seems I've lost you — I'll follow up shortly. Thank you, and have a "
                     "great day!" if eng else
                     "Lagta hai aapki awaaz nahi aa rahi — main baad mein sampark karti hoon. "
                     "Dhanyavaad, aapka din shubh ho!")
    # Honest, non-blaming, and it hands the caller a real next step instead of a
    # fourth apology (live call 393859bc).
    cant_hear_closing = (
        "I'm really sorry — I can hear you speaking but the line isn't carrying "
        "your words to me. Rather than keep asking you to repeat yourself, let me "
        "have someone from our team call you back. Thank you for your patience!"
        if eng else
        "Maaf kijiye — aap bol rahe hain lekin aapki awaaz mujh tak theek se nahi "
        "pahunch rahi. Baar baar poochhne se accha, main hamari team se aapko "
        "call back karwati hoon. Aapke sabr ke liye dhanyavaad!")
    end_closing = ("Alright, thank you. Have a great day!" if eng
                   else "Theek hai, dhanyavaad. Aapka din shubh ho!")
    # 'Hmm…' only — 'Right…'/'Okay…' sound like complete replies, and a filler that
    # reads as an answer right before a stall is worse than no filler (heard live).
    eng_fillers = ("Hmm…",)
    # Bias STT toward the agent's own name so a caller repeating it ("aapka naam Aarushi
    # tha?") isn't transcribed as "Aayushi"/"Aarush" and fed back into the LLM context as
    # a wrong name — the #1 way the agent "forgets" its name mid-call.
    stt_bias = (agent.get("name") or "").strip() or None
    stt = build_stt(settings.sample_rate, language=stt_lang, bias=stt_bias,
                    mode=_agent_stt_mode(agent))
    # Voiced-but-wordless caller turns ("hmm"/"okay" that STT finalizes EMPTY)
    # become a minimal synthetic backchannel so the conversation continues instead
    # of dead-airing (see ResilientSarvamSTTService._handle_message). Only while
    # the bot is quiet, and never in the opening seconds (greet owns those).
    _call_t0 = time.time()
    if hasattr(stt, "set_backchannel_gate"):
        stt.set_backchannel_gate(
            lambda: not flags["bot_speaking"] and time.time() - _call_t0 > 6.0)
    # to_thread: on Vertex the constructor performs a SYNCHRONOUS service-account
    # OAuth round-trip (~1-2s). Run per-call setup off the event loop so other
    # LIVE calls' audio doesn't glitch while this one dials (part of the measured
    # 3.2s StartFrame gap; lifespan pre-warm covers the import cost).
    llm = await asyncio.to_thread(build_llm)
    tts = build_tts(settings.sample_rate, voice=_agent_voice(agent),
                    aiohttp_session=aiohttp_session,
                    pace=_as_float(agent.get("pace")),
                    temperature=_as_float(agent.get("temperature")),
                    tts_model=_agent_tts_model(agent))
    # Audio-stall watchdog stamp: run_tts marks "audio pending"; BotStartedSpeaking
    # clears it. MUST be wired after tts exists (a pre-assignment hasattr(tts, …)
    # here crashed EVERY call with UnboundLocalError on 2026-07-27).
    for _svc in (stt, tts):
        if hasattr(_svc, "set_diagnostics"):
            _svc.set_diagnostics(diag)
    # Vendor cost, recorded from the vendor's own terminal frame. tts_vendor is
    # stamped unconditionally (both providers) so the panel always shows WHICH
    # engine spoke — that is the first question when a call sounds wrong.
    diag.tts_vendor = getattr(tts, "model_name", "") or type(tts).__name__
    if hasattr(tts, "set_credits_callback"):
        tts.set_credits_callback(
            lambda credits, secs, chars=0: diag.note_tts_spend(credits, secs, chars))
    if hasattr(tts, "set_generate_callback"):
        def _stamp_generate():
            # Only stamp while the bot is QUIET: a clause generated mid-playout is
            # part of an already-playing response, not a potentially-stalled one.
            if flags["tts_gen_t"] == 0.0 and not flags["bot_speaking"]:
                flags["tts_gen_t"] = time.time()
        tts.set_generate_callback(_stamp_generate)

    llm_context = LLMContext(
        messages=[{"role": "system", "content": build_system_prompt(context, sink=diag.note_unfilled)}]
    )
    aggregators = LLMContextAggregatorPair(
        llm_context,
        # Default 0.5s waits for late transcript fragments AFTER the VAD already
        # decided the turn ended — with Saaras finals typically beating the VAD
        # window, most of it is dead air the caller hears before every reply.
        user_params=LLMUserAggregatorParams(aggregation_timeout=settings.agg_timeout_secs),
    )

    def on_transcript(backchannel: bool = False):
        flags["transcript_t"] = time.time()
        # The caller re-engaged after our goodbye — do NOT hang up on them. Live
        # ee8e2168: "Yes, I can" arrived after the farewell and the line still
        # dropped mid-question, losing a demo booking. An ABSORBED backchannel
        # ("theek hai" spoken over the goodbye) is the opposite — acceptance —
        # and must not cancel the close.
        if not backchannel and flags["end_pending_since"] != 0.0:
            flags["end_pending_since"] = 0.0
            outcome.end_requested = False
            logger.info("sentinel: caller re-engaged after farewell — call continues corr=%s", corr)
        # We heard them: any run of unheard utterances is over.
        flags["deaf_streak"] = 0
        # Real words re-arm the one-shot orphan (see watchdog) AND the idle nudge.
        flags["orphan_used"] = False
        if not backchannel:
            flags["nudged"] = False

    # Instant barge-in ducking (see DuckGate). Constructed BEFORE
    # TranscriptCollector — the collector is the with-words decision point and
    # needs the gate's held/ducked state.
    def _on_duck():
        flags["ducked_since"] = time.time()

    def _on_unduck():
        flags["ducked_since"] = 0.0

    duck = DuckGate(enabled=lambda: settings.duck_enabled,
                    is_bot_speaking=lambda: flags["bot_speaking"],
                    on_duck=_on_duck, on_unduck=_on_unduck, diag=diag)

    async def _absorb(text):
        if text is not None:
            diag.bump("duck_absorbs")
        await duck.resume("backchannel" if text is not None else "no_content")

    transcript = TranscriptCollector(outcome, on_activity,
                                     is_bot_speaking=lambda: flags["bot_speaking"],
                                     set_user_speaking=set_user_speaking,
                                     filler_phrases=eng_fillers if eng else None,
                                     on_transcript=on_transcript,
                                     fillers_armed=lambda: flags["bot_spoke_once"],
                                     bot_stopped_t=lambda: flags["bot_stopped_t"],
                                     duck=duck, on_absorb=_absorb,
                                     backchannel_extra=settings.backchannel_extra)
    played_transcript = PlayedTranscriptRecorder(outcome)

    sentinel = SentinelGate(outcome, on_activity, set_bot_speaking,
                            transfer_closing=transfer_closing, end_closing=end_closing)

    pipeline = Pipeline([
        transport.input(),
        stt,
        transcript,
        aggregators.user(),
        llm,
        sentinel,
        tts,
        duck,
        transport.output(),
        played_transcript,
        aggregators.assistant(),
    ])

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            audio_in_sample_rate=settings.sample_rate,
            audio_out_sample_rate=settings.sample_rate,
            enable_metrics=True,
            # Barge-in: when the caller starts speaking, cancel the bot's TTS and let their
            # turn be heard — a real conversation, not the bot talking over an interrupting
            # caller. Was unset (no interruption), which caused the overlaps on live calls.
            allow_interruptions=True,
            # ...but require ≥2 words to interrupt, so a single stray sound, a cough, or a
            # backchannel ("haan", "hmm", "achha") does NOT cancel the bot mid-sentence and
            # derail it. A real correction (more words) still barges in immediately.
            interruption_strategies=[MinWordsInterruptionStrategy(min_words=2)],
        ),
        observers=[TtfbObserver(corr, diag).observer],
    )
    sentinel.set_task(task)

    async def _greet_when_ready():
        """Open the call like a person would. On OUTBOUND the callee has already said
        'hello' when they picked up, so we SPEAK FIRST after a short beat — long enough
        not to clip their 'hello', short enough to avoid the dead-air / 'double hello'
        that makes an agent feel robotic (the old 2s wait was the culprit). If the callee
        says something substantive in that beat (e.g. 'kaun?'), their turn drives the
        LLM's reply and we don't also open. flags['t'] advances on the first transcribed
        user speech, so t > connect_t means the callee spoke.

        The opening itself: if the agent set an explicit openingLine, speak it verbatim
        (instant, pre-scripted — good for a fixed compliance line). Otherwise let the LLM
        generate the opening from the system prompt (warm, in-persona, uses the lead's
        name) — the SAME path that already runs when a caller speaks first, so it's
        proven. A bare scripted 'Hello' spoken straight to TTS is what felt robotic."""
        # Fill {{placeholders}} + strip script artifacts BEFORE speaking: admins paste
        # whole scripts into the field — a live call read '# VACADEMY AI – INTRODUCTION
        # SPEECH … (Wait for confirmation) … {{lead_name}}' aloud, verbatim.
        opening = _clean_opening(_fill_placeholders(
            (agent.get("openingLine") or "").strip(), context))
        connect_t = time.time()
        # Base beat, then EXTEND while the callee is audibly speaking: a Sarvam
        # final physically cannot arrive inside 0.8s (VAD stop + server endpointing
        # ≈1.2s minimum), so the old transcript check was dead code and the opening
        # talked OVER callers who answered with a sentence (deep-review A9). Wait
        # out their utterance (cap 2.5s) so the final can land and drive the
        # proven caller-spoke-first LLM path instead.
        while time.time() - connect_t < settings.greet_delay_secs:
            if flags["transcript_t"] > connect_t + 0.05:
                logger.info("greet: callee spoke first — LLM replies, skipping our open (corr=%s)", corr)
                return
            await asyncio.sleep(0.1)
        while (time.time() - connect_t < 2.5
               and (flags["user_speaking"] or flags["user_started_t"] > connect_t)):
            if flags["transcript_t"] > connect_t + 0.05:
                diag.greet_path = "callee_spoke_first"
                logger.info("greet: callee spoke first (extended wait) — skipping our open (corr=%s)", corr)
                return
            await asyncio.sleep(0.1)
        if opening:
            # Append to the LLM CONTEXT as well as speaking: a TTSSpeakFrame is consumed
            # by the TTS and its text NEVER reaches the assistant aggregator (verified in
            # pipecat 0.0.95 source), so the model didn't know it had already greeted and
            # re-greeted from scratch on the caller's first reply — the observed
            # double/triple-greeting. run_llm omitted => append only, no generation.
            diag.greet_path = "scripted"
            diag.greet_delay_secs = round(time.time() - _run_bot_t0, 2)
            logger.info("greet: openingLine spoken (corr=%s) at +%.2fs", corr, time.time() - _run_bot_t0)
            # transcript entry comes from PlayedTranscriptRecorder at PLAYOUT
            # (A3) — pre-crediting here recorded openings the caller never heard.
            await task.queue_frames([
                LLMMessagesAppendFrame(messages=[{"role": "assistant", "content": opening}]),
                TTSSpeakFrame(opening)])
        else:
            # No scripted line → LLM opens. Seed a synthetic caller 'Hello?' into the LLM
            # context (NOT our saved transcript) and run: this reproduces the exact
            # proven caller-spoke-first path, so the model reliably emits its persona
            # opening instead of us hoping it generates from a system-only context.
            diag.greet_path = "llm"
            logger.info("greet: LLM-generated opening (corr=%s)", corr)
            # Bracketed CUE, not a synthetic "Hello?": seeding a fake caller hello
            # taught the model that hello earns hello back — live calls opened with a
            # "Hello"/"Ji"/"Hello" ping-pong for two wasted rounds before the real
            # opening. A stage cue makes it deliver the scripted opening directly.
            await task.queue_frames([LLMMessagesAppendFrame(
                messages=[{"role": "user", "content":
                           "[The call has just connected and the person is on the line. "
                           "Deliver your opening now, exactly as your instructions "
                           "specify — do not just say 'hello'.]"}],
                run_llm=True)])

    # Tracked so run_bot's finally can cancel it — an orphaned greet task on a
    # pipeline that died during setup would queue frames into a cancelled task
    # (noisy) and hold its closure alive.
    _bg_tasks: list = []

    @transport.event_handler("on_client_connected")
    async def _on_connected(_transport, _client):
        _bg_tasks.append(asyncio.create_task(_greet_when_ready()))

    @transport.event_handler("on_client_disconnected")
    async def _on_disconnected(_transport, _client):
        await task.cancel()

    cap_minutes = float(agent.get("maxCallMinutes") or 0) or settings.max_call_minutes_default
    cap_secs = cap_minutes * 60.0

    async def _begin_stop():
        if flags["stopping_since"] is None:
            flags["stopping_since"] = time.time()
            await task.stop_when_done()

    # Wired HERE, after _begin_stop exists — a forward reference at sentinel
    # construction time would NameError on every call (same class of bug as the
    # 2026-07-27 tts-before-assignment outage).
    sentinel.set_arm_stop(_begin_stop)

    # Same ordering rule: `sentinel` only exists from line ~1146.
    #
    # MEASURE ONLY — deliberately does NOT touch the stall stamp.
    #
    # pipecat pushes an InterruptionFrame on EVERY Silero onset while the bot is
    # quiet (base_input: `not self._bot_speaking` — the min-words strategy is
    # bypassed in exactly that window), and "bot quiet with a generation pending"
    # IS the wedge window. So a cough or hold music arrives here. CLEARING the
    # stamp would disarm wedge detection; RE-STAMPING is no better, because on a
    # noisy line the clock is pushed forward faster than stall_after_secs and
    # recovery never fires either. Both dressed up the founder's own bug as a
    # fix. Measured against the live corpus: 14.7% of onsets carry no transcript
    # at all, and two logged stalls had onsets inside their armed window.
    #
    # The pre-playout kill is real, but the answer is to SEE it, not to destroy
    # the only evidence that a reply never played. The stamp keeps its pre-diff
    # semantics; the counter feeds the diagnostics panel.
    def _note_killed_before_playout():
        # Stamp a SUSPICION, do not count it yet. 95% of these replies go on to
        # play within ~0.2s (pipecat only tears the TTS socket down when the bot
        # is already speaking), so counting here made the metric — and the panel
        # verdict built on it — almost entirely false. unplayed_confirmed() turns
        # a suspicion into a fact only if the silence outlasts the window.
        if flags["tts_gen_t"] != 0.0 and not flags["bot_speaking"]:
            if flags["unplayed_pending_t"] == 0.0:
                flags["unplayed_pending_t"] = time.time()
    sentinel.set_on_interrupted(_note_killed_before_playout)

    def _defer_stop():
        if flags["end_pending_since"] == 0.0:
            flags["end_pending_since"] = time.time()

    def _clear_end_pending():
        flags["end_pending_since"] = 0.0

    sentinel.set_end_hooks(_defer_stop, _clear_end_pending)

    async def watchdog():
        """1-second tick: PURE decision (callstate.watchdog_decide — fully covered
        by the timeline harness) + bookkeeping + I/O execution here."""
        # EVERY WatchdogConfig field is passed explicitly from Settings — a field
        # left to its dataclass default is a live turn-taking threshold with no
        # env knob, untunable without a rebuild. Enforced by
        # test_watchdog_config_call_names_every_field.
        cfg = WatchdogConfig(
            connected_at=outcome.connected_at,
            cap_secs=cap_secs,
            idle_timeout_secs=settings.idle_timeout_secs,
            stall_recovery_enabled=settings.stall_recovery_enabled,
            graceful_stop_deadline_secs=_GRACEFUL_STOP_DEADLINE_SECS,
            stall_after_secs=settings.stall_after_secs,
            stall_max_recoveries=settings.stall_max_recoveries,
            stop_reissue_every_secs=settings.stop_reissue_every_secs,
            orphan_min_utterance_secs=settings.orphan_min_utterance_secs,
            orphan_window_secs=(settings.orphan_window_lo_secs,
                                settings.orphan_window_hi_secs),
            orphan_bot_quiet_secs=settings.orphan_bot_quiet_secs,
            orphan_connect_grace_secs=settings.orphan_connect_grace_secs,
            orphan_transcript_lookback_secs=settings.orphan_transcript_lookback_secs,
            max_nudges=settings.max_nudges,
            no_words_timeout_secs=settings.no_words_timeout_secs,
            unplayed_confirm_secs=settings.unplayed_confirm_secs,
            end_grace_secs=settings.end_grace_secs,
            max_deaf_streak=settings.max_deaf_streak,
            duck_no_words_resume_secs=settings.duck_no_words_resume_secs,
            duck_max_hold_secs=settings.duck_max_hold_secs,
        )
        repeat_line = ("Sorry, I missed that — could you say that again?" if eng else
                       "Maaf kijiye, main sun nahi paayi — ek baar phir boliye?")
        while True:
            await asyncio.sleep(1.0)
            now = time.time()
            # Confirm-or-drop any outstanding "never played" suspicion first.
            if unplayed_confirmed(flags, now, cfg):
                flags["unplayed_pending_t"] = 0.0
                diag.bump("replies_never_played")
                logger.warning("reply never reached the caller corr=%s "
                               "(no audio %.1fs after it was cut)",
                               corr, cfg.unplayed_confirm_secs)
            d = watchdog_decide(flags, now, cfg)
            apply_decision(flags, d, now)

            if d.kind == NONE:
                continue
            if d.kind == ARM_STOP:
                logger.info("sentinel: grace elapsed (%.1fs) — closing the line corr=%s",
                            d.detail, corr)
                sentinel._stop_armed = True
                await _begin_stop()
                continue
            if d.kind == CANCEL_STARVED:
                logger.warning("graceful stop starved — cancelling corr=%s", corr)
                await task.cancel()
                return
            if d.kind == REISSUE_STOP:
                # A barge-in DRAINS queued frames including the EndFrame (A7).
                await task.stop_when_done()
                continue
            if d.kind == DUCK_RESUME:
                diag.bump("duck_timeout_resumes")
                logger.info("duck: voiced but wordless for %.1fs — resuming reply corr=%s",
                            d.detail, corr)
                await duck.resume("watchdog_timeout")
                continue
            if d.kind == CAP_FAREWELL:
                diag.cap_farewell = True
                logger.info("max call duration reached corr=%s (%.0fs)", corr, cap_secs)
                outcome.end_requested = True
                # The cap can fire mid-duck (it is a spend bound): release any
                # held tail first so the farewell doesn't queue behind a hold.
                await duck.resume("cap_farewell")
                await task.queue_frames([TTSSpeakFrame(cap_farewell)])
                await _begin_stop()
                continue
            if d.kind == STALL_RECOVER:
                # Grace beat, THEN re-check. On a live call Sarvam's first byte
                # landed 2ms after the decision and our _disconnect destroyed
                # audio that had just arrived. Without this yield the re-check is
                # dead code: nothing between watchdog_decide and here awaits, so
                # no frame callback can run and the flags cannot change. 50ms
                # against a >=3.5s stall is free. (The predicate lives in
                # callstate so the harness covers it — testing tts_gen_t here
                # would abort EVERY recovery, since apply_decision zeroed it.)
                await asyncio.sleep(0.05)
                if not stall_recovery_still_needed(flags, time.time()):
                    logger.info("tts stall recovery aborted corr=%s — audio arrived", corr)
                    continue
                diag.bump("tts_stalls")
                if flags["stall_recoveries"] >= cfg.stall_max_recoveries:
                    # Cap reached: recovery has failed repeatedly and the caller is
                    # hearing NOTHING from here on. Seen live (call 47a9e96a):
                    # stallCapHit with the bot silent while the line stayed open.
                    # Sitting mute burns the caller's patience and our minutes —
                    # close out instead. The farewell goes through the same TTS, so
                    # if even that cannot play the graceful-stop deadline still ends
                    # the call.
                    diag.tts_stall_cap_hit = True
                    logger.error("tts stall cap reached corr=%s — closing the call "
                                 "rather than sitting silent", corr)
                    outcome.end_requested = True
                    await task.queue_frames([TTSSpeakFrame(end_closing)])
                    await _begin_stop()
                    continue
                logger.error("tts audio stall corr=%s (%.1fs since generation, recovery %d) — "
                             "reconnecting TTS + regenerating", corr, d.detail,
                             flags["stall_recoveries"])
                try:
                    await tts._disconnect()
                    await tts._connect()
                except Exception as ex:
                    logger.warning("tts stall reconnect failed corr=%s: %s", corr, ex)
                # "briefly" USED to be in this cue — and it cost us content: the
                # model summarised away announcements the caller had never heard
                # (the founder's "it missed telling details"). The caller heard
                # NOTHING, so the correct instruction is to say it again in full.
                await task.queue_frames([LLMMessagesAppendFrame(
                    messages=[{"role": "user", "content":
                        "[Audio glitch: the caller heard NOTHING of your last reply. "
                        "Say your last reply again IN FULL, keeping every detail and "
                        "question it contained — do not shorten it, do not summarise it, "
                        "and do not mention the glitch.]"}],
                    run_llm=True)])
                continue
            if d.kind == ORPHAN_ASK:
                diag.bump("orphan_reasks")
                # The caller audibly spoke and produced no words. Counted
                # separately from the re-ask because the re-ask is one-shot per
                # silent stretch, so it under-reports a persistently deaf line.
                diag.bump("unheard_utterances")
                _orphan_at = time.time()
                flags_orphan_marker.append(_orphan_at)
                logger.info("vad-orphan ask-repeat corr=%s (no transcript %.1fs after speech)",
                            corr, d.detail)
                await task.queue_frames([
                    LLMMessagesAppendFrame(messages=[{"role": "assistant", "content": repeat_line}]),
                    TTSSpeakFrame(repeat_line)])
                continue
            if d.kind == HEARING_FAILED:
                # Stop apologising and close out honestly. The caller has already
                # repeated themselves twice and we still have no words from them.
                logger.error("hearing failed corr=%s (%d unheard utterances) — "
                             "closing out instead of asking again", corr, int(d.detail))
                diag.bump("hearing_failures")
                outcome.end_requested = True
                await task.queue_frames([TTSSpeakFrame(cant_hear_closing)])
                await _begin_stop()
                continue
            if d.kind == NUDGE:
                diag.bump("nudges")
                # Context-append too: TTSSpeakFrame text never reaches the LLM
                # context — without it the model can't react to "haan sun raha hoon".
                await task.queue_frames([
                    LLMMessagesAppendFrame(messages=[{"role": "assistant", "content": nudge_text}]),
                    TTSSpeakFrame(nudge_text)])
                continue
            if d.kind == IDLE_HANGUP:
                diag.idle_hangup = True
                # Speak a brief closing BEFORE dropping — a silent hangup read as
                # "disconnected without a proper close" (live feedback).
                logger.info("idle hangup corr=%s", corr)
                outcome.end_requested = True
                await task.queue_frames([TTSSpeakFrame(idle_farewell)])
                await _begin_stop()

    watchdog_task = asyncio.create_task(watchdog())
    try:
        runner = PipelineRunner(handle_sigint=False)
        logger.info("setup timing corr=%s pipeline_built=%.2fs (since run_bot entry)",
                    corr, time.time() - _run_bot_t0)
        await runner.run(task)
    finally:
        outcome.ended_at = time.time()
        # RECONCILE: which caller answers never reached the model? TranscriptCollector
        # sits BEFORE aggregators.user(), so anything it recorded but the context
        # lacks was DELETED by pipecat's aggregator (min_words / emulated-VAD paths).
        # This is the ground truth behind "answers need to be repeated".
        # If the context cannot be read we leave answers_deleted as None — "we did
        # not check" must never render as "we checked and it was clean".
        try:
            _delivered = [m.get("content") or "" for m in llm_context.get_messages()
                          if isinstance(m, dict) and m.get("role") == "user"]
            _heard = [t.get("text") or "" for t in outcome.transcript
                      if t.get("role") == "user" and not (t.get("text") or "").lstrip().startswith("[")]
            _n, _samples = diag_mod.reconcile_answers(_heard, _delivered)
            diag.answers_deleted = _n
            diag.answers_deleted_samples = _samples
            if _n:
                logger.warning("diagnostics: %d caller answer(s) never reached the model "
                               "corr=%s %s", _n, corr, _samples[:5])
        except Exception:
            logger.exception("diagnostics: answer reconciliation failed corr=%s", corr)
        # AWAITED cancellation (not fire-and-forget): retrieves the task result so
        # a watchdog crash is logged instead of vanishing as a pending-task warning.
        for _t in [watchdog_task, *_bg_tasks]:
            _t.cancel()
            try:
                await _t
            except asyncio.CancelledError:
                pass
            except Exception:
                logger.exception("teardown: background task died corr=%s", corr)
        # Best-effort SDK teardown: STT holds a per-call AsyncSarvamAI whose
        # underlying httpx.AsyncClient the pipeline never closes — leaked per
        # call. (TTS reuses the app-level aiohttp session; its websocket is
        # closed by the pipeline's own End/Cancel path.) Shape verified against
        # the pinned wheels 2026-07-27: _sarvam_client._client_wrapper
        # .httpx_client (fern AsyncHttpClient, NO aclose) .httpx_client (the
        # real httpx.AsyncClient, has aclose). Every step is defensive.
        for _svc in (stt, tts):
            _sdk = getattr(_svc, "_sarvam_client", None) or getattr(_svc, "_client", None)
            _httpx = getattr(getattr(_sdk, "_client_wrapper", None), "httpx_client", None)
            _inner = getattr(_httpx, "httpx_client", _httpx)
            _close = getattr(_inner, "aclose", None)
            if _close is not None:
                try:
                    _res = _close()
                    if asyncio.iscoroutine(_res):
                        await _res
                except Exception:
                    pass

    return outcome
