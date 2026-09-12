"""Phase 2 of the simulator: TIMING. Runs the REAL pipeline — run_bot with its
gates, aggregator, VAD, Smart Turn, watchdog — on a simulated phone line, with
stub STT/LLM/TTS services that behave like vendors (latency, streaming) but cost
nothing. Real speech audio (sim/fixtures/caller_speech_8k.wav, one TTS render)
drives the VAD, so barge-in, ducking, held tails, resumes, nudges and closes all
happen the way they do on a call.

    docker compose exec voice-bot python -m sim.timing            # all scenarios
    python -m sim.timing --scenarios yes_over_tail,silent_caller --verbose

Each scenario scripts the caller (what, when — absolute or relative to the bot's
k-th utterance) and the model's replies, then asserts on what the LINE carried:
bot audio intervals, the played transcript, the diagnostics. Not covered:
STT accuracy (the stub transcribes perfectly), audio quality, vendor outages."""
from __future__ import annotations

import argparse
import asyncio
import json
import sys
import time
import wave
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

import numpy as np

FIXTURE_DIR = Path(__file__).parent / "fixtures"
SR_LINE = 8000


# ── caller audio ────────────────────────────────────────────────────────────

def _load_wav(path: Path) -> np.ndarray:
    with wave.open(str(path)) as w:
        assert w.getframerate() == SR_LINE and w.getnchannels() == 1
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16)


# Complete utterances (one TTS render each), so Smart Turn hears a natural
# ending: a clip cut mid-word made it hold EVERY caller turn open for the full
# 5 s stop-timeout. Picked by the Say text; anything else uses the long clip.
CLIPS = {k: _load_wav(FIXTURE_DIR / "caller" / f"caller_{k}_8k.wav")
         for k in ("yes_go_ahead", "yes", "hello", "haan", "cut_the_call", "good_morning", "long")}
_CLIP_FOR = {"yes, go ahead.": "yes_go_ahead", "yes.": "yes", "hello.": "hello", "hello?": "hello",
             "haan.": "haan", "good morning.": "good_morning",
             "i don't need this. cut the call, thank you.": "cut_the_call"}


def clip_for(text: str, secs: float) -> np.ndarray:
    key = _CLIP_FOR.get(text.strip().lower())
    if key:
        return CLIPS[key]
    return CLIPS["long"][: int(secs * SR_LINE)]


@dataclass
class Say:
    """One caller utterance: text the stub STT will emit, how long the voice
    lasts on the line, and WHEN it starts."""
    text: str
    secs: float = 1.6                   # only for texts without a dedicated clip
    at: float | None = None            # absolute seconds from call start
    after_bot_start: int | None = None  # index (1-based) of bot utterance…
    after_bot_stop: int | None = None   # …and an offset from its start/stop
    offset: float = 0.0
    stt_latency: float = 0.55           # Sarvam final after the voice stops
    finals: List[str] | None = None     # split into several finals (fragments)


@dataclass
class Scenario:
    key: str
    caller: List[Say]
    replies: List[str]                  # the model's replies, in order
    checks: Callable[[Dict[str, Any]], List[str]]
    max_secs: float = 60.0
    ttft: float = 0.45
    tts_ttfb: float = 0.35
    note: str = ""


# ── the simulated line ──────────────────────────────────────────────────────

class Line:
    """Shared clock + what the line carried. Bot audio intervals come from the
    output transport's paced writes; caller intervals from the feeder."""

    def __init__(self):
        self.t0 = time.perf_counter()
        self.bot: List[List[float]] = []       # [start, end] per utterance
        self.caller: List[List[float]] = []
        self.finals: List[tuple] = []          # (t, text)
        self._last_bot_write = -10.0

    def now(self) -> float:
        return time.perf_counter() - self.t0

    def bot_wrote(self, secs_of_audio: float):
        t = self.now()
        if t - self._last_bot_write > 0.35:
            self.bot.append([t, t + secs_of_audio])
        else:
            self.bot[-1][1] = max(self.bot[-1][1], t + secs_of_audio)
        self._last_bot_write = t

    def bot_speaking(self) -> bool:
        return bool(self.bot) and self.now() < self.bot[-1][1]


