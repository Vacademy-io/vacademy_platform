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
    InterimTranscriptionFrame,
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
from pipecat.processors.aggregators.llm_response_universal import (
    LLMContextAggregatorPair,
    LLMUserAggregatorParams,
)
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
from pipecat.audio.turn.smart_turn.base_smart_turn import SmartTurnParams
from pipecat.audio.turn.smart_turn.local_smart_turn_v3 import LocalSmartTurnAnalyzerV3
from pipecat.audio.vad.silero import SileroVADAnalyzer
from pipecat.audio.vad.vad_analyzer import VADParams
from pipecat.turns.user_stop.turn_analyzer_user_turn_stop_strategy import (
    TurnAnalyzerUserTurnStopStrategy,
)
from pipecat.turns.user_turn_strategies import (
    TranscriptionUserTurnStartStrategy,
    UserTurnStrategies,
    VADUserTurnStartStrategy,
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
from .turntake import (mid_reply_action, is_carrier_announcement,
                       is_audio_check, suppresses_opening, is_repeat,
                       caller_asked_to_repeat, normalize_spoken, question_topic,
                       strip_echo_opener, ABSORB)

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
                 on_absorb=None, backchannel_extra=frozenset(),
                 gate_enabled=None, interrupt_on_vad=None, recently_cut=None,
                 diag=None, in_machine_window=None, reply_in_flight=None,
                 bot_spoke_once=None):
        super().__init__()
        self._outcome = outcome
        self._diag = diag
        # True only while an operator/voicemail recording is still plausible.
        # This was a LATCH ("have we heard a real caller yet?") and the latch is
        # what broke on call 14029bd6: Sarvam rendered "…after the tone" as the
        # complete final "Add the tone.", that one miss flipped the latch, and
        # the two unmistakable announcements that followed ("Please record your
        # message.", "When you have finished recording you may hang up.") were
        # then treated as the caller and cut our opening three times. A clock
        # cannot be flipped by a single bad transcript.
        self._in_machine_window = in_machine_window or (lambda: False)
        self._reply_in_flight = reply_in_flight or (lambda: False)
        self._bot_spoke_once = bot_spoke_once or (lambda: True)
        # Have we already identified this line as a machine greeting?
        self._carrier_seen = False
        self._on_activity = on_activity
        self._is_bot_speaking = is_bot_speaking
        self._set_user_speaking = set_user_speaking or (lambda speaking: None)
        self._on_transcript = on_transcript or (
            lambda backchannel=False, substantive=False: None)
        # Turn-gate (see DuckGate): for ANY final that lands mid-reply, THIS
        # processor is the decision point — it sits before aggregators.user(),
        # so an absorbed backchannel never reaches the aggregator that would
        # delete it or run the LLM on it. Deliberately NOT gated on a duck
        # having happened: on live call 8e1e00ad Silero's volume gate missed the
        # caller entirely (no VAD onset → no duck), STT still transcribed them,
        # and pipecat's emulated path deleted the words while the bot talked on.
        # The words themselves are the trigger of last resort.
        self._duck = duck
        self._gate_enabled = gate_enabled or (lambda: duck is not None)
        self._interrupt_on_vad = interrupt_on_vad or (lambda: False)
        # True while a reply cancelled moments ago could still be picked up.
        self._recently_cut = recently_cut or (lambda: False)

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
        # Consecutive bare "hello?"s from the caller (reset by anything else).
        self._audio_checks = 0
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
        # FINAL transcriptions only. pipecat 1.4's Google STT emits
        # InterimTranscriptionFrame (a TranscriptionFrame subclass) continuously —
        # treating interims as turns would spam the transcript, the dedupe window
        # and the turn-gate. Interims exist for the turn-stop strategy, not us.
        if (isinstance(frame, TranscriptionFrame)
                and not isinstance(frame, InterimTranscriptionFrame)
                and frame.text and frame.text.strip()):
            text = frame.text.strip()
            now = time.time()
            # The OPERATOR's recorded message is not the callee. Record it (the
            # answering-machine detector reads these markers) then stop: it must
            # not stamp transcript_t (which would make _greet_when_ready skip our
            # opening), must not interrupt, and above all must not reach the LLM.
            # On call 77cb4b47 it did all three — "Your call has been forwarded to
            # voicemail." became the first user message and conditioned EVERY
            # generation for the next 2.5 minutes.
            #
            # Only before the callee has actually said something: after that, a
            # match is far more likely to be the caller quoting us than the network.
            if self._in_machine_window() and is_carrier_announcement(text):
                self._outcome.transcript.append({"role": "user", "text": text})
                if self._diag is not None:
                    self._diag.bump("carrier_announcements")
                logger.info("turn-gate: carrier announcement %r — not the callee, "
                            "dropping from context", text[:48])
                self._carrier_seen = True
                if self._duck is not None and self._duck.is_ducked():
                    await self._on_absorb(None)
                return
            # Once we KNOW the line is playing a recording, the scraps between
            # its recognisable sentences are that same recording. Call 38536b71
            # died on a single one: 'तो।' — one word, no phrase match, so it
            # counted as the callee and _greet_when_ready skipped our opening
            # again (greetPath "callee_spoke_first"), even though the four real
            # announcements around it were all filtered correctly.
            #
            # Deliberately narrow: only BEFORE we have spoken (after that the
            # caller is answering us and every word matters), only 1-2 word
            # scraps, and never an audio-check — "hello" in this window is the
            # human picking up mid-greeting, which is the one thing here we
            # must not swallow.
            if (self._carrier_seen and self._in_machine_window()
                    and not self._bot_spoke_once()
                    and len(text.split()) <= 2 and not is_audio_check(text)):
                self._outcome.transcript.append({"role": "user", "text": text})
                if self._diag is not None:
                    self._diag.bump("carrier_announcements")
                logger.info("turn-gate: machine-greeting scrap %r — dropping", text[:32])
                if self._duck is not None and self._duck.is_ducked():
                    await self._on_absorb(None)
                return
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
            # Mid-reply = a reply is audibly playing, OR held by a duck. NOT
            # "ducked" by itself: ducked with nothing held and the bot quiet
            # means the reply ENDED during the hold — a backchannel then is an
            # answer to its closing question, not an interruption. When the VAD
            # missed the onset (no duck — the 8e1e00ad failure mode) the bot is
            # still speaking, so is_bot_speaking() carries the trigger.
            # "Mid-reply" now includes JUST-CUT, because interrupting at VAD
            # onset means the bot is already silent by the time the words arrive
            # (~1.5s later, STT). Without this the absorb path could never fire
            # and every "haan" ended the bot's turn — measured on the probe: the
            # model answered the acknowledgment from a standing start instead of
            # finishing its sentence.
            mid_reply = self._gate_enabled() and (
                self._is_bot_speaking()
                or (self._duck is not None and self._duck.has_pending_audio())
                or self._recently_cut()
                # ...or the reply exists but has not reached the line yet.
                or self._reply_in_flight())
            if mid_reply:
                if text.startswith("["):
                    # Synthetic noise cue mid-reply: nothing to answer, nothing
                    # worth interrupting — release any hold and move on.
                    self._on_transcript(backchannel=True)
                    await self._on_absorb(None)
                    return
                if mid_reply_action(
                        text, extra_backchannels=self._backchannel_extra) == ABSORB:
                    # "Absorb but never lose" (founder decision 2026-08-05): the
                    # reply continues (resumes if held) AND the ack still reaches
                    # the LLM context — run_llm omitted, so no generation. The
                    # aggregator never sees this turn, so pipecat's min-words and
                    # emulated-VAD paths cannot delete it (ANSWER_DELETED).
                    self._on_transcript(backchannel=True)
                    logger.info("turn-gate: absorbed backchannel %r "
                                "(ducked=%s, cut=%s)", text[:30], ducked,
                                self._interrupt_on_vad())
                    await self.push_frame(LLMMessagesAppendFrame(
                        messages=[{"role": "user", "content": text}]), direction)
                    await self._on_absorb(text)
                    if self._interrupt_on_vad():
                        # The VAD onset already cancelled the reply, and a
                        # cancelled reply cannot be un-cancelled — so ask for the
                        # rest of it instead of leaving the caller in silence
                        # after their "haan". run_llm=True: this is the ONLY
                        # place that regenerates, and it fires solely for
                        # acknowledgments, so it cannot loop on real answers.
                        #
                        # Duck-only (resume the held audio instead of
                        # regenerating) would be the cleaner answer here and is
                        # NOT available: measured on the deployed image
                        # 2026-08-06, INTERRUPT_ON_VAD=false gives 1.92s of
                        # talk-over against 0.52s with it on — the founder's
                        # original "the bot takes ages to stop". So: cancel
                        # fast, then be careful about what we say next.
                        if is_audio_check(text):
                            self._audio_checks += 1
                        else:
                            self._audio_checks = 0
                        if self._audio_checks >= 2:
                            # Twice in a row means the line is genuinely bad.
                            # Re-delivering the sentence a third time is what
                            # made call 77cb4b47 unlistenable: cut -> "hello?"
                            # -> cut -> "hello?", four times in eleven seconds.
                            # Say one short thing and then STOP talking.
                            cue = ("[They have said hello twice now — they are "
                                   "not hearing you properly. Say ONE short "
                                   "sentence asking whether they can hear you, "
                                   "then stop. Do NOT repeat your question, do "
                                   "NOT restart your pitch, do NOT re-greet.]")
                        else:
                            cue = ("[They just acknowledged you — carry on "
                                   "from where you were interrupted, in one "
                                   "short sentence. Do not restart or "
                                   "re-greet.]")
                        await self.push_frame(LLMMessagesAppendFrame(
                            messages=[{"role": "user", "content": cue}],
                            run_llm=True), direction)
                    return
                self._on_transcript(substantive=suppresses_opening(text))
                # Real barge-in. If ducked, the line is already silent and this
                # makes it formal; if the VAD missed the onset the bot is STILL
                # TALKING and this is what finally stops it — late beats never.
                # broadcast_interruption (the 1.4 API) pushes InterruptionFrame
                # both directions from HERE: downstream it cancels the in-flight
                # generation, drops any held tail in DuckGate and clears Plivo's
                # buffer; the aggregator closes the assistant turn as interrupted
                # so its played text is committed (prevents the verbatim
                # re-opening seen on 8e1e00ad). The transcript is then forwarded
                # below as a fresh, normal turn.
                self._audio_checks = 0
                logger.info("turn-gate: real barge-in %r — interrupting reply "
                            "(ducked=%s)", text[:40], ducked)
                await self.broadcast_interruption()
            elif ducked:
                # The reply finished while we were ducked (nothing held, bot
                # quiet): this is just a normal turn — release the duck flag
                # and let the aggregator answer it.
                self._on_transcript()
                await self._on_absorb(None)
            else:
                self._on_transcript(substantive=suppresses_opening(text))
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

    def __init__(self, enabled, is_bot_speaking, on_duck, on_unduck, diag,
                 on_interrupt=None):
        super().__init__()
        self._enabled = enabled
        self._is_bot_speaking = is_bot_speaking
        self._on_duck = on_duck
        self._on_unduck = on_unduck
        self._on_interrupt = on_interrupt or (lambda: None)
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
            # Stamp WHEN the reply died, so a backchannel whose words land after
            # the cut can still be answered with "carry on" instead of the model
            # replying to a bare "haan" from a standing start.
            self._on_interrupt()
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


