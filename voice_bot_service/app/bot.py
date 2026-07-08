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
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

from pipecat.frames.frames import (
    BotStartedSpeakingFrame,
    BotStoppedSpeakingFrame,
    Frame,
    LLMFullResponseEndFrame,
    LLMTextFrame,
    TranscriptionFrame,
    TTSSpeakFrame,
)
from pipecat.pipeline.pipeline import Pipeline
from pipecat.pipeline.runner import PipelineRunner
from pipecat.pipeline.task import PipelineParams, PipelineTask
from pipecat.processors.aggregators.llm_context import LLMContext
from pipecat.processors.aggregators.llm_response import LLMUserAggregatorParams
from pipecat.processors.aggregators.llm_response_universal import LLMContextAggregatorPair
from pipecat.processors.frame_processor import FrameDirection, FrameProcessor

from . import admin_core
from .config import get_settings
from .providers import build_llm, build_stt, build_tts

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

    def duration_seconds(self) -> int:
        end = self.ended_at or time.time()
        return max(0, int(end - self.connected_at))


class TranscriptCollector(FrameProcessor):
    """Records the caller's words (final transcriptions), refreshes the idle clock,
    and speaks an instant filler acknowledgment ("Hmm…") while the LLM composes —
    the reply's hard floor is ~1.5s of silence otherwise (VAD window + STT final +
    LLM TTFT), and a human-style acknowledgment makes it read as attentiveness."""

    def __init__(self, outcome: CallOutcome, on_activity, is_bot_speaking):
        super().__init__()
        self._outcome = outcome
        self._on_activity = on_activity
        self._is_bot_speaking = is_bot_speaking
        s = get_settings()
        self._filler_phrases = list(s.filler_phrases)
        self._filler_probability = max(0.0, min(1.0, s.filler_probability))

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)
        if isinstance(frame, TranscriptionFrame) and frame.text and frame.text.strip():
            self._outcome.transcript.append({"role": "user", "text": frame.text.strip()})
            self._on_activity(user=True)
            # Filler only when the bot is quiet — a barge-in already has audio
            # to cancel, and stacking a filler on it would talk over the caller.
            if (self._filler_phrases and not self._is_bot_speaking()
                    and random.random() < self._filler_probability):
                await self.push_frame(
                    TTSSpeakFrame(random.choice(self._filler_phrases)), direction)
        await self.push_frame(frame, direction)


class SentinelGate(FrameProcessor):
    """Between LLM and TTS: strips the steering markers from the token stream so
    they are never spoken, accumulates the assistant transcript one utterance at
    a time, tracks bot-speaking state for the idle watchdog, and stops the
    pipeline after the final utterance finished playing."""

    def __init__(self, outcome: CallOutcome, on_activity, set_bot_speaking):
        super().__init__()
        self._outcome = outcome
        self._on_activity = on_activity
        self._set_bot_speaking = set_bot_speaking
        self._task: Optional[PipelineTask] = None
        self._buffer = ""          # marker hold-back across token chunks
        self._utterance = ""       # current assistant utterance (one transcript entry)
        self._spoke_this_response = False

    def set_task(self, task: PipelineTask):
        self._task = task

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, LLMTextFrame):
            self._on_activity(user=False)
            self._buffer += frame.text or ""
            if TRANSFER_MARKER in self._buffer:
                self._outcome.transfer_requested = True
                self._buffer = self._buffer.replace(TRANSFER_MARKER, "")
            if END_MARKER in self._buffer:
                self._outcome.end_requested = True
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
                if self._buffer.startswith("<<"):
                    self._outcome.end_requested = True
                self._buffer = ""
            self._flush_utterance()
            await self.push_frame(frame, direction)
            # Marker-only response (nothing spoken): no BotStoppedSpeakingFrame
            # will ever arrive, so speak a short close to drive the stop path.
            if ((self._outcome.end_requested or self._outcome.transfer_requested)
                    and not self._spoke_this_response):
                closing = ("Ek moment, main aapko connect kar rahi hoon."
                           if self._outcome.transfer_requested
                           else "Theek hai, dhanyavaad. Aapka din shubh ho!")
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
            self._flush_utterance()
            await self.push_frame(frame, direction)
            if self._outcome.transfer_requested and not self._outcome.transfer_registered:
                await self._register_handoff()
            if (self._outcome.end_requested or self._outcome.transfer_requested) and self._task:
                logger.info("sentinel: stopping call corr=%s (transfer=%s end=%s)",
                            self._outcome.corr, self._outcome.transfer_requested,
                            self._outcome.end_requested)
                await self._task.stop_when_done()
            return

        await self.push_frame(frame, direction)

    def _flush_utterance(self):
        text = self._utterance.strip()
        if text:
            self._outcome.transcript.append({"role": "assistant", "text": text})
        self._utterance = ""

    async def _register_handoff(self):
        numbers = (self._outcome.context.get("handoff") or {}).get("numbers") or []
        if not numbers:
            logger.warning("transfer requested but no handoff target corr=%s", self._outcome.corr)
            return
        registered = await admin_core.post_handoff(self._outcome.corr, numbers[0])
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
}