def build(scenario: Scenario, line: Line, verbose: bool = False):
    from pipecat.frames.frames import (Frame, InputAudioRawFrame, InterruptionFrame,
                                       LLMContextFrame, LLMFullResponseEndFrame,
                                       LLMFullResponseStartFrame, LLMTextFrame,
                                       OutputAudioRawFrame, StartFrame, TranscriptionFrame,
                                       TTSAudioRawFrame, TTSStartedFrame, TTSStoppedFrame)
    from pipecat.processors.frame_processor import FrameDirection, FrameProcessor
    from pipecat.services.llm_service import LLMService
    from pipecat.services.tts_service import TTSService
    from pipecat.transports.base_input import BaseInputTransport
    from pipecat.transports.base_output import BaseOutputTransport
    from pipecat.transports.base_transport import BaseTransport, TransportParams

    log = (lambda *a: print(f"[{line.now():6.2f}s]", *a)) if verbose else (lambda *a: None)

    class SimSTT(FrameProcessor):
        """Passes everything through (the aggregator's VAD needs the audio) and
        emits scripted finals when the feeder tells it to."""
        async def process_frame(self, frame: Frame, direction: FrameDirection):
            await super().process_frame(frame, direction)
            await self.push_frame(frame, direction)

        async def emit(self, text: str):
            line.finals.append((line.now(), text))
            log("STT final:", repr(text))
            await self.push_frame(TranscriptionFrame(text=text, user_id="caller",
                                                     timestamp=str(time.time()), finalized=True),
                                  FrameDirection.DOWNSTREAM)

    class SimLLM(LLMService):
        def __init__(self):
            super().__init__()
            self._i = 0
            self._gen = None
            self.runs = 0
            self.prompts: List[str] = []       # last user message per run (cues included)

        async def process_frame(self, frame: Frame, direction: FrameDirection):
            await super().process_frame(frame, direction)
            if isinstance(frame, InterruptionFrame) and self._gen and not self._gen.done():
                await self.cancel_task(self._gen)
                self._gen = None
            if isinstance(frame, LLMContextFrame):
                msgs = frame.context.get_messages()
                last_user = next((m.get("content") for m in reversed(msgs)
                                  if isinstance(m, dict) and m.get("role") == "user"), "")
                self._gen = self.create_task(self._generate(str(last_user)))
                return
            await self.push_frame(frame, direction)

        async def _generate(self, last_user: str):
            self.runs += 1
            self.prompts.append(last_user)
            # A steering cue ("[…]") from the gates counts as a turn too: the
            # scripted replies are consumed in order, whatever prompted them.
            text = scenario.replies[self._i] if self._i < len(scenario.replies) else "Okay."
            self._i += 1
            log(f"LLM run {self.runs} for {last_user[:40]!r} → {text[:60]!r}")
            await self.push_frame(LLMFullResponseStartFrame())
            await asyncio.sleep(scenario.ttft)
            for w in text.split(" "):
                await self.push_frame(LLMTextFrame(w + " "))
                await asyncio.sleep(0.025)
            await self.push_frame(LLMFullResponseEndFrame())

    class SimTTS(TTSService):
        """Vendor-shaped: TTFB, then audio streamed faster than realtime. Voiced
        synthetic signal (not the caller clip) so an echo path can never
        confuse the two."""
        def __init__(self):
            # Turn-level audio context (pipecat default): this is what every
            # agent whose speech cache is OFF runs in production. With the cache
            # on (Aarushi 2, FULL) Smallest gets one context per sentence and text
            # reaches the played-transcript recorder per sentence instead —
            # a difference the "Yes over the question" scenario is sensitive to.
            # Same base flags as pipecat's SmallestTTSService: it pushes
            # TTSStarted/TTSStopped itself (the bot-speaking flag, the sentinel's
            # utterance bracket and the played-transcript recorder all key on
            # them) and pauses frame processing while a sentence renders. One
            # audio context per sentence as the speech cache configures it.
            super().__init__(sample_rate=24000, push_start_frame=True, push_stop_frames=True,
                             pause_frame_processing=True, reuse_context_id_within_turn=False)
            self.model_name = "sim-tts"

        async def run_tts(self, text: str, context_id: str):
            words = max(1, len(text.split()))
            secs = max(0.5, words / 2.8)
            await asyncio.sleep(scenario.tts_ttfb)
            n = int(24000 * secs)
            t = np.arange(n) / 24000.0
            f0 = 190 + 25 * np.sin(2 * np.pi * 1.7 * t)
            sig = np.sin(2 * np.pi * np.cumsum(f0) / 24000.0) * 9000
            pcm = sig.astype(np.int16).tobytes()
            step = 24000 * 2 // 50                     # 20 ms
            yield TTSStartedFrame(context_id=context_id)
            for i in range(0, len(pcm), step):
                yield TTSAudioRawFrame(pcm[i:i + step], 24000, 1, context_id=context_id)
            yield TTSStoppedFrame(context_id=context_id)

    class SimInput(BaseInputTransport):
        def __init__(self, params, feeder):
            super().__init__(params)
            self._feeder = feeder

        async def start(self, frame: StartFrame):
            await super().start(frame)
            await self.set_transport_ready(frame)
            self._feed_task = self.create_task(self._feeder(self))

        async def stop(self, frame):
            await super().stop(frame)

    class SimOutput(BaseOutputTransport):
        interruptions = 0

        async def process_frame(self, frame: Frame, direction: FrameDirection):
            if isinstance(frame, InterruptionFrame):
                self.interruptions += 1
                log("OUTPUT interruption → dropping queued bot audio")
            n = type(frame).__name__
            if n in ("TTSStartedFrame", "TTSStoppedFrame", "BotStartedSpeakingFrame",
                     "BotStoppedSpeakingFrame", "UserStartedSpeakingFrame", "UserStoppedSpeakingFrame"):
                log(f"OUTPUT sees {n} ({'down' if direction == FrameDirection.DOWNSTREAM else 'up'})")
            await super().process_frame(frame, direction)

        async def start(self, frame: StartFrame):
            await super().start(frame)
            await self.set_transport_ready(frame)

        _pace_t = 0.0

        async def write_audio_frame(self, frame: OutputAudioRawFrame) -> bool:
            # Plivo consumes audio in real time and the FastAPI transport paces
            # its writes to match; the base class does not. Without this the whole
            # reply "plays" in a few ms and every timing below is fiction.
            secs = len(frame.audio) / 2 / frame.sample_rate
            now = time.perf_counter()
            if self._pace_t < now - 0.5:
                self._pace_t = now
            await asyncio.sleep(max(0.0, self._pace_t - now))
            line.bot_wrote(secs)
            self._pace_t += secs
            return True

    class SimTransport(BaseTransport):
        def __init__(self, feeder):
            super().__init__()
            params = TransportParams(audio_in_enabled=True, audio_in_sample_rate=SR_LINE,
                                     audio_out_enabled=True, audio_out_sample_rate=SR_LINE,
                                     audio_in_stream_on_start=True)
            self._in = SimInput(params, feeder)
            self._out = SimOutput(params)
            self._register_event_handler("on_client_connected")
            self._register_event_handler("on_client_disconnected")

        def input(self):
            return self._in

        def output(self):
            return self._out

        async def connected(self):
            await self._call_event_handler("on_client_connected", None)

    stt = SimSTT()
    llm = SimLLM()
    tts = SimTTS()
    pending: List[Say] = list(scenario.caller)

    async def feeder(inp: SimInput):
        """Streams the line in 20 ms frames of silence or fixture speech, in real
        time, and fires each Say when its trigger is met."""
        await transport.connected()
        frame_n = SR_LINE // 50
        silence = np.zeros(frame_n, dtype=np.int16).tobytes()
        speaking: Optional[Say] = None
        pos = 0; spoken_frames = 0; total_frames = 0
        next_t = time.perf_counter()
        while True:
            # trigger check
            if speaking is None:
                for s in list(pending):
                    due = False
                    if s.at is not None:
                        due = line.now() >= s.at
                    elif s.after_bot_start is not None and len(line.bot) >= s.after_bot_start:
                        due = line.now() >= line.bot[s.after_bot_start - 1][0] + s.offset
                    elif s.after_bot_stop is not None and len(line.bot) >= s.after_bot_stop:
                        iv = line.bot[s.after_bot_stop - 1]
                        due = (not (line.bot_speaking() and line.bot[-1] is iv)) and line.now() >= iv[1] + s.offset
                    if due:
                        pending.remove(s); speaking = s; pos = 0; spoken_frames = 0
                        clip = clip_for(s.text, s.secs)
                        total_frames = len(clip) // frame_n
                        line.caller.append([line.now(), line.now() + total_frames / 50])
                        log("CALLER starts:", repr(s.text), f"({total_frames / 50:.2f}s)")
                        break
            if speaking is not None:
                chunk = clip[pos:pos + frame_n]
                if len(chunk) < frame_n:
                    chunk = np.pad(chunk, (0, frame_n - len(chunk)))
                pos += frame_n; spoken_frames += 1
                await inp.push_audio_frame(InputAudioRawFrame(chunk.tobytes(), SR_LINE, 1))
                if spoken_frames >= total_frames:
                    s = speaking; speaking = None
                    finals = s.finals or [s.text]

                    async def _emit(finals=finals, lat=s.stt_latency):
                        await asyncio.sleep(lat)
                        for k, f in enumerate(finals):
                            await stt.emit(f)
                            if k + 1 < len(finals):
                                await asyncio.sleep(0.5)
                    inp.create_task(_emit())
            else:
                await inp.push_audio_frame(InputAudioRawFrame(silence, SR_LINE, 1))
            next_t += 0.02
            await asyncio.sleep(max(0.0, next_t - time.perf_counter()))

    transport = SimTransport(feeder)
    return transport, {"stt": stt, "llm": llm, "tts": tts}