class NoRepeatGate(FrameProcessor):
    """Between the LLM and the TTS: never say the same sentence twice in a call.

    THE PROBLEM the founder kept hearing: the bot re-asks its own closing
    questions — "kya aap fees ke baare mein jaanna chahenge?", "kya main is
    WhatsApp number par link bhej doon?" — several turns after it already asked
    them, because nothing tracks which questions have been put to the caller.

    WHY IN CODE. Four prompt-level attempts failed, each measured over 3+ live
    conversations against the real model: style rules in the system prompt
    (1.7 -> 1.7 repeats, and they broke script and gender), no-echo rules with
    worked examples in the script (3.0 -> 3.0 echoes), deleting the scripted
    acknowledgement lines the model was parroting (2.7 -> 2.7), and changing
    model (1.0 -> 0.3, real but reverted for latency). Remembering what you
    already said is state, and a 16k-character prompt is not where state lives.

    NO LATENCY COST. pipecat's TTS already buffers to a sentence boundary before
    synthesising (hence "Generating TTS [whole sentence]" in the logs), so
    holding a sentence here to look at it costs nothing that was not already
    being spent.

    NEVER SILENT. If every sentence of a reply is a repeat, the LAST one is let
    through anyway: one repeated question is bad, a reply that vanishes and
    leaves the caller in silence is worse.
    """

    _SENT_END = re.compile(r"[.!?।]+[\s\"'\)\]]*")

    def __init__(self, enabled=None, last_caller_text=None, diag=None,
                 no_echo=None, handbacks=None):
        super().__init__()
        self._enabled = enabled or (lambda: True)
        self._last_caller_text = last_caller_text or (lambda: "")
        self._diag = diag
        self._no_echo = no_echo or (lambda: True)
        self._handbacks = tuple(handbacks) if handbacks else self._HANDBACK
        self._spoken: list = []
        self._asked: set = set()      # question TOPICS already put to the caller
        self._suppressions: dict = {}  # key -> drops since we last let it through
        self._buf = ""
        self._emitted = 0
        self._held_tail = ""
        self._handback = 0
        # Handbacks since the last reply that actually said something. >0 means
        # the caller's last turn was answered with "you talk" and nothing else.
        self._consecutive_handbacks = 0

    def _trim_echo(self, sentence: str) -> str:
        """Strip a reply's opening clause when it only parrots the caller's answer.

        Applied to the FIRST sentence of a reply only: that is where the
        restatement lands ("ओके, सुबोध अभी आठवीं क्लास में है, तो …"), and a
        mid-reply clause that happens to reuse the caller's words is usually the
        bot building on them, not confirming them. See
        turntake.strip_echo_opener for what it refuses to touch.
        """
        if not self._no_echo():
            return sentence
        try:
            # The bot's own last QUESTION is half the reference set: the caller's
            # answer is short ("तिरानवे प्रतिशत") and the parroting reuses the
            # question's nouns too ("मार्क्स", "क्लास"), which the caller never said.
            bot_question = next((s for s in reversed(self._spoken) if "?" in s), "")
            out = strip_echo_opener(sentence, self._last_caller_text(), bot_question)
        except Exception:
            logger.exception("no-echo: trim failed — speaking the reply as written")
            return sentence
        if out != sentence:
            if self._diag is not None:
                self._diag.bump("echoes_trimmed")
            logger.info("no-echo: dropped parroted opener %r -> %r",
                        sentence.strip()[:56], out.strip()[:56])
        return out

    # How many times one sentence (or one question topic) may be silently
    # dropped before we let it through anyway.
    #
    # The ban used to be PERMANENT, and that is what killed call 3148ccd4. The
    # bot asked "Raman abhi kaun si class mein hai?" once, the caller — still
    # working out who was calling — never answered it, and the gate then blocked
    # all six attempts to ask again. It was not a handback problem: even on the
    # turns where some other sentence survived, the ONE question that could have
    # moved the call forward was gagged, so there was no path out.
    #
    # The model holds the whole conversation in its context. If it asks the same
    # thing a THIRD time across three separate turns, it is not being sloppy —
    # it is telling us the answer never arrived (which ANSWER_DELETED confirmed
    # on that very call). Believe it. Being wrong costs the caller one repeated
    # question; being right saves the call. The counter resets when we let one
    # through, so a model stuck in a loop still only gets one in three.
    _MAX_SUPPRESSIONS = 2

    def _keep(self, sentence: str) -> bool:
        if not self._enabled():
            return True
        if caller_asked_to_repeat(self._last_caller_text()):
            return True            # they ASKED us to say it again
        # Same QUESTION, different words. Sentence similarity cannot see this:
        # call 597aeb3f asked "Aur wo abhi kis class mein hai?" and then "Raman
        # abhi kis class mein padh raha hai?", which score ~0.6 against each
        # other and sailed through.
        topic = question_topic(sentence)
        if not (is_repeat(sentence, self._spoken) or (topic and topic in self._asked)):
            return True
        # ONE budget per topic, not one per mechanism. Keying the two branches
        # separately let a re-asked question burn 2 drops as a near-identical
        # sentence and 2 more as an already-asked topic — four silent drops for
        # something the caller was waiting on.
        key = topic or normalize_spoken(sentence)[:48]
        n = self._suppressions.get(key, 0) + 1
        if n > self._MAX_SUPPRESSIONS:
            self._suppressions[key] = 0
            logger.info("no-repeat: %r suppressed %d times and the caller still "
                        "has not moved on — saying it", sentence.strip()[:56],
                        self._MAX_SUPPRESSIONS)
            if self._diag is not None:
                self._diag.bump("repeat_escalations")
            return True
        self._suppressions[key] = n
        return False

    # Said INSTEAD of a reply that turned out to be entirely a repeat. The first
    # version of this guard re-emitted the duplicate rather than go silent, and
    # it fired seven times in one afternoon — so the guard against dead air was
    # itself producing the repetition the founder was hearing. Hand the turn
    # back instead, and never with the same words twice running.
    #
    # ONE handback, then ESCALATE — call 3148ccd4 (2026-08-13), the worst call
    # we have logs for. Every one of these lines means "you talk", and the bot is
    # the party that placed the call. On that call the gate suppressed 20
    # sentences, handed back SEVEN times, and the caller answered each one:
    # "आप कुछ बोल क्यों नहीं रही हैं?" -> "मैं क्या बताऊँ?" -> "मैं क्या बताऊँ?" ->
    # "क्या बोलूं?" -> "मुझे समझ नहीं आ रहा आप क्यों phone कर रहे हैं" — forty-five
    # seconds of two parties telling each other to go first, then the callee hung
    # up. The trigger was ordinary: "Raman abhi kaun si class mein hai?" was asked
    # ONCE, never answered, and the gate then blocked all SIX attempts to ask it
    # again, which is the one thing a human counsellor would obviously do.
    #
    # So the rule the original comment was reaching for is not "never repeat", it
    # is "never leave the caller with nothing". A repeated question is a small
    # cost; a bot that can only say "you talk" cannot be answered at all, and the
    # conversation has no way back. After one handback the held sentence goes out.
    _HANDBACK = ("Ji, boliye.", "Haan ji?", "Aap batayiye.", "Ji?")
    _HANDBACK_EN = ("Yes, go ahead.", "Sorry, you were saying?", "Please go on.", "Yes?")

    async def _emit(self, text: str, direction):
        self._spoken.append(normalize_spoken(text))
        topic = question_topic(text)
        if topic:
            self._asked.add(topic)
        self._emitted += 1
        self._consecutive_handbacks = 0     # the bot said something real
        await self.push_frame(LLMTextFrame(text), direction)

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, LLMFullResponseStartFrame):
            self._buf, self._emitted, self._held_tail = "", 0, ""
            await self.push_frame(frame, direction)
            return

        if isinstance(frame, InterruptionFrame):
            # A cancelled reply's unsaid tail was never heard, so it is not
            # "already said" — but what DID play is still in _spoken.
            self._buf, self._held_tail = "", ""
            await self.push_frame(frame, direction)
            return

        if (isinstance(frame, LLMTextFrame) and direction == FrameDirection.DOWNSTREAM
                and not isinstance(frame, TTSTextFrame)):
            self._buf += frame.text or ""
            while True:
                m = self._SENT_END.search(self._buf)
                if not m:
                    break
                sentence, self._buf = self._buf[:m.end()], self._buf[m.end():]
                if not sentence.strip():
                    continue
                if self._emitted == 0:
                    sentence = self._trim_echo(sentence)
                if self._keep(sentence):
                    await self._emit(sentence, direction)
                else:
                    self._held_tail = sentence
                    if self._diag is not None:
                        self._diag.bump("repeats_suppressed")
                    logger.info("no-repeat: dropping already-said %r", sentence.strip()[:56])
            return

        if isinstance(frame, LLMFullResponseEndFrame):
            tail = self._buf.strip()
            self._buf = ""
            if tail:
                if self._emitted == 0:
                    tail = self._trim_echo(tail)
                if self._keep(tail):
                    await self._emit(tail, direction)
                else:
                    self._held_tail = tail
                    if self._diag is not None:
                        self._diag.bump("repeats_suppressed")
                    logger.info("no-repeat: dropping already-said %r", tail[:56])
            if self._emitted == 0 and self._held_tail:
                if self._consecutive_handbacks >= 1:
                    # ESCALATE (call 3148ccd4). We already handed the turn back
                    # once and the caller still has nothing to answer. Saying
                    # "you talk" a second time is how a call becomes unrecoverable
                    # — so say the held sentence, repeat and all. It is almost
                    # always the question the caller never answered, which is
                    # exactly what a human would ask again.
                    logger.warning("no-repeat: second all-repeat reply in a row — "
                                   "speaking it rather than handing back again %r",
                                   self._held_tail.strip()[:56])
                    if self._diag is not None:
                        self._diag.bump("repeat_escalations")
                    await self._emit(self._held_tail, direction)
                else:
                    # Everything was a repeat. Do NOT say it again — hand the turn
                    # back in a few words so the line is not dead either.
                    line = self._handbacks[self._handback % len(self._handbacks)]
                    self._handback += 1
                    self._consecutive_handbacks += 1
                    if self._diag is not None:
                        self._diag.bump("handbacks")
                    logger.info("no-repeat: whole reply was a repeat — handing back with %r", line)
                    self._emitted += 1
                    await self.push_frame(LLMTextFrame(line), direction)
            await self.push_frame(frame, direction)
            return

        await self.push_frame(frame, direction)