def _voice_gender(voice) -> str:
    return "male" if (voice or "priya").strip().lower() in _MALE_VOICES else "female"


def build_system_prompt(context: Dict[str, Any]) -> str:
    agent = context.get("agent") or {}
    lead_name = context.get("leadName")
    institute = context.get("instituteName") or "our institute"
    extraction = agent.get("extractionQuestions") or []
    dispositions = agent.get("dispositions") or []
    name = agent.get("name") or "the assistant"
    gender = _voice_gender(agent.get("voice"))
    direction = str(context.get("direction") or agent.get("direction") or "OUTBOUND").upper()

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
    if lead_gender in ("female", "f", "woman"):
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

    if direction == "INBOUND":
        intent_line = (
            f"This person has CALLED {institute}. You are answering their call — greet them "
            "warmly, quickly find out why they called, and help them."
        )
    else:
        intent_line = (
            f"You are PROACTIVELY CALLING this person on behalf of {institute} — YOU placed "
            "this call, they did not call you. Never sound like you are answering their call. "
            "Open with a clear reason for calling, lead the conversation confidently, and keep a "
            "warm, positive, forward-moving tone that gives them a reason to engage right now."
        )

    lines = [
        agent.get("systemPrompt") or "You are a friendly, concise phone assistant.",
        f"You are {name}. {gender_line}",
        addressee_line,
        intent_line,
        f"The caller's name is {lead_name}." if lead_name else "",
        ("During the conversation, naturally find out: " + "; ".join(extraction))
        if extraction else "",
        "Rules:",
        "- 1-2 short sentences per reply. ONE question per turn. Never monologue.",
        # Numbers/times are the #1 audio break on Hinglish calls: the model mixes
        # languages ('five baje') or spells digits ('two zero zero').
        "- Clock times: ALWAYS the English 12-hour format — 'five PM', 'ten thirty AM', 'twelve "
        "noon', 'quarter past six'. NEVER the Hindi 'baje' form and NEVER a mix — 'five baje' and "
        "'paanch baje' are both WRONG; say 'five PM'.",
        "- Other numbers and money: whole spoken words in the sentence's one language, never spelled "
        "out digit-by-digit — 'do sau rupaye' / 'two hundred rupees' (NEVER 'two zero zero' or 'do "
        "zero zero'), 'pandrah tarikh'. Exception: a 10-digit phone number is read digit by digit.",
        f"- When the conversation has reached a natural end, say a short goodbye and append {END_MARKER}.",
        f"- If the caller asks for a human, is upset, or you cannot help, say you are connecting them and append {TRANSFER_MARKER}."
        if (context.get("handoff") or {}).get("enabled")
        else f"- If the caller asks for a human, say a counsellor will call them right back, then append {END_MARKER}.",
        ("At the end you must be able to judge the caller's interest as one of: "
         + ", ".join(dispositions)) if dispositions else "",
    ]
    return "\n".join(l for l in lines if l)