async def run_scenario(scenario: Scenario, ctx: Dict[str, Any], verbose: bool = False) -> Dict[str, Any]:
    from app import bot as b
    ctx = json.loads(json.dumps(ctx))
    ctx["agent"]["speech_cache_mode"] = "OFF"
    ctx["agent"]["voiceModulation"] = 1.0
    ctx["corr"] = f"sim-{scenario.key}"
    line = Line()
    transport, providers = build(scenario, line, verbose)
    outcome = b.CallOutcome(corr=ctx["corr"], context=ctx)
    try:
        await asyncio.wait_for(b.run_bot(transport, ctx["corr"], ctx, outcome,
                                         aiohttp_session=None, providers=providers),
                               timeout=scenario.max_secs)
        ended_at = line.now()
    except asyncio.TimeoutError:
        ended_at = None
    d = outcome.diagnostics
    res = {
        "key": scenario.key,
        "bot": [[round(a, 2), round(b_, 2)] for a, b_ in line.bot],
        "caller": [[round(a, 2), round(b_, 2)] for a, b_ in line.caller],
        "finals": [(round(t, 2), x) for t, x in line.finals],
        "transcript": outcome.transcript,
        "ended_at": None if ended_at is None else round(ended_at, 2),
        "interruptions_at_output": transport.output().interruptions,
        "llm_runs": providers["llm"].runs,
        "llm_prompts": providers["llm"].prompts,
        "nudges": getattr(d, "nudges", 0) or 0,
        "opening_resaid": getattr(d, "opening_resaid", 0) or 0,
        "end_forced": getattr(outcome, "end_forced", False),
    }
    # turn latency: caller stop → next bot audio start
    lat = []
    for _, cend in line.caller:
        nxt = [s for s, _ in line.bot if s >= cend]
        if nxt:
            lat.append(round(nxt[0] - cend, 2))
    res["turn_latency"] = lat
    res["fails"] = scenario.checks(res)
    return res