class SentinelGate(FrameProcessor):
    """Between LLM and TTS: strips the steering markers from the token stream so
    they are never spoken, accumulates the assistant transcript one utterance at
    a time, tracks bot-speaking state for the idle watchdog, and stops the
    pipeline after the final utterance finished playing."""

    def __init__(self, outcome: CallOutcome, on_activity, set_bot_speaking,
                 on_reply_start=None,
                 transfer_closing: str = "Ek moment, main aapko connect kar rahi hoon.",
                 end_closing: str = "Theek hai, dhanyavaad. Aapka din shubh ho!",
                 transfer_fail_closing: str = ("Mujhe abhi connect karne mein dikkat aa "
                                               "rahi hai — hamare counsellor aapko jald "
                                               "call karenge. Dhanyavaad!")):
        super().__init__()
        self._outcome = outcome
        self._on_activity = on_activity
        self._set_bot_speaking = set_bot_speaking
        self._on_reply_start = on_reply_start or (lambda: None)
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
            # pipecat 1.4: the assistant aggregator closes the turn itself on
            # interruption (interrupted=True) — the 0.0.95 `_started` underflow
            # this swallow shielded (deep-review A2) does not exist here, and
            # eating a legitimate End would now corrupt turn accounting. The
            # flag machinery stays for the response-local bookkeeping below.
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
            self._on_reply_start()
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
# Google + Smallest male voices are UNIONED into this set right after their
# palettes are defined below — same reason as the Rumik note above: this set is
# the ONLY thing that makes the LLM write masculine Hindi verb endings.

