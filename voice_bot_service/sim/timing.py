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
import logging
import asyncio
import json
import os
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
         for k in ("yes_go_ahead", "yes", "hello", "haan", "cut_the_call", "good_morning", "long",
                   # A short answer, a 0.45 s breath, then a long sentence — the
                   # shape Smallest Pulse DROPPED on the founder's 2026-09-15 calls
                   # (VAD stop inside the breath → finalize → the rest never lands).
                   "pause_then_long", "haan_pause_long", "yga_pause_long")}
_CLIP_FOR = {"yes, go ahead.": "yes_go_ahead", "yes.": "yes", "hello.": "hello", "hello?": "hello",
             "haan.": "haan", "good morning.": "good_morning",
             "i don't need this. cut the call, thank you.": "cut_the_call"}


def clip_for(text: str, secs: float, clip: str | None = None) -> np.ndarray:
    key = clip or _CLIP_FOR.get(text.strip().lower())
    if key:
        return CLIPS[key]
    n = int(secs * SR_LINE)
    base = CLIPS["long"]
    if n > len(base):                       # a replayed 30 s answer: loop the voice
        base = np.tile(base, n // len(base) + 1)
    return base[:n]


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
    clip: str | None = None             # CLIPS key, when the text has no clip of its own
    final_times: List[float] | None = None  # absolute seconds per final (replay); else after the voice


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
    # Sentences pre-loaded into the speech cache under exactly the key run_bot's
    # install_tts_cache will look them up with, so the reply HITS the cache and
    # the cached-sentence path (own audio context, synchronous frames) runs for
    # real. Non-empty also keeps the agent's speech_cache_mode FULL.
    cache_warm: List[str] = field(default_factory=list)
    # "smallest": pipecat's REAL SmallestTTSService, built by production's
    # build_tts, talking to sim/smallest_fake.py's protocol-faithful socket
    # instead of SimTTS. The speech-cache scenarios need it — SimTTS yields its
    # audio synchronously, which is how a cache HIT works, not how Smallest does.
    engine: str = "sim"
    # Chance of a thinking filler ("Hmm…") on a turn. 0 by default so a gate
    # never flips a coin: production's 10% made a random scenario fail about
    # one deploy in several (a6252b5c57's gate: a filler before a reply read
    # as a hole inside it). Scenarios that exercise the filler set 1.0.
    # SIM_FILLER_PROBABILITY overrides every scenario, for a forced run.
    filler: float = 0.0
    # Needs the REAL STT (python -m sim.timing --real-stt): the check is about
    # what the vendor transcribes from the fixture audio, not the pipeline.
    # Skipped by "all" without the flag.
    real_stt: bool = False
    # Replay: pick the recorded reply for THIS run by its trigger text instead
    # of consuming replies in order (the fixed pipeline may run fewer times).
    reply_for: Callable[[str], str | None] | None = None


# ── the simulated line ──────────────────────────────────────────────────────

class Line:
    """Shared clock + what the line carried. Bot audio intervals come from the
    output transport's paced writes; caller intervals from the feeder."""

    def __init__(self):
        self.t0 = time.perf_counter()
        self.bot: List[List[float]] = []       # [start, end] per utterance
        self.caller: List[List[float]] = []
        self.finals: List[tuple] = []          # (t, text)
        self.tts_texts: List[str] = []         # every sentence handed to the TTS
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


def build(scenario: Scenario, line: Line, verbose: bool = False, real_stt: bool = False):
    from pipecat.frames.frames import (Frame, InputAudioRawFrame, InterruptionFrame, TTSSpeakFrame,
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
            text = None
            if scenario.reply_for is not None:
                text = scenario.reply_for(last_user)
            if text is None:
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
            # push_text_frames=False like Smallest (word_timestamps=True): the
            # TTSTextFrames come from word timings, not from the base class
            # after run_tts. The speech cache's hit path keys on this flag.
            super().__init__(sample_rate=24000, push_start_frame=True, push_stop_frames=True,
                             pause_frame_processing=True, reuse_context_id_within_turn=False,
                             push_text_frames=False)
            self.model_name = "sim-tts"

        async def run_tts(self, text: str, context_id: str):
            log(f"TTS run_tts {text[:40]!r}")
            line.tts_texts.append(text)
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
            # Word timings, as Smallest reports them: pipecat turns these into
            # the TTSTextFrames the played-transcript recorder keys on.
            per = secs / words
            await self.add_word_timestamps(
                [(w, i * per) for i, w in enumerate(text.split())], context_id)
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

    if real_stt:
        # The production STT (STT_PROVIDER from the env), fed the fixture audio
        # at line rate. Its finals are tapped here so the report and the checks
        # see exactly what the pipeline saw.
        from pipecat.frames.frames import InterimTranscriptionFrame
        from app.providers import build_stt_waterfall
        stt, _stt_primary, _stt_fallback = build_stt_waterfall(SR_LINE)
        if os.environ.get("SIM_DEAF_PRIMARY") and _stt_fallback is not None:
            # A primary that hears nothing — the shape of Smallest's last 70 s
            # on call 28570ec0 — in front of the real fallback, so the orphan
            # re-ask → manual failover path runs for real.
            from pipecat.pipeline.service_switcher import (ServiceSwitcher,
                                                           ServiceSwitcherStrategyFailover)
            from pipecat.services.stt_service import STTService

            class DeafSTT(STTService):
                async def run_stt(self, audio: bytes):
                    if False:
                        yield None
            _stt_primary = DeafSTT(sample_rate=SR_LINE)
            stt = ServiceSwitcher([_stt_primary, _stt_fallback],
                                  strategy_type=ServiceSwitcherStrategyFailover)
        # Tap the finals where they leave the service(s), not the switcher
        # (a ParallelPipeline's push_frame is not the services' push_frame).
        _tap_targets = [t for t in (_stt_primary, _stt_fallback) if t is not None]
        _orig_push = None

        for _svc in _tap_targets:
            def _mk(svc):
                orig = svc.push_frame

                async def _tap(frame, direction=FrameDirection.DOWNSTREAM):
                    if (isinstance(frame, TranscriptionFrame)
                            and not isinstance(frame, InterimTranscriptionFrame) and frame.text.strip()):
                        line.finals.append((line.now(), frame.text.strip()))
                        log(f"STT final ({type(svc).__name__}):", repr(frame.text.strip()))
                    await orig(frame, direction)
                return _tap
            _svc.push_frame = _mk(_svc)
    else:
        stt = SimSTT()
    llm = SimLLM()
    if scenario.engine == "smallest":
        from sim.smallest_fake import patch_smallest_service
        os.environ.setdefault("SMALLEST_API_KEY", "sim-not-a-key")
        from app.config import get_settings as _gs
        # Settings may already exist (an earlier scenario built it) and is
        # frozen — without a key build_tts silently falls back to Sarvam.
        if not _gs().smallest_api_key:
            object.__setattr__(_gs(), "smallest_api_key", "sim-not-a-key")
        line.smallest_sockets = []
        patch_smallest_service(line.smallest_sockets)
        from app.providers import build_tts
        tts = build_tts(24000, voice="mrunal", tts_model="smallest_pro", pace=1.05,
                        language="hi")
        _orig_run_tts = tts.run_tts

        async def _logged_run_tts(text, context_id=None, _o=_orig_run_tts):
            log(f"TTS run_tts {text[:40]!r}")
            line.tts_texts.append(text)
            async for f in _o(text, context_id):
                yield f
        tts.run_tts = _logged_run_tts
    else:
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
                        clip = clip_for(s.text, s.secs, s.clip)
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
                if (speaking is not None and spoken_frames == 1 and speaking.final_times
                        and not real_stt):
                    # Replay: finals land at their RECORDED times, mid-speech or
                    # after it, independent of the voice clip.
                    s = speaking

                    async def _emit_at(s=s):
                        t_prev = line.now()
                        for k, f in enumerate(s.finals or []):
                            at = s.final_times[k] if k < len(s.final_times) else t_prev + 0.5
                            await asyncio.sleep(max(0.0, at - line.now()))
                            t_prev = line.now()
                            if f:
                                await stt.emit(f)
                    inp.create_task(_emit_at())
                if spoken_frames >= total_frames:
                    s = speaking; speaking = None
                    if real_stt or s.final_times:
                        continue                    # the vendor / the record decides what was said
                    finals = s.finals or [s.text]

                    async def _emit(finals=finals, lat=s.stt_latency):
                        await asyncio.sleep(lat)
                        for k, f in enumerate(finals):
                            if f:                       # "" = the STT returned nothing
                                await stt.emit(f)
                            if k + 1 < len(finals):
                                await asyncio.sleep(0.5)
                    inp.create_task(_emit())
            else:
                await inp.push_audio_frame(InputAudioRawFrame(silence, SR_LINE, 1))
            next_t += 0.02
            await asyncio.sleep(max(0.0, next_t - time.perf_counter()))

    transport = SimTransport(feeder)
    out = {"stt": stt, "llm": llm, "tts": tts}
    if real_stt:
        out["stt_primary"], out["stt_fallback"] = _stt_primary, _stt_fallback
    return transport, out


def _warm_cache(tts, agent: Dict[str, Any], lines: List[str]) -> None:
    """Store `lines` in the speech cache the way a previous call would have,
    keyed exactly as run_bot's install_tts_cache keys a lookup for this tts
    service and agent (engine_of, _agent_voice, pace, temperature)."""
    from app import ttscache
    from app.bot import _agent_voice, _as_float
    from app.providers import engine_of
    engine, model = engine_of(tts)
    from app.speech_language import smallest_language_code
    render_language = (smallest_language_code(agent.get("language"))
                       if engine.lower() == "smallest" else "")
    cache = ttscache.get_cache()
    cache.open()
    for text in lines:
        norm = text.strip()
        key = ttscache.cache_key(engine=engine.lower(), model=model,
                                 voice=_agent_voice(agent) or "",
                                 pace=_as_float(agent.get("pace")),
                                 temperature=_as_float(agent.get("temperature")),
                                 sample_rate=ttscache.SAMPLE_RATE, term_map_version="",
                                 text=norm, language=render_language)
        cand = ttscache.Candidate(key=key, text=norm, chars=len(norm), engine=engine.lower(),
                                  model=model, voice=_agent_voice(agent) or "",
                                  pace=_as_float(agent.get("pace")),
                                  temperature=_as_float(agent.get("temperature")), fixed=True)
        cache.ladder([cand])
        # ~60 ms per character of voiced 8 kHz tone: inside plausible_duration.
        n = int(ttscache.SAMPLE_RATE * 0.06 * len(norm))
        t = np.arange(n) / ttscache.SAMPLE_RATE
        pcm = (np.sin(2 * np.pi * 210 * t) * 9000).astype(np.int16).tobytes()
        ok = cache.store(cand, pcm)
        if not ok:
            raise RuntimeError(f"cache warm refused {norm!r}")


async def run_scenario(scenario: Scenario, ctx: Dict[str, Any], verbose: bool = False,
                       real_stt: bool = False) -> Dict[str, Any]:
    from app import bot as b
    ctx = json.loads(json.dumps(ctx))
    ctx["agent"]["speech_cache_mode"] = "FULL" if scenario.cache_warm else "OFF"
    ctx["agent"]["voiceModulation"] = 1.0
    ctx["corr"] = f"sim-{scenario.key}"
    from app.config import get_settings as _gs
    # A fresh, empty speech cache per scenario. One shared cache let a
    # sentence rendered in an earlier scenario (the background sweeper warms
    # what it saw) change the timing of a later one: the filler scenario
    # passed alone and failed in the full run.
    import tempfile
    from app import ttscache as _tc
    _tc._CACHE = _tc.SpeechCache(root=tempfile.mkdtemp(prefix=f"sim-cache-{scenario.key}-"))
    _tc._CACHE.open()
    _p = os.environ.get("SIM_FILLER_PROBABILITY")
    object.__setattr__(_gs(), "filler_probability",
                       float(_p) if _p not in (None, "") else scenario.filler)
    line = Line()
    transport, providers = build(scenario, line, verbose, real_stt)
    if scenario.cache_warm:
        _warm_cache(providers["tts"], ctx["agent"], scenario.cache_warm)
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
        "tts_texts": list(line.tts_texts),
        "transcript": outcome.transcript,
        "ended_at": None if ended_at is None else round(ended_at, 2),
        "interruptions_at_output": transport.output().interruptions,
        "llm_runs": providers["llm"].runs,
        "llm_prompts": providers["llm"].prompts,
        "nudges": getattr(d, "nudges", 0) or 0,
        "replies_scripted": list(scenario.replies),
        "stt_failovers": getattr(d, "stt_failovers", 0) or 0,
        "orphan_reasks": getattr(d, "orphan_reasks", 0) or 0,
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


def _after_word(text: str, word: str, ttfb: float = 0.35) -> float:
    """Seconds after the bot utterance starts at which `word` has finished
    playing under SimTTS's pacing (words / 2.8 per second, first audio after
    ttfb)."""
    words = text.split()
    i = words.index(word)
    per = max(0.5, len(words) / 2.8) / len(words)
    return round(ttfb + (i + 1) * per + 0.15, 2)


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
    """Founder 2026-09-17 (call 1e374b99): "हम्म" / "ठीक है" over a reply left a
    1.7-5.9 s hole, an acknowledgement, and a sentence missing its opening
    words. The reply must resume with the SAME words, fast, no generation."""
    f = []
    texts = " ".join(_assistant_texts(res))
    if "on its own" not in texts:
        f.append("reply did not complete after the backchannel")
    if res["llm_runs"] > 2:
        f.append(f"backchannel triggered a new LLM run (runs={res['llm_runs']})")
    # Every word of the interrupted reply reaches the caller.
    reply = (res.get("replies_scripted") or [""])[0]
    for phrase in ("daily running around", "goes out to everyone on WhatsApp",
                   "Are your classes online at the moment?"):
        if phrase and phrase not in texts:
            f.append(f"words lost across the backchannel: {phrase!r} never played")
    # NOTE: this simulator cannot cut the bot with a backchannel — its
    # aggregator keeps the first caller turn open, so a second short burst
    # never broadcasts an interruption. The cut-and-resume path (call
    # 1e374b99) is covered by the unit tests and by sim.replay's
    # "resumed after a backchannel" invariant, which runs on real calls.
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


def chk_turn_latency(res, bar: float = 2.5):
    slow = [x for x in res["turn_latency"] if x > bar]
    return [f"turn latency {slow} s (caller stop → bot audio, bar {bar})"] if slow else []


def chk_fragment_tail(res):
    """Call 31763255 (2026-09-12): Smallest split "…say somet" / "hing" and
    "? It makes" / "some". The second fragment must not kill the reply
    generated for the first: one LLM run, the reply plays in full, and no
    interruption reaches the output after the caller's turn."""
    f = []
    if len(res["caller"]) < 2:
        return ["caller turns missing"]
    cend = res["caller"][1][1]
    if res["llm_runs"] != 2:
        f.append(f"expected 2 LLM runs (opening answer + one reply), got {res['llm_runs']}")
    ivs = [iv for iv in res["bot"] if cend <= iv[0] < cend + 12.0]
    total = sum(b - a for a, b in ivs)
    if total < 4.0:
        f.append(f"reply audio only {total:.1f}s after the fragmented turn — it was cut")
    texts = " ".join(_assistant_texts(res))
    if "It makes sense" not in texts:
        f.append("the reply to the fragmented turn never played in full")
    if res["interruptions_at_output"] > 3:      # opening cut + VAD onset + first fragment formalised; the tail must add none
        f.append(f"{res['interruptions_at_output']} interruptions at the output — a fragment barged in")
    return f


def chk_pieces_with_gaps(res):
    """Call 358e5026 (2026-09-23): a parent speaking in pieces got a reply to
    every piece, each started while the NEXT piece was already under way and
    cut 0.7 s later — "आप मुझे एक समय बता" / "मैं समझ" / "मैं समझ गई". No
    reply may start while the caller is talking, no stub may reach the line,
    and the pieces still get one full answer."""
    f = []
    if len(res["caller"]) < 3:
        return ["caller turns missing"]
    p1 = res["caller"][1]
    p2 = res["caller"][2]
    for a, b_ in res["bot"]:
        if a < p1[0]:
            continue
        if any(ca + 0.05 < a < cb for ca, cb in res["caller"]):
            f.append(f"bot audio started at {a:.2f}s while the caller was talking")
        if b_ - a < 1.0 and a < p2[1] + 6.0:
            f.append(f"a {b_ - a:.2f}s stub of a reply reached the line at {a:.2f}s")
    # One answer to both pieces, played in full (its sentences are separate
    # intervals on the line).
    after = [iv for iv in res["bot"] if p2[1] <= iv[0] < p2[1] + 8.0]
    if not after:
        f.append("the pieces never got an answer")
    elif sum(b_ - a for a, b_ in after) < 3.0:
        f.append("the answer to the pieces was cut short")
    if "Three girls" not in " ".join(_assistant_texts(res)):
        f.append("the answer to both pieces never played")
    return f


LONG_ANSWER = ("Yes, I take classes in the evening, mostly at the studio near my house, "
               "and a few students come to my home on weekends")
_LONG_KEYS = ("classes", "evening", "studio", "students", "weekends")


def chk_stt_waterfall(res):
    """Primary STT deaf, fallback real: the first turn produces nothing → one
    "say it again" → the STT fails over → the caller's next turn is heard by
    the fallback and answered. Founder 2026-09-15: "have waterfall if sarvam
    fails to smallest"."""
    f = []
    if res.get("stt_failovers", 0) != 1:
        f.append(f"stt_failovers = {res.get('stt_failovers')} (want 1)")
    if res.get("orphan_reasks", 0) < 1:
        f.append("never asked the caller to repeat the unheard turn")
    texts = " ".join(_assistant_texts(res)).lower()
    heard = " ".join(x for _, x in res.get("finals", [])).lower()
    if not any(k in heard for k in _LONG_KEYS):
        f.append(f"the fallback never transcribed the second turn: finals {res.get('finals')!r}")
    prompts = [p for p in res.get("llm_prompts", []) if any(k in p.lower() for k in _LONG_KEYS)]
    if not prompts:
        f.append("the model never received the answer heard by the fallback")
    return f


def chk_breath_then_long(res):
    """A short answer, a breath, then the real answer — all one caller turn.
    Founder's 2026-09-15 calls: the VAD stopped inside the breath, Smallest
    finalized on the short part and the long part NEVER arrived (5 sightings).
    The vendor must deliver the long part, promptly, and the bot must answer
    it — not the short part, and not with a "say it again"."""
    f = []
    if len(res["caller"]) < 2:
        return ["caller turns missing"]
    cstart, cend = res["caller"][1]
    finals = [(t, x) for t, x in res["finals"] if t >= cstart]
    heard = " ".join(x for _, x in finals).lower()
    got = [k for k in _LONG_KEYS if k in heard]
    if len(got) < 4:
        f.append(f"the long part was dropped: finals after the turn {finals!r}")
    else:
        t_long = next(t for t, x in finals if sum(k in x.lower() for k in _LONG_KEYS) >= 2)
        if t_long - cend > 1.5:
            f.append(f"long part transcribed {t_long - cend:.2f}s after the caller stopped")
    texts = " ".join(_assistant_texts(res)).lower()
    if "say it again" in texts or "didn't catch" in texts:
        f.append("asked the caller to repeat a turn that was audible and transcribable")
    prompts = [p for p in res.get("llm_prompts", []) if any(k in p.lower() for k in _LONG_KEYS)]
    if not prompts:
        f.append("the model never received the long answer")
    replies = [iv for iv in res["bot"] if iv[0] >= cend]
    if not replies:
        f.append("no bot audio after the caller's answer")
    elif replies[0][0] - cend > 3.0:
        f.append(f"reply started {replies[0][0] - cend:.2f}s after the caller stopped")
    # One generation for the whole turn. A run on the short part alone (or on a
    # mid-sentence fragment) is the bot answering before the caller finished.
    if res.get("llm_runs", 0) > 2:
        f.append(f"{res['llm_runs']} generations — answered a partial turn (short part or fragment) "
                 f"before the caller finished: {[p[:40] for p in res.get('llm_prompts', [])[1:]]}")
    if any(iv[0] < cend - 0.3 for iv in res["bot"] if iv[0] > cstart + 0.5):
        f.append("bot audio started while the caller was still talking")
    return f


def chk_unheard_turn(res):
    """The caller spoke, the STT returned nothing (3 of 81 turns on 2026-09-15).
    Within ~7 s the bot must ask them to say it again — not sit silent until
    the 8 s nudge or the caller's own "Hello?"."""
    f = []
    if len(res["caller"]) < 2:
        return ["caller turns missing"]
    cend = res["caller"][1][1]
    texts = " ".join(_assistant_texts(res)).lower()
    if "say it again" not in texts and "didn't catch" not in texts:
        f.append("never asked the caller to repeat an unheard turn")
    asks = [iv for iv in res["bot"] if cend + 3.0 <= iv[0] <= cend + 7.5]
    if not asks:
        f.append(f"no bot audio 3-7.5 s after the unheard turn (bot: {res['bot']})")
    return f


def chk_screener_then_person(res):
    """Call 196838de (2026-09-15): Google call screen answered, our opening
    played into its recorder, the father picked up with a substantive line —
    and 2 min later his "Hello?" replayed the whole opening. The opening is
    said exactly twice (screener, then the person), never again; a mid-call
    "Hello?" gets a short confirm + the question, within 3 s."""
    f = []
    texts = _assistant_texts(res)
    if not texts:
        return ["bot said nothing"]
    head = _key(" ".join(texts[0].split()[:4]))
    n = sum(1 for t in texts if head and head in _key(t))
    if n < 2:
        f.append(f"the person who picked up after the screener never heard the opening ({n} openings)")
    if n > 2:
        f.append(f"opening said {n}x — replayed after the person was already talking")
    if len(res["caller"]) < 4:
        return f + ["caller turns missing"]
    hello_end = res["caller"][3][1]
    nxt = [iv for iv in res["bot"] if hello_end - 0.5 <= iv[0] <= hello_end + 3.0]
    if not nxt:
        f.append(f"no reply within 3 s of the mid-call Hello? (bot: {res['bot'][-3:]})")
    return f


def _key(text: str) -> str:
    from app.turntake import spoken_key
    return spoken_key(text)


def chk_voicemail(res):
    """Call 24089872: the carrier's recording spoke, nobody else did. No nudge,
    no farewell — hang up as soon as the idle clock fires."""
    f = []
    if res["nudges"]:
        f.append(f"nudged {res['nudges']}x a voicemail")
    if res["ended_at"] is None or res["ended_at"] > 25.0:   # idle clock 8 s + end grace, after a ~6 s announcement
        f.append(f"call still open at {res['ended_at']}s — should hang up on the first idle tick")
    texts = " ".join(_assistant_texts(res))
    if "lost you" in texts or "still there" in texts:
        f.append("spoke a nudge/farewell to the machine")
    return f


def chk_cached_opener(res):
    """Call 994162b0 (2026-09-12): 'Thank you.' from the cache, then 3.6 s of
    nothing before the pitch. A cached sentence's own audio context only closed
    on pipecat's 3 s idle timeout, and the next sentence waited behind it."""
    f = []
    if not res["caller"]:
        return ["caller never spoke"]
    cend = res["caller"][0][1]
    # The reply only; the idle nudge ~8 s after it is a different scenario.
    ivs = [iv for iv in res["bot"] if cend <= iv[0] < cend + 12.0]
    if not ivs:
        return ["no bot audio after the caller's answer"]
    gaps = [round(b - a, 2) for (_, a), (b, _) in zip(ivs, ivs[1:])]
    if any(g > 1.0 for g in gaps):
        f.append(f"silence inside the reply: gaps {gaps} s between bot audio intervals")
    if ivs[0][0] - cend > 2.5:
        f.append(f"reply started {ivs[0][0] - cend:.2f}s after the caller stopped")
    total = sum(b - a for a, b in ivs)
    if total < 5.0:
        f.append(f"reply audio only {total:.1f}s — a sentence was lost")
    texts = " ".join(_assistant_texts(res))
    for s in ("Thank you", "daily link"):
        if s not in texts:
            f.append(f"{s!r} never reached the played transcript")
    # Order and single occurrence: call 859c20ee (2026-09-12) recorded the
    # sentence AFTER a cached one before it, and then again after it.
    if "Thank you" in texts and "So the reason" in texts and texts.index("So the reason") < texts.index("Thank you"):
        f.append("played transcript out of order: the vendor sentence precedes the cached opener")
    if texts.count("So the reason I called") > 1:
        f.append("a sentence was recorded twice in the played transcript")
    return f


LONG_CACHED = ("Generally when parents join a coaching class they have three or four basic "
               "expectations, first that the faculty is good and clears every concept properly.")
LIVE_AFTER_CACHED = "Would you agree with that?"


def chk_long_cached_then_live(res):
    """Call d9aed777 (2026-09-25, first FULL-cache call): a 10.9 s cached
    sentence, then a live question in the same reply. The audio played in
    order, but the played transcript — and so the model's own context — came
    out interleaved: "…पहली, faculty क्या आप इससे अच्छे सहमत हों हैं? और बच्चे
    के concepts…". The cached sentence must be recorded whole, then the live
    one, each once."""
    f = []
    if not res["caller"]:
        return ["caller never spoke"]
    texts = " ".join(" ".join(_assistant_texts(res)).split())
    cached = " ".join(LONG_CACHED.split())
    if cached not in texts:
        f.append("the cached sentence is not recorded whole — words from another "
                 "sentence landed inside it: " + texts[-260:])
    elif LIVE_AFTER_CACHED not in texts:
        f.append("the live sentence after the cached one never reached the played transcript")
    elif texts.index(LIVE_AFTER_CACHED) < texts.index(cached):
        f.append("played transcript out of order: the live sentence precedes the cached one")
    if texts.count("Would you agree") > 1:
        f.append("the live sentence was recorded twice")
    cend = res["caller"][0][1]
    ivs = [iv for iv in res["bot"] if cend <= iv[0] < cend + 20.0]
    if sum(b - a for a, b in ivs) < 9.0:
        f.append(f"reply audio only {sum(b - a for a, b in ivs):.1f}s — part of it was lost")
    return f


# ── speech cache on the REAL Smallest service (sim/smallest_fake.py) ──────
S_LIVE_1 = "Rajeev is in class seven right now."
S_LIVE_2 = "What marks did he get in his previous class?"
S_CACHED_TAIL = "So that I get some idea of his performance."
S_CACHED_HEAD = "Thank you."
S_LIVE_Q = "Would you agree with that?"


def _norm_ws(t: str) -> str:
    return " ".join(t.split())


def chk_reply_plays_whole(expected: List[str], max_gap: float = 0.8,
                          leading_filler: bool = False):
    """What the caller hears, for one multi-sentence reply: every sentence, in
    order, exactly once, recorded exactly as it played (no sentence's words
    inside another's), and no hole inside the reply longer than max_gap.
    Calls d9aed777 and 5aa10e10 (2026-09-25) failed all three ways."""
    def chk(res):
        f = []
        if not res["caller"]:
            return ["caller never spoke"]
        texts = _norm_ws(" ".join(_assistant_texts(res)))
        want = _norm_ws(" ".join(expected))
        if want not in texts:
            f.append("played transcript does not contain the reply whole and in order — "
                     f"got …{texts[-320:]!r}")
        for sent in expected:
            n = texts.count(_norm_ws(sent))
            if n != 1 and want in texts:
                f.append(f"{sent!r} recorded {n} times")
        cend = res["caller"][0][1]
        ivs = sorted(iv for iv in res["bot"] if iv[0] >= cend)
        reply = []
        for iv in ivs:                        # the reply = intervals until a >4 s pause (nudge)
            if reply and iv[0] - reply[-1][1] > 4.0:
                break
            reply.append(iv)
        if leading_filler:
            # "Hmm…" covers the model's thinking time; the pause between it and
            # the reply is the model, not a hole in the reply.
            if not reply or reply[0][1] - reply[0][0] > 1.5:
                f.append("no filler played before the reply")
            else:
                reply = reply[1:]
        gaps = [round(b[0] - a[1], 2) for a, b in zip(reply, reply[1:])]
        if any(g > max_gap for g in gaps):
            f.append(f"hole inside the reply: gaps {gaps} s (max {max_gap})")
        if not reply:
            f.append("the reply never played")
        return f
    return chk


_BREATH_REPLIES = [PITCH_Q, "Got it — evenings at the studio, weekends at home. Who sends the daily link right now?"]
_BREATH_NOTE = "2026-09-15: VAD stop inside a 0.45 s breath; Smallest finalized the short part, the rest was dropped"

SCENARIOS: List[Scenario] = [
    Scenario("stt_waterfall_after_deaf_primary",
             caller=[Say(OPEN_ANSWER, 1.2, after_bot_stop=1, offset=0.6),
                     Say("Yes. " + LONG_ANSWER, after_bot_stop=2, offset=0.8, clip="pause_then_long")],
             replies=[PITCH_Q, "Got it — evenings at the studio, weekends at home. Who sends the daily link right now?"],
             checks=chk_stt_waterfall, max_secs=50, real_stt=True,
             note="run with SIM_DEAF_PRIMARY=1 STT_FALLBACK_PROVIDER=<vendor>: orphan re-ask → failover"),
    Scenario("breath_then_long_answer_yes",
             caller=[Say(OPEN_ANSWER, 1.2, after_bot_stop=1, offset=0.6),
                     Say("Yes. " + LONG_ANSWER, after_bot_stop=2, offset=0.8, clip="pause_then_long")],
             replies=_BREATH_REPLIES, checks=chk_breath_then_long, max_secs=45,
             real_stt=True, note=_BREATH_NOTE),
    Scenario("breath_then_long_answer_haan",
             caller=[Say(OPEN_ANSWER, 1.2, after_bot_stop=1, offset=0.6),
                     Say("Haan. " + LONG_ANSWER, after_bot_stop=2, offset=0.8, clip="haan_pause_long")],
             replies=_BREATH_REPLIES, checks=chk_breath_then_long, max_secs=45,
             real_stt=True, note=_BREATH_NOTE),
    Scenario("breath_then_long_answer_yga",
             caller=[Say(OPEN_ANSWER, 1.2, after_bot_stop=1, offset=0.6),
                     Say("Yes, go ahead. " + LONG_ANSWER, after_bot_stop=2, offset=0.8, clip="yga_pause_long")],
             replies=_BREATH_REPLIES, checks=chk_breath_then_long, max_secs=45,
             real_stt=True, note=_BREATH_NOTE),
    Scenario("unheard_turn_gets_a_repeat_request",
             caller=[Say(OPEN_ANSWER, 1.2, after_bot_stop=1, offset=0.6),
                     Say("It's a mix of online and studio.", 1.6, after_bot_stop=2, offset=0.8,
                         finals=[""], stt_latency=0.4)],
             replies=[PITCH_Q, "Got it. Who sends the daily link right now?"],
             checks=chk_unheard_turn, max_secs=40,
             note="2026-09-15: 3 of 81 turns produced no transcript; callers said Hello? into silence"),
    Scenario("yes_after_nudge",
             # Call 92743351 (2026-09-15): silent caller, two nudges, "Yes" right
             # after "Hello? Are you there?" — the reply took 6.2 s.
             caller=[Say("Yes.", after_bot_stop=3, offset=0.4, stt_latency=0.6)],
             replies=["Great. So the reason I called — we work with yoga teachers on the daily link."],
             checks=chk_turn_latency, max_secs=40,
             note="yes after the second nudge must be answered like any yes"),
    Scenario("screener_then_person",
             caller=[Say("Hi. If you record your name and reason for calling, I'll see if this person is available",
                         3.0, at=0.4, stt_latency=0.3),
                     Say("Hello.", at=11.0, stt_latency=0.4),
                     Say("Yes, this is me. Go ahead.", 1.6, after_bot_stop=2, offset=0.8, stt_latency=0.5),
                     Say("Hello?", after_bot_stop=3, offset=5.0, stt_latency=0.4)],
             replies=[PITCH_Q, "Got it. Who sends the daily link right now?", "Yes, I'm here. Who sends the daily link right now?"],
             checks=chk_screener_then_person, max_secs=60,
             note="call 196838de: screener flag stayed armed; a later Hello? replayed the opening"),
    Scenario("voicemail_hangs_up",
             caller=[Say("Your call has been forwarded to voicemail.", 2.4, at=0.3, stt_latency=0.3),
                     Say("At the tone, please record your message.", 2.2, at=4.0, stt_latency=0.3)],
             replies=[], checks=chk_voicemail, max_secs=30,
             note="call 24089872: two nudges and a farewell spoken to an answering machine"),
    Scenario("fragment_tail_is_not_a_barge_in",
             caller=[Say(OPEN_ANSWER, 1.2, after_bot_stop=1, offset=0.6),
                     Say("It makes some sense", 1.6, after_bot_stop=2, offset=0.8,
                         finals=["? It makes", "some sense"], stt_latency=0.4)],
             replies=[PITCH_Q, "It makes sense, good. So who sends the daily link right now — you, or someone else?"],
             checks=chk_fragment_tail, max_secs=45,
             note="call 31763255: '? It makes' → reply → 'some' as a real barge-in killed it"),
    Scenario("pieces_with_gaps",
             caller=[Say(OPEN_ANSWER, 1.2, after_bot_stop=1, offset=0.6),
                     Say("My daughter is in the eighth class", 1.1, after_bot_stop=2,
                         offset=0.8, stt_latency=0.4),
                     # Starts 0.8 s after the first piece — on the CI runner's
                     # usual ~1.2 s reply latency the reply is ready mid-piece
                     # (gate off: a 0.28 s stub at 25.51 s). Closer, and the
                     # first reply never starts at all; on a fast runner it
                     # starts before this piece and the case does not arise.
                     Say("and there are three girls at home studying", 1.4, after_bot_stop=2,
                         offset=2.7, stt_latency=0.4)],
             replies=[PITCH_Q,
                      "Got it, eighth class. And how were her marks last year?",
                      "Three girls, that's lovely. And how were the eldest one's marks last year?",
                      "Okay."],
             checks=chk_pieces_with_gaps, max_secs=45,
             note="call 358e5026: a reply started over every next piece and was cut to a stub"),
    Scenario("smallest_live_only",
             caller=[Say(OPEN_ANSWER, 1.2, after_bot_stop=1, offset=0.6)],
             replies=[" ".join([S_LIVE_1, S_LIVE_2])],
             checks=chk_reply_plays_whole([S_LIVE_1, S_LIVE_2]), max_secs=30, engine="smallest",
             note="baseline: the real Smallest service with no cache in the reply"),
    Scenario("smallest_live_then_cached",
             caller=[Say(OPEN_ANSWER, 1.2, after_bot_stop=1, offset=0.6)],
             replies=[" ".join([S_LIVE_1, S_LIVE_2, S_CACHED_TAIL])],
             checks=chk_reply_plays_whole([S_LIVE_1, S_LIVE_2, S_CACHED_TAIL]), max_secs=30,
             cache_warm=[S_CACHED_TAIL], engine="smallest",
             note="call 5aa10e10: a cached sentence behind two live ones waited 2.2 s"),
    Scenario("smallest_cached_then_live",
             caller=[Say(OPEN_ANSWER, 1.2, after_bot_stop=1, offset=0.6)],
             replies=[" ".join([LONG_CACHED, S_LIVE_Q])],
             checks=chk_reply_plays_whole([LONG_CACHED, S_LIVE_Q]), max_secs=35,
             cache_warm=[LONG_CACHED], engine="smallest",
             note="call d9aed777: live words stamped inside a long cached sentence"),
    Scenario("smallest_cached_live_cached",
             caller=[Say(OPEN_ANSWER, 1.2, after_bot_stop=1, offset=0.6)],
             replies=[" ".join([S_CACHED_HEAD, S_LIVE_1, S_CACHED_TAIL])],
             checks=chk_reply_plays_whole([S_CACHED_HEAD, S_LIVE_1, S_CACHED_TAIL]), max_secs=30,
             cache_warm=[S_CACHED_HEAD, S_CACHED_TAIL], engine="smallest",
             note="cached, live, cached in one reply"),
    Scenario("smallest_filler_then_live_and_cached",
             caller=[Say(OPEN_ANSWER, 1.2, after_bot_stop=1, offset=0.6)],
             replies=[" ".join([S_LIVE_1, S_LIVE_2, S_CACHED_TAIL])],
             checks=chk_reply_plays_whole([S_LIVE_1, S_LIVE_2, S_CACHED_TAIL],
                                          leading_filler=True),
             max_secs=30, cache_warm=[S_CACHED_TAIL], engine="smallest", filler=1.0,
             note="a6252b5c57's gate: a 'Hmm…' filler, then the reply must still come whole"),
    Scenario("long_cached_then_live",
             caller=[Say(OPEN_ANSWER, 1.2, after_bot_stop=1, offset=0.6)],
             replies=[LONG_CACHED + " " + LIVE_AFTER_CACHED],
             checks=chk_long_cached_then_live, max_secs=35, cache_warm=[LONG_CACHED],
             note="call d9aed777: long cached sentence + live question — transcript interleaved"),
    Scenario("cached_opener_then_pitch",
             caller=[Say(OPEN_ANSWER, 1.2, after_bot_stop=1, offset=0.6)],
             replies=["Thank you. So the reason I called — we work with yoga teachers on everything "
                      "around their online classes. The daily link, the reminders, the fees."],
             checks=chk_cached_opener, max_secs=30, cache_warm=["Thank you."],
             note="call 994162b0: cached 'Thank you.' then 3.6 s of silence — the cached per-sentence "
                  "context only closed on pipecat's 3 s idle timeout"),
    Scenario("yes_over_tail",
             caller=[Say(OPEN_ANSWER, 1.2, after_bot_stop=1, offset=0.6),
                     # Right after "right now?" has PLAYED (word timings reach the
                     # played transcript per word, as with Smallest), while the tail
                     # "Is that you, or does someone help?" is still queued — call
                     # 34f258c2's shape exactly.
                     Say("Yes.", after_bot_start=2, offset=_after_word(PITCH_Q, "now?"),
                         stt_latency=0.4)],
             replies=[PITCH_Q, "Great — so it's on you. Honestly, the fees part is what most teachers are fed up with."],
             # 3.0, not 2.5: a bare "Yes." pays the short-answer grace (0.8 s
             # minus the silence already elapsed) by design since 8de0c67de3 —
             # measured 2.44-2.57 s here, flapping on the old bar under any load.
             checks=lambda r: chk_yes_over_tail(r) + chk_turn_latency(r, 3.0), max_secs=40,
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
    import os, tempfile
    # A private speech cache per run: warm lines must never land in the box's
    # real ledger, and CI has no writable /srv/data.
    os.environ["TTS_CACHE_DIR"] = tempfile.mkdtemp(prefix="sim-tts-cache-")
    ap = argparse.ArgumentParser()
    ap.add_argument("--scenarios", default="all")
    ap.add_argument("--verbose", action="store_true")
    ap.add_argument("--out", default="sim_timing.json")
    ap.add_argument("--ci", action="store_true")
    ap.add_argument("--real-stt", action="store_true",
                    help="use the production STT (STT_PROVIDER env) on the fixture audio; "
                         "'all' then includes the real_stt scenarios")
    ap.add_argument("--app-log", action="store_true",
                    help="show app.* INFO lines (watchdog/orphan diagnostics) alongside events")
    args = ap.parse_args()
    if args.app_log:
        # Only stdlib loggers under app.*; pipecat's loguru stays as-is.
        h = logging.StreamHandler()
        h.setFormatter(logging.Formatter("        app: %(message)s"))
        logging.getLogger("app").addHandler(h)
        logging.getLogger("app").setLevel(
            logging.DEBUG if os.environ.get("SIM_APP_DEBUG") else logging.INFO)
    ctx = json.loads((FIXTURE_DIR / "yoga_agent_context.json").read_text(encoding="utf-8"))
    keys = ([s.key for s in SCENARIOS if args.real_stt or not s.real_stt]
            if args.scenarios == "all" else args.scenarios.split(","))
    results = []
    for k in keys:
        sc = BY_KEY[k]
        try:
            res = await run_scenario(sc, ctx, args.verbose, args.real_stt)
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