# ── scenarios ───────────────────────────────────────────────────────────────

OPEN_ANSWER = "Yes, go ahead."
PITCH_Q = ("So the reason I called — we work with yoga teachers on everything around their online "
           "classes. The daily link, the reminders, the fees. Who's doing the daily running around "
           "right now? Is that you, or does someone help?")


def _assistant_texts(res):
    return [t["text"] for t in res["transcript"] if t["role"] == "assistant"]


def _after_user(res, needle):
    seen = False; out = []
    for t in res["transcript"]:
        if t["role"] == "user" and needle.lower() in t["text"].lower():
            seen = True
        elif seen and t["role"] == "assistant":
            out.append(t["text"])
    return out


def chk_yes_over_tail(res):
    f = []
    # The caller's "Yes." is the second caller interval. Bot audio must stop
    # for it and must NOT resume the held tail: the next bot audio has to be
    # the new reply (STT final + LLM + TTS ≈ 1 s after the caller stops), not
    # a resume (<0.6 s).
    if len(res["caller"]) >= 2:
        yes_start, yes_end = res["caller"][1]
        nxt = [s for s, _ in res["bot"] if s > yes_start + 0.3]
        if nxt and nxt[0] - yes_end < 0.8:
            f.append(f"held question tail resumed {nxt[0] - yes_end:.2f}s after the caller's 'Yes.'")
    if not any("ANSWER" in p for p in res.get("llm_prompts", [])[1:]):
        f.append("'Yes.' after the question was not cued as its answer (got: %s)"
                 % [p[:40] for p in res.get("llm_prompts", [])[1:]])
    if not any("on you" in t for t in _after_user(res, "Yes.")):
        f.append("no answer-reply followed the caller's 'Yes.'")
    return f