async def run_bot(transport, corr: str, context: Dict[str, Any],
                  outcome: CallOutcome, *, aiohttp_session) -> CallOutcome:
    """Run one call end-to-end on an already-connected Plivo <Stream> transport.
    Mutates the caller-owned CallOutcome in place (crash-safe reporting)."""
    settings = get_settings()
    agent = context.get("agent") or {}

    # Idle/pacing state shared between the processors and the watchdog. The idle
    # clock only escalates while the bot is NOT speaking (TTS playout is real-time
    # and much slower than token generation), and only USER activity re-arms the
    # nudge — otherwise the nudge's own audio resets it and hangup never escalates.
    flags = {"t": time.time(), "nudged": False, "bot_speaking": False, "stopping_since": None}

    def on_activity(user: bool = True):
        flags["t"] = time.time()
        if user:
            flags["nudged"] = False

    def set_bot_speaking(speaking: bool):
        flags["bot_speaking"] = speaking

    stt = build_stt(settings.sample_rate)
    llm = build_llm()
    tts = build_tts(settings.sample_rate, voice=agent.get("voice"),
                    aiohttp_session=aiohttp_session)

    llm_context = LLMContext(
        messages=[{"role": "system", "content": build_system_prompt(context)}]
    )
    aggregators = LLMContextAggregatorPair(
        llm_context,
        # Default 0.5s waits for late transcript fragments AFTER the VAD already
        # decided the turn ended — with Saaras finals typically beating the VAD
        # window, most of it is dead air the caller hears before every reply.
        user_params=LLMUserAggregatorParams(aggregation_timeout=settings.agg_timeout_secs),
    )

    transcript = TranscriptCollector(outcome, on_activity,
                                     is_bot_speaking=lambda: flags["bot_speaking"])
    sentinel = SentinelGate(outcome, on_activity, set_bot_speaking)

    pipeline = Pipeline([
        transport.input(),
        stt,
        transcript,
        aggregators.user(),
        llm,
        sentinel,
        tts,
        transport.output(),
        aggregators.assistant(),
    ])

    task = PipelineTask(
        pipeline,
        params=PipelineParams(
            audio_in_sample_rate=settings.sample_rate,
            audio_out_sample_rate=settings.sample_rate,
            enable_metrics=True,
        ),
    )
    sentinel.set_task(task)

    async def _greet_when_ready():
        """Don't blast the opening the instant the line connects — a real caller waits
        for the callee to pick up and say 'hello'. Give them a short beat: if they speak
        first, the normal STT→LLM turn greets them back (so the bot never talks over their
        'hello' and never double-greets); if they stay silent past the grace window, WE
        open. flags['t'] advances on the first transcribed user speech, so t > connect_t
        means the callee spoke."""
        opening = agent.get("openingLine")
        if not opening:
            return
        connect_t = time.time()
        while time.time() - connect_t < settings.greet_delay_secs:
            if flags["t"] > connect_t + 0.05:
                logger.info("greet: callee spoke first — LLM will reply, skipping scripted opening (corr=%s)", corr)
                return
            await asyncio.sleep(0.1)
        outcome.transcript.append({"role": "assistant", "text": opening})
        await task.queue_frames([TTSSpeakFrame(opening)])

    @transport.event_handler("on_client_connected")
    async def _on_connected(_transport, _client):
        asyncio.create_task(_greet_when_ready())

    @transport.event_handler("on_client_disconnected")
    async def _on_disconnected(_transport, _client):
        await task.cancel()

    cap_minutes = float(agent.get("maxCallMinutes") or 0) or settings.max_call_minutes_default
    cap_secs = cap_minutes * 60.0

    async def _begin_stop():
        if flags["stopping_since"] is None:
            flags["stopping_since"] = time.time()
            await task.stop_when_done()

    async def watchdog():
        """Idle nudge → idle hangup; hard call-duration cap; graceful-stop deadline."""
        while True:
            await asyncio.sleep(1.0)

            # Graceful-stop deadline: stop_when_done can be starved by new turns.
            if flags["stopping_since"] is not None:
                if time.time() - flags["stopping_since"] > _GRACEFUL_STOP_DEADLINE_SECS:
                    logger.warning("graceful stop starved — cancelling corr=%s", corr)
                    await task.cancel()
                    return
                continue

            # Hard per-call ceiling (telephony + vendor spend bound).
            if time.time() - outcome.connected_at >= cap_secs:
                logger.info("max call duration reached corr=%s (%.0fs)", corr, cap_secs)
                outcome.end_requested = True
                await task.queue_frames([TTSSpeakFrame(
                    "Mujhe ab call samaapt karni hogi. Hamari team aapse jald sampark karegi. Dhanyavaad!")])
                await _begin_stop()
                continue

            # Idle handling — clock paused while the bot is speaking.
            if flags["bot_speaking"]:
                continue
            idle = time.time() - flags["t"]
            if idle < settings.idle_timeout_secs:
                continue
            if not flags["nudged"]:
                flags["nudged"] = True
                flags["t"] = time.time()
                await task.queue_frames([TTSSpeakFrame("Hello? Kya aap sun paa rahe hain?")])
            else:
                logger.info("idle hangup corr=%s", corr)
                outcome.end_requested = True
                await _begin_stop()

    watchdog_task = asyncio.create_task(watchdog())
    try:
        runner = PipelineRunner(handle_sigint=False)
        await runner.run(task)
    finally:
        watchdog_task.cancel()
        outcome.ended_at = time.time()

    return outcome
