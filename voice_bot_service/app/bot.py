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

    def __init__(self, outcome: CallOutcome, on_activity, is_bot_speaking,
                 set_user_speaking=None, filler_phrases=None):
        super().__init__()
        self._outcome = outcome
        self._on_activity = on_activity
        self._is_bot_speaking = is_bot_speaking
        self._set_user_speaking = set_user_speaking or (lambda speaking: None)
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
            self._outcome.transcript.append({"role": "user", "text": frame.text.strip()})
            self._on_activity(user=True)
            # Filler only when the bot is quiet — a barge-in already has audio
            # to cancel, and stacking a filler on it would talk over the caller.
            if (self._filler_phrases and not self._is_bot_speaking()
                    and random.random() < self._filler_probability):
                await self.push_frame(
                    TTSSpeakFrame(random.choice(self._filler_phrases)), direction)
        await self.push_frame(frame, direction)


class TtfbObserver:
    """Corr-tagged per-turn latency telemetry. pipecat already computes per-service
    TTFB (enable_metrics=True) but only logs it uncorrelated at DEBUG inside the
    metrics module — useless for 'which call was slow'. This observer logs one INFO
    line per service per turn tagged with the call corr, so 'replies were slow on
    that call' is answerable from docker logs:  grep 'ttfb corr=<id>'."""

    def __init__(self, corr: str):
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
                except Exception:
                    pass

        self._corr = corr
        self._seen: list = []
        self.observer = _Obs()


class SentinelGate(FrameProcessor):
    """Between LLM and TTS: strips the steering markers from the token stream so
    they are never spoken, accumulates the assistant transcript one utterance at
    a time, tracks bot-speaking state for the idle watchdog, and stops the
    pipeline after the final utterance finished playing."""

    def __init__(self, outcome: CallOutcome, on_activity, set_bot_speaking,
                 transfer_closing: str = "Ek moment, main aapko connect kar rahi hoon.",
                 end_closing: str = "Theek hai, dhanyavaad. Aapka din shubh ho!"):
        super().__init__()
        self._outcome = outcome
        self._on_activity = on_activity
        self._set_bot_speaking = set_bot_speaking
        self._transfer_closing = transfer_closing
        self._end_closing = end_closing
        self._task: Optional[PipelineTask] = None
        self._buffer = ""          # marker hold-back across token chunks
        self._utterance = ""       # current assistant utterance (one transcript entry)
        self._spoke_this_response = False
        self._response_active = False  # LLM tokens still streaming for this response

    def set_task(self, task: PipelineTask):
        self._task = task

    async def process_frame(self, frame: Frame, direction: FrameDirection):
        await super().process_frame(frame, direction)

        if isinstance(frame, LLMTextFrame):
            self._on_activity(user=False)
            self._response_active = True
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
            self._response_active = False
            self._flush_utterance()
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


_PLACEHOLDER_RE = re.compile(r"\{\{\s*([a-zA-Z0-9_ ]+?)\s*\}\}")


def _lead_field(context: Dict[str, Any], *names: str) -> str | None:
    """First non-blank lead custom field matching any of `names` (case-insensitive)."""
    fields = context.get("leadFields") or {}
    wanted = {n.strip().lower() for n in names}
    for k, v in fields.items():
        if str(k).strip().lower() in wanted and v is not None and str(v).strip():
            return str(v).strip()
    return None


def _fill_placeholders(text: str, context: Dict[str, Any]) -> str:
    """Substitute the author's {{placeholders}} with real call values BEFORE the model
    sees the prompt. Left literal, `{{institute_name}}` etc. reach the model, which then
    improvises or fills them wrong (observed: {{institute_name}} became our account's
    legal name, not the brand). Unknown/empty → a graceful neutral, never a literal
    '{{...}}'. NOTE: {{institute_name}} is the PROSPECT's institute — deliberately NOT
    our instituteName (that mash-up is what produced the wrong-company opening)."""
    if not text or "{{" not in text:
        return text
    lead_name = context.get("leadName")
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

    def repl(m: "re.Match[str]") -> str:
        return values.get(m.group(1).strip().lower(), "")

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
    return out[:600]


