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
    LLMMessagesAppendFrame,
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
from pipecat.audio.interruptions.min_words_interruption_strategy import (
    MinWordsInterruptionStrategy,
)

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
    "odia": ("od-IN", "Odia"),
}


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


def build_system_prompt(context: Dict[str, Any]) -> str:
    agent = context.get("agent") or {}
    lead_name = context.get("leadName")
    extraction = agent.get("extractionQuestions") or []
    dispositions = agent.get("dispositions") or []
    name = agent.get("name") or "the assistant"
    _, lang_label = _agent_language(agent)
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
            "Never sound like you are answering their call. Open with a clear reason for calling, "
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
        f"5) Speak {lang_label} and STAY in it for the whole call. NEVER drift into a different "
        f"language — if a transcript looks like another language, treat it as a mis-heard "
        f"{lang_label} line, not a cue to switch. A single English word from them is NOT a reason "
        f"to switch; never switch language mid-answer."
    )

    lines = [
        agent.get("systemPrompt") or "You are a friendly, concise phone assistant.",
        non_negotiable,
        f"You are {name}. {gender_line}",
        addressee_line,
        intent_line,
        f"The caller's name is {lead_name}." if lead_name else "",
        _lead_fields_line(context),
        ("During the conversation, naturally find out: " + "; ".join(extraction))
        if extraction else "",
        "Rules:",
        "- 1-2 short sentences per reply. ONE question per turn. Never monologue.",
        # SCRIPT: Sarvam Bulbul TTS pronounces ROMANIZED Hindi noticeably worse than native
        # Devanagari (Sarvam's own docs: transliterated input 'significantly reduces output
        # quality'). Write Hindi words in Devanagari and leave genuine English business words
        # in Latin — exactly how Indians write Hinglish. This is the single biggest naturalness
        # lever for a Hindi/Hinglish voice.
        "- SCRIPT: Write Hindi words in DEVANAGARI (हिंदी लिपि), and keep common English business "
        "words in English letters (demo, course, book, WhatsApp, offer, plan, confirm, link). "
        "So write 'मैं आपको एक demo book कर देती हूँ' — NOT romanized 'main aapko ek demo book kar "
        "deti hoon'. NEVER write Hindi words in Latin letters.",
        # VARIETY: repeating the identical acknowledgment every turn is the #1 cumulative
        # robotic tell — rotate them.
        "- Never repeat the same acknowledgment twice in a row. Rotate naturally — हाँ / अच्छा / "
        "ठीक है / जी बिल्कुल / समझ गई — don't say 'ji' every single turn.",
        # REFLECT-BACK: acknowledge the caller's SPECIFIC point before answering, not a generic
        # 'I understand'.
        "- Briefly reflect back the caller's specific point before you answer (e.g. 'अच्छा, आप "
        "timing को लेकर puchh rahe hain —') so they feel heard. Not a generic 'मैं समझती हूँ'.",
        # ENERGY MATCH.
        "- Match the caller's energy: a brief, businesslike caller gets crisp efficiency; a "
        "chatty, warm caller gets a little more warmth. Don't be relentlessly peppy.",
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
        # RECENCY anchor: the last thing the model reads before every generation. A long
        # persona prompt states the name once near the top, which loses salience as the
        # call grows — the model then hallucinates a different name (Anjali) or garbles it
        # (Aarush/Aayushi). Restating the exact identity here, last, holds it steady.
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

    stt_lang, _ = _agent_language(agent)
    # Bias STT toward the agent's own name so a caller repeating it ("aapka naam Aarushi
    # tha?") isn't transcribed as "Aayushi"/"Aarush" and fed back into the LLM context as
    # a wrong name — the #1 way the agent "forgets" its name mid-call.
    stt_bias = (agent.get("name") or "").strip() or None
    stt = build_stt(settings.sample_rate, language=stt_lang, bias=stt_bias)
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
            # Barge-in: when the caller starts speaking, cancel the bot's TTS and let their
            # turn be heard — a real conversation, not the bot talking over an interrupting
            # caller. Was unset (no interruption), which caused the overlaps on live calls.
            allow_interruptions=True,
            # ...but require ≥2 words to interrupt, so a single stray sound, a cough, or a
            # backchannel ("haan", "hmm", "achha") does NOT cancel the bot mid-sentence and
            # derail it. A real correction (more words) still barges in immediately.
            interruption_strategies=[MinWordsInterruptionStrategy(min_words=2)],
        ),
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
        opening = (agent.get("openingLine") or "").strip()
        connect_t = time.time()
        while time.time() - connect_t < settings.greet_delay_secs:
            if flags["t"] > connect_t + 0.05:
                logger.info("greet: callee spoke first — LLM replies, skipping our open (corr=%s)", corr)
                return
            await asyncio.sleep(0.1)
        if opening:
            outcome.transcript.append({"role": "assistant", "text": opening})
            await task.queue_frames([TTSSpeakFrame(opening)])
        else:
            # No scripted line → LLM opens. Seed a synthetic caller 'Hello?' into the LLM
            # context (NOT our saved transcript) and run: this reproduces the exact
            # proven caller-spoke-first path, so the model reliably emits its persona
            # opening instead of us hoping it generates from a system-only context.
            logger.info("greet: LLM-generated opening (corr=%s)", corr)
            await task.queue_frames([LLMMessagesAppendFrame(
                messages=[{"role": "user", "content": "Hello?"}], run_llm=True)])

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