def chk_farewell(res):
    f = []
    if res["ended_at"] is None:
        f.append("call did not end after the farewell")
    if res["nudges"]:
        f.append(f"nudged {res['nudges']}x after the farewell")
    if res["ended_at"] and res["bot"] and res["ended_at"] - res["bot"][-1][1] > 5.0:
        f.append(f"line stayed open {res['ended_at'] - res['bot'][-1][1]:.1f}s after the goodbye")
    return f


def chk_backchannel(res):
    f = []
    texts = " ".join(_assistant_texts(res))
    if "on its own" not in texts:
        f.append("reply did not complete after the backchannel")
    if res["llm_runs"] > 2:
        f.append(f"backchannel triggered a new LLM run (runs={res['llm_runs']})")
    return f


def chk_silent(res):
    f = []
    if res["nudges"] < 1:
        f.append("no nudge for a silent caller")
    if res["ended_at"] is None:
        f.append("silent call never ended")
    if res["bot"] and len(res["bot"]) >= 2 and res["bot"][1][0] - res["bot"][0][1] > 13:
        f.append(f"first nudge {res['bot'][1][0] - res['bot'][0][1]:.1f}s after the opening (expected ~8s)")
    return f


def chk_hello_cuts_opening(res):
    f = []
    intros = sum(1 for t in _assistant_texts(res) if "Aarushi from Vacademy" in t)
    if intros == 0:
        f.append("caller never heard the introduction")
    if intros > 2:
        f.append(f"introduction played {intros}x")
    return f


def chk_forced_close(res):
    f = []
    if not res["end_forced"]:
        f.append("'cut the call' did not force the close")
    if res["ended_at"] is None:
        f.append("call did not end after 'cut the call'")
    after = _after_user(res, "cut the call")
    if any("?" in t for t in after):
        f.append("bot asked a question after 'cut the call'")
    return f


def chk_turn_latency(res):
    slow = [x for x in res["turn_latency"] if x > 2.5]
    return [f"turn latency {slow} s (caller stop → bot audio)"] if slow else []