def build_system_prompt(context: Dict[str, Any]) -> str:
    agent = context.get("agent") or {}
    lead_name = context.get("leadName")
    extraction = agent.get("extractionQuestions") or []
    dispositions = agent.get("dispositions") or []
    name = agent.get("name") or "the assistant"
    stt_tag, lang_label = _agent_language(agent)
    is_english = stt_tag == "en-IN"
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
        f"5) Speak {lang_label} and STAY in it for the whole call. Every reply must be in the "
        f"same language and script as YOUR OWN previous turns — mirror yourself, not the "
        f"transcript. A single word from the caller in any other language ('yes', 'achha', "
        f"'haan') is NEVER a cue to switch; if a transcript looks like another language, treat "
        f"it as a mis-heard {lang_label} line. Switch only if the caller explicitly asks, or "
        f"speaks 3+ consecutive full sentences in the other language."
    )

    prompt = _fill_placeholders(agent.get("systemPrompt") or "", context)

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
        "headings. No stage directions or parentheticals. Only words meant to be heard."
    )
    fast_open_rule = (
        "- Begin every reply with a short natural clause (a few words) before any longer "
        "sentence — it reaches the caller faster and sounds more human."
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
        "- CLOSE CONCRETELY: pursue your objective actively. A vague acknowledgment "
        "('okay', 'thanks', 'theek hai') is NOT a confirmation — when booking anything, "
        "propose two specific slots, get ONE explicitly confirmed (exact day + time), "
        "and confirm the contact channel (read a number back digit by digit). Never "
        "announce a meeting/demo as scheduled unless the caller has named or accepted "
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
            "ONCE as they specify; never add a second greeting or re-introduce yourself.",
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
        ("- Never repeat the same acknowledgment twice in a row. Rotate naturally — right / "
         "got it / sure / absolutely — don't open every turn the same way."
         if is_english else
         "- Never repeat the same acknowledgment twice in a row. Rotate naturally — हाँ / अच्छा / "
         "ठीक है / जी बिल्कुल / समझ गई — don't say 'ji' every single turn."),
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
    settings = get_settings()
    agent = context.get("agent") or {}

    # Idle/pacing state shared between the processors and the watchdog. The idle
    # clock only escalates while the bot is NOT speaking (TTS playout is real-time
    # and much slower than token generation), and only USER activity re-arms the
    # nudge — otherwise the nudge's own audio resets it and hangup never escalates.
    flags = {"t": time.time(), "nudged": False, "bot_speaking": False,
             "user_speaking": False, "stopping_since": None}

    def on_activity(user: bool = True):
        flags["t"] = time.time()
        if user:
            flags["nudged"] = False

    def set_bot_speaking(speaking: bool):
        flags["bot_speaking"] = speaking

    def set_user_speaking(speaking: bool):
        flags["user_speaking"] = speaking

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
    end_closing = ("Alright, thank you. Have a great day!" if eng
                   else "Theek hai, dhanyavaad. Aapka din shubh ho!")
    eng_fillers = ("Hmm…", "Right…", "Okay…")
    # Bias STT toward the agent's own name so a caller repeating it ("aapka naam Aarushi
    # tha?") isn't transcribed as "Aayushi"/"Aarush" and fed back into the LLM context as
    # a wrong name — the #1 way the agent "forgets" its name mid-call.
    stt_bias = (agent.get("name") or "").strip() or None
    stt = build_stt(settings.sample_rate, language=stt_lang, bias=stt_bias)
    llm = build_llm()
    tts = build_tts(settings.sample_rate, voice=agent.get("voice"),
                    aiohttp_session=aiohttp_session,
                    pace=_as_float(agent.get("pace")),
                    temperature=_as_float(agent.get("temperature")))

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
                                     is_bot_speaking=lambda: flags["bot_speaking"],
                                     set_user_speaking=set_user_speaking,
                                     filler_phrases=eng_fillers if eng else None)
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
        observers=[TtfbObserver(corr).observer],
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
        while time.time() - connect_t < settings.greet_delay_secs:
            if flags["t"] > connect_t + 0.05:
                logger.info("greet: callee spoke first — LLM replies, skipping our open (corr=%s)", corr)
                return
            await asyncio.sleep(0.1)
        if opening:
            # Append to the LLM CONTEXT as well as speaking: a TTSSpeakFrame is consumed
            # by the TTS and its text NEVER reaches the assistant aggregator (verified in
            # pipecat 0.0.95 source), so the model didn't know it had already greeted and
            # re-greeted from scratch on the caller's first reply — the observed
            # double/triple-greeting. run_llm omitted => append only, no generation.
            logger.info("greet: openingLine spoken (corr=%s)", corr)
            outcome.transcript.append({"role": "assistant", "text": opening})
            await task.queue_frames([
                LLMMessagesAppendFrame(messages=[{"role": "assistant", "content": opening}]),
                TTSSpeakFrame(opening)])
        else:
            # No scripted line → LLM opens. Seed a synthetic caller 'Hello?' into the LLM
            # context (NOT our saved transcript) and run: this reproduces the exact
            # proven caller-spoke-first path, so the model reliably emits its persona
            # opening instead of us hoping it generates from a system-only context.
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
                await task.queue_frames([TTSSpeakFrame(cap_farewell)])
                await _begin_stop()
                continue

            # Idle handling — clock paused while the bot is speaking AND while the
            # CALLER is speaking (VAD-armed): Sarvam STT emits finals only, so during a
            # long caller utterance no transcript arrives and the clock used to go
            # stale — the nudge fired at the caller mid-sentence.
            if flags["bot_speaking"] or flags["user_speaking"]:
                continue
            idle = time.time() - flags["t"]
            if idle < settings.idle_timeout_secs:
                continue
            if not flags["nudged"]:
                flags["nudged"] = True
                flags["t"] = time.time()
                # Context-append too: TTSSpeakFrame text never reaches the LLM context,
                # so without this the model doesn't know it asked and can't react to
                # the caller's "haan sun raha hoon" coherently.
                await task.queue_frames([
                    LLMMessagesAppendFrame(messages=[{"role": "assistant", "content": nudge_text}]),
                    TTSSpeakFrame(nudge_text)])
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