# Rumik Mulberry 1.5 female presets, kept explicit rather than inferred from the
# male set's complement — _voice_gender defaults unknown names to female, so an
# unlisted female voice is harmless, but naming them documents the real palette
# for the picker and catches a typo'd voice at review time.
_RUMIK_FEMALE_VOICES = {
    "emma", "mia", "sophia", "ava", "ira", "siya", "aisha", "zoya",
}
_RUMIK_MALE_VOICES = {"lucas", "noah", "theo", "adam"}
RUMIK_VOICES = _RUMIK_FEMALE_VOICES | _RUMIK_MALE_VOICES

# ── Google Cloud TTS (hi-IN) ────────────────────────────────────────────────
# Curated from the live list_voices API (46 hi-IN voices; 30 Chirp3-HD). Kept to
# a shortlist so the Python palette and Java TtsVoiceCatalog can stay in
# agreement — a mismatch there is what silently substitutes a caller's voice.
# Gender comes from Google's own ssml_gender, NOT from the name: "Achird" and
# "Achernar" are male and female respectively and nothing in the string says so.
_GOOGLE_MALE_VOICES = {
    "hi-in-chirp3-hd-achird", "hi-in-chirp3-hd-charon", "hi-in-chirp3-hd-fenrir",
    "hi-in-chirp3-hd-orus", "hi-in-chirp3-hd-puck", "hi-in-chirp3-hd-schedar",
    "hi-in-neural2-b", "hi-in-neural2-c", "hi-in-wavenet-b", "hi-in-wavenet-c",
}
_GOOGLE_FEMALE_VOICES = {
    "hi-in-chirp3-hd-achernar", "hi-in-chirp3-hd-aoede", "hi-in-chirp3-hd-kore",
    "hi-in-chirp3-hd-leda", "hi-in-chirp3-hd-zephyr", "hi-in-chirp3-hd-sulafat",
    "hi-in-neural2-a", "hi-in-neural2-d", "hi-in-wavenet-a", "hi-in-wavenet-d",
}
GOOGLE_VOICES = _GOOGLE_MALE_VOICES | _GOOGLE_FEMALE_VOICES

# ── Smallest.ai Lightning ───────────────────────────────────────────────────
# From the live get_voices catalog, Hindi-tagged Indian-accent voices only.
# ⚠️ The palettes are PER-MODEL and do not overlap: the API hard-rejects a
# cross-model voice ("Voice 'devansh' is not available on the
# lightning_v3.1_pro model") — i.e. a mute call. lightning_v3.1 is our default,
# so its names lead; the _pro names are listed separately for the picker.
_SMALLEST_V31_MALE = {"devansh", "kaustubh", "virat", "karan", "yash", "debashis"}
_SMALLEST_V31_FEMALE = {"imogen", "nirupma", "niharika"}
_SMALLEST_PRO_MALE = {"mandar", "mathan", "barath"}
_SMALLEST_PRO_FEMALE = {"manasi", "mrunal", "ketaki", "meher"}
SMALLEST_VOICES = (_SMALLEST_V31_MALE | _SMALLEST_V31_FEMALE
                   | _SMALLEST_PRO_MALE | _SMALLEST_PRO_FEMALE)

# One place where every engine's male voices land, so _voice_gender works for
# all four. Missing a name here means a male voice speaking feminine Hindi —
# the #1 immersion complaint from live calls.
_MALE_VOICES |= _GOOGLE_MALE_VOICES | _SMALLEST_V31_MALE | _SMALLEST_PRO_MALE


def _engine_of(model: str) -> str:
    """Normalize a stored tts_model into one of our four engine ids."""
    m = (model or "").strip().lower()
    if m.startswith(("rumik", "silk")):
        return "rumik"
    if m.startswith(("google", "chirp")):
        return "google"
    if m.startswith(("smallest", "lightning")):
        return "smallest"
    return "sarvam"


# Per-engine defaults + palettes, so adding a 5th engine is one table row rather
# than a new branch in three functions.
_ENGINE_DEFAULT_VOICE = {
    "sarvam": "priya",
    "rumik": "ira",
    # Founder chose Chirp3-HD by ear; Achird is its male voice (agent Ameet).
    "google": "hi-IN-Chirp3-HD-Achird",
    "smallest": "devansh",
}


def _engine_palette(engine: str):
    return {"rumik": RUMIK_VOICES, "google": GOOGLE_VOICES,
            "smallest": SMALLEST_VOICES}.get(engine)