SCENARIOS: List[Scenario] = [
    Scenario("yes_over_tail",
             caller=[Say(OPEN_ANSWER, 1.2, after_bot_stop=1, offset=0.6),
                     Say("Yes.", after_bot_start=2, offset=11.0, stt_latency=0.4)],
             replies=[PITCH_Q, "Great — so it's on you. Honestly, the fees part is what most teachers are fed up with."],
             checks=lambda r: chk_yes_over_tail(r) + chk_turn_latency(r), max_secs=40,
             note="call 34f258c2: '…Is that you?' → 'Yes.' → the held tail 'or does someone help?' resumed"),
    Scenario("farewell_without_marker",
             caller=[Say(OPEN_ANSWER, 1.2, after_bot_stop=1, offset=0.6)],
             replies=["No problem at all. Thank you for your time, namaste."],
             checks=chk_farewell, max_secs=40,
             note="recordings 4acc56a6/6fa15c09: goodbye without <<END_CALL>>, 8-11 s hole, then a nudge"),
    Scenario("backchannel_mid_reply",
             caller=[Say(OPEN_ANSWER, 1.2, after_bot_stop=1, offset=0.6),
                     Say("haan.", 0.45, after_bot_start=2, offset=2.0, stt_latency=0.4)],
             replies=["So the reason I called — we handle the daily running around of online yoga classes. "
                      "The link goes out to everyone on WhatsApp on its own. Are your classes online at the moment?"],
             checks=chk_backchannel, max_secs=40,
             note="founder rule 2026-08-05: absorb but never lose — a 'haan' mid-reply must not cut or restart it"),
    Scenario("silent_caller",
             caller=[],
             replies=[],
             checks=chk_silent, max_secs=45,
             note="nobody answers after the opening: one nudge at ~8 s, then the idle farewell and hang-up"),
    Scenario("hello_then_silence",
             caller=[Say("Hello.", at=0.5)],
             replies=[],
             checks=chk_silent, max_secs=45,
             note="the callee's pickup 'Hello' lands before the opening, then nothing: the nudge must still come"),
    Scenario("hello_cuts_opening",
             caller=[Say("Hello.", 0.6, after_bot_start=1, offset=0.8),
                     Say(OPEN_ANSWER, 1.2, after_bot_stop=2, offset=0.8)],
             replies=[PITCH_Q],
             checks=chk_hello_cuts_opening, max_secs=40,
             note="call 9e566e32: the callee's 'Hello' 0.8 s into the opening cut it; the caller must still hear who is calling"),
    Scenario("cut_the_call_forced_close",
             caller=[Say(OPEN_ANSWER, 1.2, after_bot_stop=1, offset=0.6),
                     Say("I don't need this. Cut the call, thank you.", 2.2, after_bot_stop=2, offset=0.5)],
             replies=[PITCH_Q, "Just to clarify, is it that you don't take online classes, or someone handles it?"],
             checks=chk_forced_close, max_secs=45,
             note="call ada2e60c: the model clarifies instead of ending; the gate must end the call anyway"),
]
BY_KEY = {s.key: s for s in SCENARIOS}


async def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--scenarios", default="all")
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--out", default="sim_timing.json")
    ap.add_argument("--ci", action="store_true")
    args = ap.parse_args()
    ctx = json.loads((FIXTURE_DIR / "yoga_agent_context.json").read_text(encoding="utf-8"))
    keys = [s.key for s in SCENARIOS] if args.scenarios == "all" else args.scenarios.split(",")
    results = []
    for k in keys:
        sc = BY_KEY[k]
        try:
            res = await run_scenario(sc, ctx, args.verbose)
        except Exception as e:  # noqa: BLE001
            res = {"key": k, "fails": [f"run error: {type(e).__name__}: {str(e)[:160]}"], "turn_latency": []}
        results.append(res)
        st = "FAIL" if res["fails"] else "ok  "
        print(f"{st} {k:28s} latency {res.get('turn_latency')} ended {res.get('ended_at')} nudges {res.get('nudges', '?')} llm_runs {res.get('llm_runs', '?')}")
        for f in res["fails"]:
            print(f"       ✗ {f}")
    Path(args.out).write_text(json.dumps(results, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"report → {args.out}")
    if args.ci and any(r["fails"] for r in results):
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