def _default_voice_for(agent) -> str:
    """Provider default voice. Grammar follows it via _voice_gender, so the
    default and the prompt's verb endings can never disagree."""
    return _ENGINE_DEFAULT_VOICE.get(_engine_of(_agent_tts_model(agent)), "priya")


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
    engine = _engine_of(_agent_tts_model(agent))
    palette = _engine_palette(engine)
    low = voice.lower()
    if palette is not None:
        # Engine with a known palette: the voice MUST be in it.
        return voice if low in palette else None
    # Sarvam has no enumerated palette here (dozens of speakers across bulbul
    # versions), so instead reject anything that clearly belongs elsewhere.
    for other in (RUMIK_VOICES, GOOGLE_VOICES, SMALLEST_VOICES):
        if low in other:
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
        # Rumik reads Devanagari-transliterated English as gibberish — live call
        # 8e1e00ad: the model wrote 'लाइव क्लासेस' and the caller heard 'लव असेस'
        # (founder: "it pronounced many words poorly"). Sarvam bulbul handles
        # either script, so this stays Rumik-only to leave legacy agents alone.
        if _agent_tts_model(agent) == "rumik":
            script_rule += (
                "\n- EVERY English-origin word — product and class names included — must be in "
                "English letters, never Devanagari transliteration: write 'Live Classes', "
                "'Assessment', 'Foundation Batch' — NEVER 'लाइव क्लासेस', 'असेसमेंट'. Devanagari is "
                "for Hindi words ONLY; if a word is English, spell it in English."
            )
    # REGISTER. Founder, after hearing live calls: "everything is highly formal
    # Hindi... words that in general are not used". Measured across two days of
    # calls: 198 uses of literary vocabulary — प्रदर्शन 37x, पूछताछ 28x, अकादमिक
    # 14x, अवधारणा 12x. It is translationese: the authored script is English and
    # the model renders it into textbook Hindi, which no counsellor speaks and
    # which the TTS also stumbles over. The pairs below are the actual offenders
    # from those transcripts, not invented examples — concrete swaps steer a
    # model far better than "be conversational".
    plain_hindi_rule = "" if is_english else (
        "SPEAK PHONE HINDI, NOT TEXTBOOK HINDI. Use the words a real counsellor "
        "says out loud. Where the everyday word IS English, use the English word — "
        "that is how people actually speak; it is not a mistake. Say: performance "
        "(never प्रदर्शन), enquiry (never पूछताछ), academic (never अकादमिक/शैक्षणिक), "
        "concepts (never अवधारणाएँ), annual exam (never वार्षिक परीक्षा), tracking "
        "(never निगरानी), counsellor (never सलाहकार), problem/difficulty (never "
        "कठिनाई), structured (never संरचित), suitable / सही रहेगा (never उपयुक्त), "
        "guidance (never मार्गदर्शन), tests (never परीक्षण), doubts (never संदेह), "
        "fees (never शुल्क), scholarship (never छात्रवृत्ति), lectures (never "
        "व्याख्यान), parents / माता-पिता (never अभिभावक), option (never विकल्प), "
        "score किया (never अंक प्राप्त किए). If a word would sound odd from a "
        "shopkeeper or a parent on a phone call, do not use it."
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
    # Founder, 2026-08-12, on a live Shiksha Nation call: "every time the person
    # answers, the AI again says okay. It asked how many marks, the person said
    # ninety-four, and it comes back 'okay, you got ninety-four'. There is no need
    # to reconfirm every time — it looks like an AI." Three turns in a row opened
    # with the restatement.
    #
    # SECOND line of defence only. NoRepeatGate's docstring records four measured
    # prompt-only attempts at this exact class of repetition, one of them "no-echo
    # rules with GALAT/SAHI examples in the script" (3.0 -> 3.0 echoes) — the
    # 16k-character prompt is saturated. turntake.strip_echo_opener does the
    # load-bearing work; this just lowers how often it has to fire.
    no_echo_rule = (
        "- NEVER CONFIRM AN ANSWER BACK. When the caller ANSWERS your question, do not "
        "repeat it, restate it, or open with ‘okay, so <their answer>…’. They know "
        "what they just said; repeating it wastes their time and sounds like a machine "
        "reading a form. Simply USE the answer in your next line."
        + ("" if is_english else
           " GALAT: ‘ओके, सुबोध अभी "
           "आठवीं क्लास में "
           "है, तो लास्ट exam में "
           "कितने marks आए थे?’ SAHI: "
           "‘लास्ट exam में कितने "
           "marks आए थे?’")
        + " TWO EXCEPTIONS, and only these: read a phone number back once digit by digit, "
        "and read a booked day and time back once. Everything else, never."
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
        "rules, those take precedence.\n"
        "ON REQUEST, THE SWITCH IS PERMANENT: if the caller asks for a language at any point "
        "(\u2018English mein baat karo\u2019, \u2018can you speak in English\u2019, "
        "\u2018Hindi mein boliye\u2019), switch on your VERY NEXT sentence and stay there for "
        "the WHOLE rest of the call. Never drift back \u2014 not for one line, not because they "
        "later use a word of the other language, not after an interruption. If they ask for "
        "English, speak plain English only: no Hindi words, no Devanagari."
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

    # When a scripted opening is configured we SPEAK IT VERBATIM before the model
    # ever runs. Authored prompts are usually a call SCRIPT whose first block is
    # that very introduction (Shiksha Nation's is written as "Bot: Hi! I'm Ameet
    # calling from…"), so without this the model reads the script from the top and
    # delivers the introduction a second time — which is exactly what callers heard.
    # Naming the opening verbatim also gives LANGUAGE STABILITY something to anchor
    # to on the first turn, when the model has no previous turns of its own.
    opening_line = _clean_opening(_fill_placeholders(
        (agent.get("openingLine") or "").strip(), context))
    already_said_rule = ""
    if opening_line:
        already_said_rule = (
            "ALREADY SPOKEN — do not repeat: this call has ALREADY opened with exactly "
            f"\"{opening_line}\" It has been said. NEVER introduce yourself, your name or "
            "your company again, and never restart your script from the top, no matter what "
            "the caller says (including a bare 'hello' mid-call — that means they are "
            "checking the line is alive, so simply continue). Resume from the point in your "
            "instructions that comes AFTER the introduction. Keep speaking the SAME LANGUAGE "
            "as that opening unless the caller clearly asks for another one."
        )

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
            "caller speaks first at the very START of the call, your FIRST reply IS your "
            "scripted opening — but ONLY at the start; mid-call that rule does not apply.",
            already_said_rule,
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
            plain_hindi_rule,
            plain_speech_rule,
            fast_open_rule,
            no_echo_rule,
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
        already_said_rule,
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
        plain_hindi_rule,
        plain_speech_rule,
        fast_open_rule,
        no_echo_rule,
        one_step_rule,
        goal_drive_rule,
        ("- Mostly SKIP acknowledgment openers entirely and answer directly; when you do "
         "acknowledge, never use the same word twice in a row."),
        # Scoped to a QUESTION or a CONCERN on purpose. Reflecting one back shows you
        # listened; reflecting an ANSWER back is the parroting no_echo_rule forbids,
        # and the unscoped version of this line was licence for exactly that.
        ("- When the caller asks a QUESTION or raises a CONCERN, briefly reflect that point "
         "back before you answer so they feel heard — not a generic 'I understand'. Never do "
         "this with an ANSWER they gave you."
         if is_english else
         "- When the caller asks a QUESTION or raises a CONCERN, briefly reflect that point "
         "back before you answer (e.g. 'अच्छा, आप timing को लेकर puchh rahe hain —') so they "
         "feel heard. Not a generic 'मैं समझती हूँ'. NEVER do this with an ANSWER they gave you."),
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
    Mutates the caller-owned CallOutcome in place (crash-safe reporting).

    pipecat 1.4 architecture (migration 2026-08-05): the USER AGGREGATOR owns the
    VAD, the turn strategies (Smart Turn v3 semantic end-of-turn) and the idle
    clock. Interruptions are OURS to drive: turn-start strategies are constructed
    with enable_interruptions=False so a VAD onset never hard-cancels a reply —
    DuckGate holds the audio instantly and the turn-gate then absorbs a
    backchannel or commits a real interruption (founder decision: "absorb but
    never lose"). The 0.0.95 watchdog shrinks to spend/stop/duck enforcement;
    nudges and idle-hangup ride the aggregator's on_user_turn_idle event."""
    _run_bot_t0 = time.time()
    settings = get_settings()
    agent = context.get("agent") or {}

    flags = CallState(t=time.time())
    diag = diag_mod.CallDiagnostics()
    outcome.diagnostics = diag

    def on_activity(user: bool = True):
        flags["t"] = time.time()

    # WHAT was the bot doing while the line was silent? Call 597aeb3f showed
    # 8.2s of dead air and the container restart that shipped the next build
    # destroyed the logs before it could be diagnosed — so the answer has to
    # travel with the REPORT, which survives restarts, not the log.
    def _silence_cause(gap: float) -> str:
        if gap < 2.5:
            return ""
        now = time.time()
        if flags["ducked_since"] > 0:
            return "ducked_%.1fs" % (now - flags["ducked_since"])
        st = flags["reply_started_t"]
        if st and flags["bot_stopped_t"] < st:
            return "awaiting_playout_%.1fs" % (now - st)   # LLM/TTS composed, no audio
        if flags["user_speaking"]:
            return "caller_speaking"
        if flags["user_stopped_t"] > flags["bot_stopped_t"]:
            return "after_caller_turn"      # we owed them a reply and did not start one
        return "both_quiet"

    def set_bot_speaking(speaking: bool):
        if speaking:
            flags["unplayed_pending_t"] = 0.0
        if speaking and not flags["bot_speaking"]:
            _last = max(flags["bot_stopped_t"], flags["user_stopped_t"])
            if _last:
                _gap = max(0.0, time.time() - _last)
                diag.sample("dead_air", _gap)
                _why = _silence_cause(_gap)
                if _why:
                    diag.note_silence(round(_gap, 1), _why)
                    logger.info("dead air %.1fs — bot was %s corr=%s", _gap, _why, corr)
            diag.bump("bot_turns")
        flags["bot_speaking"] = speaking
        flags["tts_gen_t"] = 0.0
        if not speaking:
            flags["bot_stopped_t"] = time.time()
            flags["bot_spoke_once"] = True

    def set_user_speaking(speaking: bool):
        if speaking and not flags["user_speaking"]:
            _last = max(flags["bot_stopped_t"], flags["user_stopped_t"])
            if _last:
                _gap = max(0.0, time.time() - _last)
                diag.sample("dead_air", _gap)
                _why = _silence_cause(_gap)
                if _why:
                    diag.note_silence(round(_gap, 1), _why)
                    logger.info("dead air %.1fs — bot was %s corr=%s", _gap, _why, corr)
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
    end_closing = ("Alright, thank you. Have a great day!" if eng
                   else "Theek hai, dhanyavaad. Aapka din shubh ho!")
    eng_fillers = ("Hmm…",)

    stt_bias = (agent.get("name") or "").strip() or None
    stt = build_stt(settings.sample_rate, language=stt_lang, bias=stt_bias,
                    mode=_agent_stt_mode(agent))
    # to_thread: Vertex constructors do a SYNCHRONOUS service-account OAuth
    # round-trip; keep it off the loop so concurrent calls' audio never glitches.
    llm = await asyncio.to_thread(build_llm)
    tts = build_tts(settings.sample_rate, voice=_agent_voice(agent),
                    aiohttp_session=aiohttp_session,
                    pace=_as_float(agent.get("pace")),
                    temperature=_as_float(agent.get("temperature")),
                    tts_model=_agent_tts_model(agent))
    for _svc in (stt, tts):
        if hasattr(_svc, "set_diagnostics"):
            _svc.set_diagnostics(diag)
    diag.tts_vendor = (getattr(tts, "model_name", "")
                       or str(getattr(getattr(tts, "_settings", None), "model", "") or "")
                       or type(tts).__name__)
    if hasattr(tts, "set_credits_callback"):
        tts.set_credits_callback(
            lambda credits, secs, chars=0: diag.note_tts_spend(credits, secs, chars))
    if hasattr(tts, "set_generate_callback"):
        def _stamp_generate():
            if flags["tts_gen_t"] == 0.0 and not flags["bot_speaking"]:
                flags["tts_gen_t"] = time.time()
        tts.set_generate_callback(_stamp_generate)

    llm_context = LLMContext(
        messages=[{"role": "system", "content": build_system_prompt(context, sink=diag.note_unfilled)}]
    )

    # ── 1.4 turn machinery: VAD + Smart Turn v3 + idle, all on the aggregator ──
    # Telephony VAD tuning carries over from the 0.0.95 fixes: min_volume 0.35
    # (pipecat's 0.6 default made the VAD stone-deaf to phone-leg callers on live
    # call 8e1e00ad — the single worst finding of the migration's test calls).
    vad = SileroVADAnalyzer(params=VADParams(
        stop_secs=settings.vad_stop_secs,
        start_secs=settings.vad_start_secs,
        confidence=settings.vad_confidence,
        min_volume=settings.vad_min_volume,
    ))
    turn_strategies = UserTurnStrategies(
        # enable_interruptions=False on BOTH start strategies: a bare VAD onset
        # (cough, backchannel) must never hard-cancel a reply. DuckGate silences
        # the line instantly; the turn-gate decides on the words.
        start=[
            # enable_interruptions=True — MEASURED DECISION, reversed from the
            # duck-only design. Holding audio in DuckGate cannot stop the bot
            # quickly, because by the time the caller speaks the reply has
            # already flowed PAST the duck into pipecat's output queue and
            # Plivo's buffer; live call d6e82def logged "dropping 0 held
            # frame(s)" on an interrupt for exactly this reason. Only a flush
            # empties those, and the duck could only flush after the STT final
            # arrived — 0.8-1.6s later. Probed talk-over was 1.96s.
            # A native interruption at VAD onset flushes both immediately.
            # Backchannels are still not lost: the turn-gate appends them to the
            # context, and _resume_after_backchannel below has the bot pick up
            # its sentence, because a cancelled reply cannot be un-cancelled.
            VADUserTurnStartStrategy(enable_interruptions=settings.interrupt_on_vad,
                                     enable_user_speaking_frames=True),
            # Interims must NOT interrupt on their own: Google STT streams them
            # continuously, and the VAD onset above already covers the stop.
            TranscriptionUserTurnStartStrategy(use_interim=True,
                                               enable_interruptions=False),
        ],
        stop=[
            TurnAnalyzerUserTurnStopStrategy(
                turn_analyzer=LocalSmartTurnAnalyzerV3(
                    params=SmartTurnParams(stop_secs=settings.smart_turn_stop_secs))),
        ],
    )
    aggregators = LLMContextAggregatorPair(
        llm_context,
        user_params=LLMUserAggregatorParams(
            vad_analyzer=vad,
            user_turn_strategies=turn_strategies,
            user_idle_timeout=settings.idle_timeout_secs,
        ),
    )

    def on_transcript(backchannel: bool = False, substantive: bool = False):
        flags["transcript_t"] = time.time()
        if substantive:
            flags["substantive_t"] = flags["transcript_t"]
        if not backchannel and flags["end_pending_since"] != 0.0:
            flags["end_pending_since"] = 0.0
            outcome.end_requested = False
            logger.info("sentinel: caller re-engaged after farewell — call continues corr=%s", corr)
        flags["deaf_streak"] = 0
        flags["orphan_used"] = False
        if not backchannel:
            flags["nudged"] = False
            flags["nudge_count"] = 0

    def _on_duck():
        flags["ducked_since"] = time.time()

    def _on_unduck():
        flags["ducked_since"] = 0.0

    def _on_interrupt():
        flags["last_cut_t"] = time.time()

    def _recently_cut() -> bool:
        return (flags["last_cut_t"] > 0
                and time.time() - flags["last_cut_t"] <= settings.backchannel_carry_secs)

    duck = DuckGate(enabled=lambda: settings.duck_enabled,
                    is_bot_speaking=lambda: flags["bot_speaking"],
                    on_duck=_on_duck, on_unduck=_on_unduck, diag=diag,
                    on_interrupt=_on_interrupt)

    async def _absorb(text):
        if text is not None:
            diag.bump("duck_absorbs")
        await duck.resume("backchannel" if text is not None else "no_content")

    def _on_reply_start():
        flags["reply_started_t"] = time.time()

    def _reply_in_flight() -> bool:
        """True from the LLM starting a reply until that reply is off the line.

        Exists for the ~0.5-1.0s hole between "the LLM began composing" and
        "the bot is audible". Call bc84958c: Sarvam split one answer into two
        finals 0.85s apart, the second landed in that hole, the turn-gate saw a
        quiet bot and let it through as a brand-new turn, and the bot delivered
        its ENTIRE Marks Improvement pitch TWICE — about 40 seconds of it. The
        caller asked, on the line, "फिर से repeat क्यों कर रहे हैं आप".

        The second final was not a barge-in either: it arrived through
        TranscriptionUserTurnStartStrategy, which has interruptions disabled, so
        nothing cancelled the first reply.

        Time-capped so a generation that dies without ever reaching playout
        cannot mute the caller's turns for the rest of the call.
        """
        st = flags["reply_started_t"]
        if not st or flags["bot_speaking"]:
            return False        # is_bot_speaking() already covers the audible case
        return (flags["bot_stopped_t"] < st
                and (time.time() - st) < settings.reply_inflight_grace_secs)

    def _in_machine_window() -> bool:
        return (time.time() - _run_bot_t0) < settings.machine_greeting_window_secs

    transcript = TranscriptCollector(outcome, on_activity,
                                     is_bot_speaking=lambda: flags["bot_speaking"],
                                     set_user_speaking=set_user_speaking,
                                     filler_phrases=eng_fillers if eng else None,
                                     on_transcript=on_transcript,
                                     fillers_armed=lambda: flags["bot_spoke_once"],
                                     bot_stopped_t=lambda: flags["bot_stopped_t"],
                                     duck=duck, on_absorb=_absorb,
                                     backchannel_extra=settings.backchannel_extra,
                                     gate_enabled=lambda: settings.duck_enabled,
                                     interrupt_on_vad=lambda: settings.interrupt_on_vad,
                                     recently_cut=_recently_cut, diag=diag,
                                     in_machine_window=_in_machine_window,
                                     reply_in_flight=_reply_in_flight,
                                     bot_spoke_once=lambda: flags["bot_spoke_once"])
    played_transcript = PlayedTranscriptRecorder(outcome)

    no_repeat = NoRepeatGate(
        enabled=lambda: settings.no_repeat_enabled,
        last_caller_text=lambda: (outcome.transcript[-1].get("text", "")
                                  if outcome.transcript
                                  and outcome.transcript[-1].get("role") == "user" else ""),
        no_echo=lambda: settings.no_echo_enabled,
        # An English agent handing back in romanized Hindi ("Ji, boliye.") is a
        # language break the caller hears immediately — and these lines bypass
        # the prompt's SCRIPT rule entirely because they never touch the LLM.
        handbacks=(NoRepeatGate._HANDBACK_EN
                   if _agent_language(agent)[0] == "en-IN" else None),
        diag=diag)
    sentinel = SentinelGate(outcome, on_activity, set_bot_speaking,
                            on_reply_start=_on_reply_start,
                            transfer_closing=transfer_closing, end_closing=end_closing)

    pipeline = Pipeline([
        transport.input(),
        stt,
        transcript,
        aggregators.user(),
        llm,
        sentinel,
        no_repeat,
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
        ),
        observers=[TtfbObserver(corr, diag).observer],
    )
    sentinel.set_task(task)

    cap_minutes = float(agent.get("maxCallMinutes") or 0) or settings.max_call_minutes_default
    cap_secs = cap_minutes * 60.0

    async def _begin_stop():
        if flags["stopping_since"] is None:
            flags["stopping_since"] = time.time()
            await task.stop_when_done()

    sentinel.set_arm_stop(_begin_stop)

    def _note_killed_before_playout():
        # Suspicion only — unplayed_confirmed() turns it into a fact if silence
        # outlasts the confirm window (95% of these replies play anyway).
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

    # ── idle: the aggregator's clock replaces the 0.0.95 watchdog nudges ──
    # NOTE for 1.4: TTSSpeakFrame text IS captured into the assistant context by
    # the aggregator (verified in the POC — manual context appends double-add).
    @aggregators.user().event_handler("on_user_turn_idle")
    async def _on_idle(_agg, *_args):
        if flags["stopping_since"] is not None or flags["ducked_since"] > 0:
            return
        if flags["nudge_count"] < settings.max_nudges:
            flags["nudge_count"] += 1
            diag.bump("nudges")
            logger.info("idle: nudge %d corr=%s", flags["nudge_count"], corr)
            await task.queue_frames([TTSSpeakFrame(nudge_text)])
        else:
            diag.idle_hangup = True
            logger.info("idle: hangup corr=%s", corr)
            outcome.end_requested = True
            await task.queue_frames([TTSSpeakFrame(idle_farewell)])
            await _begin_stop()

    async def _greet_when_ready():
        """Open like a person: on OUTBOUND speak first after a short beat unless
        the callee already said something substantive (their turn then drives the
        LLM). Scripted openings are spoken directly — NO manual context append on
        1.4, the assistant aggregator captures spoken text itself."""
        opening = _clean_opening(_fill_placeholders(
            (agent.get("openingLine") or "").strip(), context))
        connect_t = time.time()
        # SUBSTANTIVE speech only. This used to test transcript_t, i.e. ANY
        # transcript, so one stray word decided whether we opened at all — and
        # on a voicemail the stray words are the operator's own recording
        # arriving in fragments. Calls 0d61b32a ('Your call.') and 9668da21
        # ('Hi.' / 'If you record your') both lost their opening to a fragment
        # on 2026-08-06, and the model improvised a replacement, which is how
        # one of them delivered its introduction twice.
        while time.time() - connect_t < settings.greet_delay_secs:
            if flags["substantive_t"] > connect_t + 0.05:
                logger.info("greet: callee spoke first — LLM replies, skipping our open (corr=%s)", corr)
                return
            await asyncio.sleep(0.1)
        while (time.time() - connect_t < 2.5
               and (flags["user_speaking"] or flags["user_started_t"] > connect_t)):
            if flags["substantive_t"] > connect_t + 0.05:
                diag.greet_path = "callee_spoke_first"
                logger.info("greet: callee spoke first (extended wait) — skipping our open (corr=%s)", corr)
                return
            await asyncio.sleep(0.1)
        if opening:
            diag.greet_path = "scripted"
            diag.greet_delay_secs = round(time.time() - _run_bot_t0, 2)
            logger.info("greet: openingLine spoken (corr=%s) at +%.2fs", corr, time.time() - _run_bot_t0)
            # Record the opening in the LLM context OURSELVES, and tell pipecat
            # not to (append_to_context=False) so there is exactly one copy.
            #
            # pipecat 1.4 does commit TTSSpeakFrame utterances — but only when
            # the utterance COMPLETES: the turn opens on TTSStartedFrame and is
            # committed at the end. A caller who speaks over the opening cancels
            # that commit, and the model is then left with NO record that it
            # ever introduced itself. Measured on the live pipeline: uninterrupted
            # the context held the opening; interrupted at +4s it held only
            # (system, user, assistant-reply) and the reply re-introduced the
            # agent from scratch. That is both of the founder's complaints in one
            # mechanism — the re-delivered intro, AND the language flip, because
            # LANGUAGE STABILITY anchors on "your own previous turns" and there
            # were none.
            #
            # Trade-off, deliberate: if the caller cuts the opening short, the
            # context claims slightly more than the caller heard. Believing it
            # said a bit too much is far cheaper than re-delivering the whole
            # introduction, and the played transcript (PlayedTranscriptRecorder)
            # still records the truth for the report.
            await task.queue_frames([
                LLMMessagesAppendFrame(messages=[{"role": "assistant", "content": opening}]),
                TTSSpeakFrame(opening, append_to_context=False)])
        else:
            diag.greet_path = "llm"
            logger.info("greet: LLM-generated opening (corr=%s)", corr)
            await task.queue_frames([LLMMessagesAppendFrame(
                messages=[{"role": "user", "content":
                           "[The call has just connected and the person is on the line. "
                           "Deliver your opening now, exactly as your instructions "
                           "specify — do not just say 'hello'.]"}],
                run_llm=True)])

    _bg_tasks: list = []

    @transport.event_handler("on_client_connected")
    async def _on_connected(_transport, _client):
        _bg_tasks.append(asyncio.create_task(_greet_when_ready()))

    @transport.event_handler("on_client_disconnected")
    async def _on_disconnected(_transport, _client):
        await task.cancel()

    async def watchdog():
        """1-second tick, SLIMMED for 1.4: spend cap, graceful-stop enforcement,
        end-grace, duck resume and unplayed confirmation. Idle/nudge/orphan/deaf
        machinery moved to the aggregator's turn events — their branches are
        disabled via the sentinel values below (the pure decision fn and its
        timeline harness stay authoritative for what remains)."""
        _OFF = 1e9
        cfg = WatchdogConfig(
            connected_at=outcome.connected_at,
            cap_secs=cap_secs,
            idle_timeout_secs=_OFF,                       # aggregator owns idle
            stall_recovery_enabled=False,                 # native TTS reconnect in 1.4
            graceful_stop_deadline_secs=_GRACEFUL_STOP_DEADLINE_SECS,
            stall_after_secs=settings.stall_after_secs,
            stall_max_recoveries=settings.stall_max_recoveries,
            stop_reissue_every_secs=settings.stop_reissue_every_secs,
            orphan_min_utterance_secs=settings.orphan_min_utterance_secs,
            orphan_window_secs=(settings.orphan_window_lo_secs,
                                settings.orphan_window_hi_secs),
            orphan_bot_quiet_secs=settings.orphan_bot_quiet_secs,
            orphan_connect_grace_secs=_OFF,               # orphan re-ask retired
            orphan_transcript_lookback_secs=settings.orphan_transcript_lookback_secs,
            max_nudges=settings.max_nudges,
            no_words_timeout_secs=_OFF,                   # dead-air clock retired
            unplayed_confirm_secs=settings.unplayed_confirm_secs,
            end_grace_secs=settings.end_grace_secs,
            max_deaf_streak=settings.max_deaf_streak,
            duck_no_words_resume_secs=settings.duck_no_words_resume_secs,
            duck_max_hold_secs=settings.duck_max_hold_secs,
        )
        while True:
            await asyncio.sleep(1.0)
            now = time.time()
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
                await duck.resume("cap_farewell")
                await task.queue_frames([TTSSpeakFrame(cap_farewell)])
                await _begin_stop()
                continue
            # Retired branches (idle/orphan/stall/deaf) are disabled by config;
            # reaching one means the sentinel values above were changed — say so.
            logger.warning("watchdog: unexpected decision %s corr=%s", d.kind, corr)

    watchdog_task = asyncio.create_task(watchdog())
    try:
        runner = PipelineRunner(handle_sigint=False)
        logger.info("setup timing corr=%s pipeline_built=%.2fs (since run_bot entry)",
                    corr, time.time() - _run_bot_t0)
        await runner.run(task)
    finally:
        outcome.ended_at = time.time()
        # RECONCILE: which caller answers never reached the model? (Ground truth
        # for ANSWER_DELETED; join-aware — see diagnostics.reconcile_answers.)
        try:
            _delivered = [m.get("content") or "" for m in llm_context.get_messages()
                          if isinstance(m, dict) and m.get("role") == "user"]
            # Carrier recordings are kept in the transcript (LIKELY_MACHINE reads
            # those markers) but are deliberately NOT in the context — so they
            # are not "answers the model never saw". Without this exclusion the
            # fix that filters them MANUFACTURES an ANSWER_DELETED fault: call
            # 14029bd6's panel read "2 caller answers were discarded", quoting
            # the voicemail system back at us.
            _heard = [t.get("text") or "" for t in outcome.transcript
                      if t.get("role") == "user"
                      and not (t.get("text") or "").lstrip().startswith("[")
                      and not is_carrier_announcement(t.get("text") or "")]
            _lost = diag_mod.split_lost(_heard, _delivered)
            diag.answers_deleted = _lost.answers
            diag.answers_deleted_samples = _lost.answer_samples
            # Sub-floor scraps are a measured loss but not a lost ANSWER, and
            # reporting them as one sent the founder hunting for an answer that
            # was never spoken (call c7bf5ff5, verbatim "वो।"). Carried, logged
            # at INFO, no fault — see diagnostics._lost_carries_meaning.
            diag.fragments_lost = _lost.fragments
            diag.fragments_lost_samples = _lost.fragment_samples
            if _lost.answers:
                logger.warning("diagnostics: %d caller answer(s) never reached the model "
                               "corr=%s %s", _lost.answers, corr,
                               _lost.answer_samples[:5])
            if _lost.fragments:
                logger.info("diagnostics: %d sub-word caller scrap(s) lost (no answer in "
                            "them, no fault) corr=%s %s", _lost.fragments, corr,
                            _lost.fragment_samples)
            # Did the caller hear the same sentence over and over? (REPLY_LOOP)
            diag.max_reply_restarts = diag_mod.max_reply_restarts(outcome.transcript)
            if diag.max_reply_restarts >= 2:
                logger.warning("diagnostics: bot restarted the same reply %dx in a row "
                               "corr=%s", diag.max_reply_restarts, corr)
        except Exception:
            logger.exception("diagnostics: answer reconciliation failed corr=%s", corr)
        for _t in [watchdog_task, *_bg_tasks]:
            _t.cancel()
            try:
                await _t
            except asyncio.CancelledError:
                pass
            except Exception:
                logger.exception("teardown: background task died corr=%s", corr)
        # Best-effort SDK teardown (defensive getattr chain — harmless if the
        # 1.4 services shape differs; they own their sockets natively now).
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
