"""TTS speech cache — replay audio we have already paid to synthesize.

WHY: V421's own migration note puts TTS at ~65% of an AI call's marginal cost.
A scripted agent says the same opening line, the same farewells, the same
handbacks and (on a tight script) much of the same pitch on every call, and we
pay Sarvam Rs 3.00/1k characters for each one of them, every time.

WHAT: hash the exact string plus the voice and the delivery params, store the
rendered audio, replay it on an exact key match. Matching is equality on a
sha256 — there is NO similarity search, NO prefix match, NO nearest neighbour.
One differing character is a different digest and therefore a vendor call. That
is deliberate: the point is to stop paying twice for identical audio, never to
approximate a sentence we do not have.

THE INVARIANT THAT MATTERS MOST: a bad entry is not a one-call bug. It is
served to every future call that matches it, forever. So the bar for writing an
entry is much higher than the bar for reading one:

  * live audio is NEVER stored. A call contributes a candidate KEY; every blob
    is rendered off-call from a complete one-shot synthesis, so "the recording
    is truncated" is impossible by construction rather than by a check. (It also
    could not be done safely: on the websocket engines pipecat delivers audio
    asynchronously with no per-sentence attribution, and a barge-in truncates
    the stream mid-sentence.)
  * six gates, G1..G6 below, stand between "the bot said something" and "we will
    play this recording to a stranger".

Read docs/crm/TTS_SPEECH_CACHE.md for the full design and the pipecat 1.4
mechanics it depends on.
"""
from __future__ import annotations

import asyncio
import hashlib
import json
import os
import sqlite3
import time
from dataclasses import dataclass
from typing import Iterable, Optional

from loguru import logger

from .config import get_settings

# The live call leg is 8 kHz signed 16-bit mono (Plivo). Storing at the leg's own
# rate rather than the engine's native 24 kHz is 3x smaller AND removes a resample
# from the hot path — the transport's resampler becomes a no-op.
SAMPLE_RATE = 8000
SAMPLE_WIDTH = 2
CHANNELS = 1
_BYTES_PER_SEC = SAMPLE_RATE * SAMPLE_WIDTH * CHANNELS

# Yield cached audio in 20 ms slices with a cooperative await between them. A
# synchronous dump would push the whole utterance past DuckGate into pipecat's
# output queue and Plivo's buffer before a barge-in could land — the exact
# problem AUDIO_MAX_LEAD_SECS exists to bound (live call d6e82def logged
# "dropping 0 held frame(s)" on an interrupt for precisely that reason).
CHUNK_MS = 20
_CHUNK_BYTES = int(_BYTES_PER_SEC * CHUNK_MS / 1000)
# Emit at ~2x real time — fast enough never to starve playout, slow enough that
# DuckGate always has frames left to hold when the caller starts speaking.
_EMIT_SLEEP = CHUNK_MS / 2000.0

# Field separator for the key tuple. \x1f (ASCII unit separator) cannot occur in
# TTS text, so no field can bleed into the next and collide two distinct inputs.
_SEP = "\x1f"

# G1: what counts as the end of a sentence.
#
# Taken from PIPECAT'S OWN set rather than restated here, because pipecat is what
# decides where run_tts's input was cut: its aggregator splits on exactly these
# characters (pipecat.utils.string.SENTENCE_ENDING_PUNCTUATION), so a second,
# narrower list would silently refuse whole utterances it split legitimately —
# ";" and the Devanagari double danda "॥" were both missing from the first
# hand-written version of this line.
#
# The fallback is a superset of what our Hindi/English agents can produce, and
# exists so this module stays importable (and unit-testable) without pipecat.
try:                                            # pragma: no cover - env dependent
    from pipecat.utils.string import SENTENCE_ENDING_PUNCTUATION as _PIPECAT_TERMINAL
    _TERMINAL = "".join(sorted(_PIPECAT_TERMINAL))
except Exception:                               # pragma: no cover - env dependent
    _TERMINAL = ".!?;…।॥。？！；．۔؟"
# Closing punctuation that may trail the terminal mark without making the text
# incomplete.
_TRAILING = "\"'’”)]》」»"

# Engines whose run_tts does NOT yield audio: it enqueues text and the audio
# arrives later on a receive loop. On these, a cached utterance appended
# instantly would play AHEAD of a vendor sentence still in flight, because
# pipecat reuses one audio context (one FIFO, drained in append order) for a
# whole turn -- reuse_context_id_within_turn defaults True.
#
# rumik is listed here for now although we own its sender loop and could inject
# in-order there; vendor_inflight is correct for it too, just more conservative.
_ASYNC_ARRIVAL_ENGINES = frozenset({"sarvam", "smallest", "rumik"})


def is_async_arrival(engine: str) -> bool:
    """True when the engine delivers audio out-of-band from run_tts (§ ordering)."""
    return (engine or "").strip().lower() in _ASYNC_ARRIVAL_ENGINES


def agent_allowed(allowlist, agent_id: str, agent_name: str) -> bool:
    """Is this agent in the rollout?

    The master switches are process-wide, so without this a single env flip would
    turn the cache on for every agent taking calls on the box. Rollout wants the
    opposite shape: one agent, one end-to-end test, then widen.

    An EMPTY allowlist means no restriction, not no agents — the master switches
    already default off, so this is the second gate. Matching accepts the agent id
    or its name because whoever edits /opt/voice-bot/.env is reading a screen that
    shows the name, and making them go and find a uuid is how the wrong agent ends
    up in the list.
    """
    if not allowlist:
        return True
    wanted = {a.strip().lower() for a in allowlist if a and a.strip()}
    if not wanted:
        return True
    return ((agent_id or "").strip().lower() in wanted
            or (agent_name or "").strip().lower() in wanted)


# Per-agent tiers, set in CRM -> Calling -> AI Agents and carried on the call
# context as `speech_cache_mode` (ai_agent.speech_cache_mode, V466).
MODE_OFF, MODE_FIXED, MODE_FULL = "OFF", "FIXED", "FULL"


def mode_allows(mode: str, is_fixed_line: bool) -> bool:
    """Does this agent's tier permit serving THIS sentence from cache?

    FIXED is the safe first tier: the bot's own authored lines are standalone
    utterances with no join to a neighbouring sentence, so the render-parity
    question (TTS_SPEECH_CACHE.md §11) cannot arise. FULL adds the LLM's
    sentences, where a cached and a live sentence can sit next to each other in
    one turn — that tier is earned per engine, by listening.

    Anything unrecognised is OFF. The only safe default for "may this agent
    replay stored audio" is no.
    """
    m = (mode or "").strip().upper()
    if m == MODE_FULL:
        return True
    if m == MODE_FIXED:
        return is_fixed_line
    return False


def owns_turn_brackets(tts) -> tuple:
    """(emit_started, emit_stopped) for a cached utterance on this service.

    A cached sentence must be indistinguishable from a synthesized one
    downstream, which means emitting exactly the frames the wrapped engine would
    have emitted — no more.

    pipecat's `_push_tts_frames` appends a TTSStartedFrame BEFORE calling
    run_tts whenever `push_start_frame` is set, and — because yielding a
    TTSAudioRawFrame sets `_is_yielding_frames_synchronously` —
    `on_turn_context_completed` appends the TTSStoppedFrame and closes the audio
    context whenever `push_stop_frames` is set. sarvam and google set both; our
    own EdgeTTSService sets neither and yields its own pair.

    Emitting a duplicate pair is not cosmetic: two TTSStartedFrames re-arm the
    stop-frame bookkeeping in `_handle_audio_context`, and BotStarted/Stopped
    Speaking drive the duck, the watchdog and every dead-air measurement.
    """
    return (not getattr(tts, "_push_start_frame", False),
            not getattr(tts, "_push_stop_frames", False))


# ── G1: completeness ────────────────────────────────────────────────────────

def is_complete(text: str) -> bool:
    """Is this a whole sentence, or a fragment we must never cache?

    Fragments reach TTS routinely, not exceptionally: pipecat's default
    aggregation is by sentence, but on LLMFullResponseEndFrame it FLUSHES the
    aggregator's remainder straight into TTS (tts_service.py:705-719), which is
    a partial clause whenever the response did not end on a boundary. A barge-in
    cuts a reply mid-sentence the same way.

    Caching such a fragment would render half a sentence and then play it, whole
    and standalone, to every future caller who matched it. So a fragment is not
    hashed, not looked up, and not laddered — it goes straight to the vendor.
    Skipping a cacheable sentence costs one render; caching a fragment costs
    every call that ever matches it.
    """
    t = (text or "").rstrip()
    t = t.rstrip(_TRAILING).rstrip()
    return bool(t) and t[-1] in _TERMINAL


def _num(v) -> str:
    """Stable numeric field for the key. 1.1 and 1.10 MUST hash identically, and
    None (engine default) must not collide with an explicit 0."""
    if v is None:
        return ""
    try:
        return f"{float(v):.4f}"
    except (TypeError, ValueError):
        return str(v)


def cache_key(*, engine: str, model: str, voice: str, pace, temperature,
              sample_rate: int, term_map_version: str, text: str,
              salt: Optional[str] = None) -> str:
    """sha256 over everything that changes the rendered audio.

    `text` must already be the exact string the vendor would receive (Rumik's
    Devanagari->Latin normalisation applied, outer whitespace stripped). No
    case-folding and no whitespace collapsing: every normalisation is another
    chance to serve audio that does not match the words.

    `engine` must be the engine ACTUALLY CONSTRUCTED, not ai_agent.tts_model —
    build_tts silently falls back to Sarvam on a missing key, so the configured
    value would file Sarvam audio under a google key and serve the wrong voice.
    """
    if salt is None:
        salt = get_settings().tts_cache_salt
    parts = (salt, (engine or "").lower(), model or "", voice or "",
             _num(pace), _num(temperature), str(sample_rate),
             term_map_version or "", text)
    return hashlib.sha256(_SEP.join(parts).encode("utf-8")).hexdigest()


# ── the store ───────────────────────────────────────────────────────────────

@dataclass
class Entry:
    """One rendered blob, as held in the RAM index."""
    key: str
    path: str
    nbytes: int
    duration_ms: int
    text: str


@dataclass
class Candidate:
    """A sentence a live call proposes for caching. Not yet trusted."""
    key: str
    text: str
    chars: int
    engine: str
    model: str
    voice: str
    pace: Optional[float]
    temperature: Optional[float]
    fixed: bool = False          # a bot-authored line: exempt from G3/G4


_DDL = """
CREATE TABLE IF NOT EXISTS seen(
  key         TEXT PRIMARY KEY,
  engine      TEXT, model TEXT, voice TEXT,
  pace        REAL, temperature REAL,
  text        TEXT, chars INTEGER,
  count       INTEGER NOT NULL DEFAULT 0,
  fixed       INTEGER NOT NULL DEFAULT 0,
  first_seen  REAL, last_seen REAL
);
CREATE TABLE IF NOT EXISTS blob(
  key         TEXT PRIMARY KEY,
  nbytes      INTEGER, duration_ms INTEGER,
  text        TEXT,
  hits        INTEGER NOT NULL DEFAULT 0,
  last_served REAL, created_at REAL
);
CREATE INDEX IF NOT EXISTS idx_seen_ready ON seen(count);
CREATE INDEX IF NOT EXISTS idx_blob_evict ON blob(hits, last_served);
"""


class SpeechCache:
    """Content-addressed audio store: the key IS the filename.

    Three stores, three jobs:
      * blob store  {dir}/{key}.pcm + .json  — the audio. No lookup table needed.
      * RAM index   dict[key] -> Entry       — what is on disk right now. The
                    hot-path lookup is a dict get: no syscall, no disk I/O, and
                    nothing that can block the event loop.
      * ledger      ledger.db (SQLite, WAL)  — candidate keys not yet rendered,
                    plus the blob metadata the index is rebuilt from at startup.

    Blob metadata lives in SQLite rather than in the sidecars so startup is ONE
    query instead of tens of thousands of file opens. The .json sidecars remain
    as a human-readable debug artefact and a rebuild source.
    """

    def __init__(self, root: Optional[str] = None):
        s = get_settings()
        self.root = root or s.speech_cache_dir
        self.db_path = os.path.join(self.root, "ledger.db")
        self._index: dict[str, Entry] = {}
        self._lock = asyncio.Lock()
        self._ready = False

    # -- lifecycle ----------------------------------------------------------

    def open(self) -> None:
        """Create the store and load the index. Blocking; call at startup or via
        to_thread. Never raises: a cache that cannot open is a cache that is off,
        not a bot that will not boot."""
        try:
            os.makedirs(self.root, exist_ok=True)
            with self._connect() as db:
                db.executescript(_DDL)
                # SQLite has no ADD COLUMN IF NOT EXISTS, and a ledger created
                # before this column existed is already on the box.
                try:
                    db.execute("ALTER TABLE seen ADD COLUMN fixed INTEGER NOT NULL DEFAULT 0")
                except sqlite3.OperationalError:
                    pass
                rows = db.execute(
                    "SELECT key, nbytes, duration_ms, text FROM blob").fetchall()
            idx: dict[str, Entry] = {}
            for key, nbytes, duration_ms, text in rows:
                path = self.blob_path(key)
                # A row whose file vanished (manual cleanup, volume reset) must
                # not sit in the index producing hits that 404 into silence.
                if os.path.exists(path):
                    idx[key] = Entry(key, path, nbytes, duration_ms, text)
            self._index = idx
            self._ready = True
            logger.info("tts-cache: %d entries loaded from %s", len(idx), self.root)
        except Exception:
            logger.exception("tts-cache: open failed — cache disabled for this process")
            self._ready = False

    def _connect(self) -> sqlite3.Connection:
        db = sqlite3.connect(self.db_path, timeout=10)
        # WAL: up to MAX_CONCURRENT_CALLS writers flush at call end while the
        # sweeper reads. Without it they serialise on a global write lock.
        db.execute("PRAGMA journal_mode=WAL")
        db.execute("PRAGMA synchronous=NORMAL")
        return db

    @property
    def ready(self) -> bool:
        return self._ready

    @property
    def size(self) -> int:
        """Rendered blobs currently in the index."""
        return len(self._index)

    def blob_path(self, key: str) -> str:
        return os.path.join(self.root, key + ".pcm")

    def meta_path(self, key: str) -> str:
        return os.path.join(self.root, key + ".json")

    # -- read path ----------------------------------------------------------

    def lookup(self, key: str, text: str) -> Optional[Entry]:
        """G6 — verify before playing.

        Returns the entry only when the stored text is byte-identical to what we
        are about to speak. A hash collision, a corrupted row or a renamed file
        then degrades to a MISS (one vendor render) instead of confidently
        speaking the wrong words. It costs one string compare.
        """
        if not self._ready:
            return None
        entry = self._index.get(key)
        if entry is None:
            return None
        if entry.text != text:
            logger.warning("tts-cache: text mismatch for key %s… — treating as miss", key[:12])
            return None
        return entry

    async def read(self, entry: Entry) -> Optional[bytes]:
        """Load a blob off the event loop, re-validating size (G5).

        The size check is not paranoia about our own writer — it catches a
        truncated file from a disk-full or a half-finished manual copy, either of
        which would otherwise play as a clipped sentence.
        """
        try:
            data = await asyncio.to_thread(self._read_blob, entry.path)
        except Exception:
            logger.exception("tts-cache: read failed for %s", entry.key[:12])
            return None
        if data is None:
            return None
        if len(data) != entry.nbytes or len(data) % (SAMPLE_WIDTH * CHANNELS):
            logger.warning("tts-cache: blob %s… is %d bytes, expected %d — dropping",
                           entry.key[:12], len(data), entry.nbytes)
            await self.discard(entry.key)
            return None
        return data

    @staticmethod
    def _read_blob(path: str) -> Optional[bytes]:
        try:
            with open(path, "rb") as f:
                return f.read()
        except FileNotFoundError:
            return None

    def note_hit(self, key: str) -> None:
        """Bump the serve counters. Fire-and-forget: eviction ordering is a
        nicety, and a lost increment must never cost a call."""
        try:
            asyncio.get_running_loop().create_task(self._note_hit_async(key))
        except RuntimeError:
            pass

    async def _note_hit_async(self, key: str) -> None:
        try:
            await asyncio.to_thread(self._bump_hit, key)
        except Exception:
            logger.debug("tts-cache: hit bookkeeping failed", exc_info=True)

    def _bump_hit(self, key: str) -> None:
        with self._connect() as db:
            db.execute("UPDATE blob SET hits = hits + 1, last_served = ? WHERE key = ?",
                       (time.time(), key))

    async def discard(self, key: str) -> None:
        """Remove a bad entry from the index, disk and db, together."""
        self._index.pop(key, None)
        try:
            await asyncio.to_thread(self._discard_sync, key)
        except Exception:
            logger.debug("tts-cache: discard failed", exc_info=True)

    def _discard_sync(self, key: str) -> None:
        for p in (self.blob_path(key), self.meta_path(key)):
            try:
                os.remove(p)
            except OSError:
                pass
        with self._connect() as db:
            db.execute("DELETE FROM blob WHERE key = ?", (key,))

    # -- write path (off-call only) -----------------------------------------

    def store(self, cand: Candidate, pcm: bytes) -> bool:
        """G5 — accept a render only if it is sound, and write it atomically.

        Blocking; the callers (warm route, sweeper) are already off the voice
        path. Returns False when the render was rejected, so the caller can log
        one line rather than silently believing it cached something.
        """
        try:
            if not pcm or len(pcm) % (SAMPLE_WIDTH * CHANNELS):
                logger.warning("tts-cache: refusing ragged render for %r", cand.text[:40])
                return False
            duration_ms = int(len(pcm) * 1000 / _BYTES_PER_SEC)
            if duration_ms < get_settings().tts_cache_min_blob_ms:
                # Too short to be a spoken sentence: a silent stub or a vendor
                # error page decoded to noise. Either would be dead air on a
                # real call.
                logger.warning("tts-cache: refusing %dms render for %r",
                               duration_ms, cand.text[:40])
                return False

            os.makedirs(self.root, exist_ok=True)
            path = self.blob_path(cand.key)
            tmp = f"{path}.{os.getpid()}.tmp"
            with open(tmp, "wb") as f:
                f.write(pcm)
            # Atomic: a concurrent reader never sees a partial file.
            os.replace(tmp, path)

            meta = {
                "key": cand.key, "engine": cand.engine, "model": cand.model,
                "voice": cand.voice, "pace": cand.pace,
                "temperature": cand.temperature, "sampleRate": SAMPLE_RATE,
                "text": cand.text, "chars": cand.chars,
                "bytes": len(pcm), "durationMs": duration_ms,
                "createdAt": time.time(),
            }
            tmpm = f"{self.meta_path(cand.key)}.{os.getpid()}.tmp"
            with open(tmpm, "w", encoding="utf-8") as f:
                json.dump(meta, f, ensure_ascii=False)
            os.replace(tmpm, self.meta_path(cand.key))

            now = time.time()
            with self._connect() as db:
                db.execute(
                    "INSERT INTO blob(key, nbytes, duration_ms, text, hits, last_served,"
                    " created_at) VALUES(?,?,?,?,0,?,?)"
                    " ON CONFLICT(key) DO UPDATE SET nbytes=excluded.nbytes,"
                    " duration_ms=excluded.duration_ms, text=excluded.text",
                    (cand.key, len(pcm), duration_ms, cand.text, now, now))
            self._index[cand.key] = Entry(cand.key, path, len(pcm), duration_ms, cand.text)
            logger.info("tts-cache: stored %dms (%d chars) %s/%s %r",
                        duration_ms, cand.chars, cand.engine, cand.voice, cand.text[:48])
            return True
        except Exception:
            logger.exception("tts-cache: store failed for %r", cand.text[:40])
            return False

    # -- ledger -------------------------------------------------------------

    def ladder(self, cands: Iterable[Candidate]) -> int:
        """Record qualifying sightings. Blocking; called at call end.

        One transaction for the whole call: a per-sentence commit would fsync up
        to a few dozen times while MAX_CONCURRENT_CALLS other calls are doing the
        same.
        """
        rows = list(cands)
        if not rows:
            return 0
        now = time.time()
        try:
            with self._connect() as db:
                for c in rows:
                    db.execute(
                        "INSERT INTO seen(key, engine, model, voice, pace, temperature,"
                        " text, chars, count, fixed, first_seen, last_seen)"
                        " VALUES(?,?,?,?,?,?,?,?,1,?,?,?)"
                        " ON CONFLICT(key) DO UPDATE SET count = count + 1,"
                        " fixed = MAX(seen.fixed, excluded.fixed), last_seen = ?",
                        (c.key, c.engine, c.model, c.voice, c.pace, c.temperature,
                         c.text, c.chars, 1 if c.fixed else 0, now, now, now))
            return len(rows)
        except Exception:
            logger.exception("tts-cache: ladder failed")
            return 0

    def due(self, limit: int = 25) -> list[Candidate]:
        """What is worth one render, and not yet rendered.

        TTS_CACHE_MIN_SEEN exists for ONE reason: an LLM sentence might be a
        one-off — "Namaste Rohan ji" for a name that never recurs — and rendering
        it would buy nothing. Waiting for a second sighting is how we find out.

        That reasoning is simply false for a fixed line. The opening, the
        farewells, the handbacks and the fillers are authored, and every one of
        them is spoken on every call by construction; there is no "might not
        recur" to hedge against. Making them wait for a second sighting delays
        the only lines guaranteed to pay off, which is the opposite of what the
        threshold is for. So fixed lines qualify on the FIRST sighting, and
        ORDER BY puts them ahead of the speculative ones when a pass is capped.
        """
        try:
            min_seen = get_settings().tts_cache_min_seen
            with self._connect() as db:
                rows = db.execute(
                    "SELECT s.key, s.text, s.chars, s.engine, s.model, s.voice,"
                    " s.pace, s.temperature FROM seen s"
                    " LEFT JOIN blob b ON b.key = s.key"
                    " WHERE b.key IS NULL AND (s.fixed = 1 OR s.count >= ?)"
                    " ORDER BY s.fixed DESC, s.count DESC, s.last_seen DESC LIMIT ?",
                    (min_seen, limit)).fetchall()
            return [Candidate(key=r[0], text=r[1], chars=r[2], engine=r[3],
                              model=r[4], voice=r[5], pace=r[6], temperature=r[7])
                    for r in rows]
        except Exception:
            logger.exception("tts-cache: due query failed")
            return []

    def repeat_report(self, limit: int = 40) -> list[dict]:
        """What actually repeats, per engine/voice. This is the number that says
        whether the LLM-sentence half of the cache is worth its complexity."""
        try:
            with self._connect() as db:
                rows = db.execute(
                    "SELECT engine, voice, count, chars, text FROM seen"
                    " ORDER BY count DESC, chars DESC LIMIT ?", (limit,)).fetchall()
                totals = db.execute(
                    "SELECT COUNT(*), SUM(count), SUM(CASE WHEN count > 1 THEN 1 ELSE 0 END)"
                    " FROM seen").fetchone()
            return [{"engine": r[0], "voice": r[1], "count": r[2], "chars": r[3],
                     "text": r[4], "distinct": totals[0], "sightings": totals[1],
                     "repeated": totals[2]} for r in rows]
        except Exception:
            logger.exception("tts-cache: repeat report failed")
            return []

    # -- eviction -----------------------------------------------------------

    def evict(self) -> int:
        """Bound the namespace by bytes, least-valuable first.

        Order is (hits ASC, last_served ASC) — NOT plain LRU. A line hit 500
        times is the whole point of the cache and must outlive write-once junk;
        that is the same reasoning that already protects warmed IVR prompts in
        _evict_tts_cache. Blocking; run from the sweeper.
        """
        try:
            budget = get_settings().tts_speech_cache_max_bytes
            with self._connect() as db:
                total = db.execute("SELECT COALESCE(SUM(nbytes), 0) FROM blob").fetchone()[0]
                if total <= budget:
                    return 0
                rows = db.execute(
                    "SELECT key, nbytes FROM blob ORDER BY hits ASC, last_served ASC").fetchall()
            removed = 0
            for key, nbytes in rows:
                if total <= budget:
                    break
                self._index.pop(key, None)
                self._discard_sync(key)
                total -= nbytes or 0
                removed += 1
            if removed:
                logger.warning("tts-cache: evicted %d entries (budget %d bytes)", removed, budget)
            return removed
        except Exception:
            logger.exception("tts-cache: eviction failed")
            return 0

# ── the shared instance ─────────────────────────────────────────────────────

_CACHE: Optional[SpeechCache] = None


def get_cache() -> SpeechCache:
    global _CACHE
    if _CACHE is None:
        _CACHE = SpeechCache()
    return _CACHE


# ── runtime: the pipeline pieces ────────────────────────────────────────────

class TtsTurnWatcher:
    """Sits immediately AFTER tts. Knows two things the wrapper cannot see.

    1. `vendor_inflight` — whether a websocket engine still owes us audio.

       pipecat 1.4 reuses ONE audio context for a whole LLM turn
       (reuse_context_id_within_turn defaults True), and a context is a single
       FIFO drained in APPEND order. Cached audio appends instantly; vendor audio
       appends when it arrives, typically 200-400 ms later. So a cached sentence
       appended while a vendor sentence is outstanding would be heard FIRST.
       The caller would get sentence 3 before sentence 2 — intermittently, only
       on partial-hit turns, which is the worst failure shape there is.

       The wrapper therefore refuses to serve from cache while this is set. That
       costs hit rate on partial-hit turns and costs nothing else: the first
       sentence of every turn always has it clear (and that is the sentence
       gating TTFB), as does every standalone TTSSpeakFrame.

    2. `interrupted_since(t)` — whether the caller talked over a sentence while
       it was being synthesized (G2). A sentence the caller barged over tells us
       nothing about whether it would have played correctly, so it must not
       become a cache candidate.
    """

    def __init__(self):
        self.vendor_inflight = False
        self.last_interrupt_t = 0.0

    def note_vendor_dispatch(self) -> None:
        self.vendor_inflight = True

    def interrupted_since(self, t0: float) -> bool:
        return self.last_interrupt_t >= t0

    def observe(self, frame) -> None:
        """Called from the pipeline processor. Cheap and total — a bookkeeping
        error must never touch the call."""
        try:
            name = type(frame).__name__
            if name in ("TTSStoppedFrame", "EndFrame"):
                self.vendor_inflight = False
            elif "Interruption" in name or name in ("CancelFrame", "StartInterruptionFrame"):
                self.vendor_inflight = False
                self.last_interrupt_t = time.time()
        except Exception:
            pass


class CallCandidates:
    """Per-call candidate list, and the end-of-call admission of G3 and G4.

    Nothing here is written to the cache. This only decides which sentences
    EARNED a sighting in the ledger — a sighting being the claim "this exact
    audio was delivered, in full, to a real caller, on a call that worked".
    """

    def __init__(self, cache: SpeechCache):
        self._cache = cache
        self._items: list[Candidate] = []
        self._enabled = True

    def add(self, cand: Candidate) -> None:
        """Propose a sentence. Re-checks completeness ON PURPOSE.

        The wrapper already applies G1 before a key is ever derived, so this is
        redundant today — deliberately. The counter's whole meaning is "this
        exact, WHOLE sentence was delivered N times"; if a later edit to the
        wrapper ever lets a flush remainder through, the count would silently
        start certifying half a sentence, and the resulting blob would be played
        to every future caller who matched it. A structural guarantee here costs
        one call to is_complete and cannot be refactored away by accident.
        """
        if not self._enabled:
            return
        if not is_complete(cand.text):
            logger.warning("tts-cache: refusing incomplete candidate %r", cand.text[:48])
            return
        # Bounded: a runaway generation must not grow this without limit.
        if len(self._items) < 400:
            self._items.append(cand)

    def flush(self, *, played_text: str, verdict_faults: Iterable[str],
              health: str) -> int:
        """Apply G4 then G3, then ladder the survivors. Blocking; call at call end.

        G4 — the call has to have been healthy enough for what this sentence
        actually claims. TWO STANDARDS, because the two kinds of candidate make
        different claims:

        A FIXED line claims only "this authored string is worth rendering". Its
        audio comes from an off-call one-shot synthesis of a string an admin
        wrote; nothing about how the conversation went bears on it. So only the
        faults that implicate AUDIO can veto it — synthesis wedged, the bot went
        silent, a reply never played, the pipeline crashed.

        An LLM SENTENCE claims "the model said this, and will plausibly say it
        again". That claim does lean on the conversation having worked, so it
        keeps the strict bar: any blocking fault, or a RED verdict, drops it.

        This started as one strict rule for both, and on live agent shreya-v3 it
        was a stall rather than caution: 15 of 22 calls RED, so the opening line
        could only be learned from roughly one call in three. And the faults
        doing the blocking were DEAD_AIR, SLOW_LLM, ANSWER_DELETED — none of
        which say anything about whether the opening was rendered correctly. It
        demonstrably was; it is the first line of the transcript. Letting overall
        call health veto a per-sentence question was the error.

        G3 — an LLM sentence must appear in the PLAYED transcript, which
        PlayedTranscriptRecorder builds from TTSTextFrames released by the
        transport at playout position, i.e. text the caller actually HEARD.
        This is the same test NoRepeatGate runs to un-record never-played
        sentences (bot.py:918-922) after live call 4b1a44b9, whose lesson was
        exactly this: "'Already said' has to mean 'already HEARD'."
        """
        if not self._items:
            return 0
        try:
            faults = set(verdict_faults or ())
            audio_bad = faults & _AUDIO_BLOCKING_FAULTS
            convo_bad = (faults & _CACHE_BLOCKING_FAULTS) or (health or "").upper() == "RED"

            # normalize_spoken is NoRepeatGate's own comparator: whitespace
            # collapsed and case-folded. Used for the CONFIRMATION only — the
            # cache key itself stays byte-exact — because PlayedTranscriptRecorder
            # space-joins per-word TTSTextFrames, so an exact compare would fail
            # on punctuation spacing alone.
            from .turntake import normalize_spoken
            played = normalize_spoken(played_text or "")

            heard, unheard, dropped = [], 0, 0
            for c in self._items:
                if c.fixed:
                    if audio_bad:
                        dropped += 1
                    else:
                        heard.append(c)
                elif convo_bad:
                    dropped += 1
                elif played and normalize_spoken(c.text) in played:
                    heard.append(c)
                else:
                    unheard += 1
            self._items = []
            if dropped:
                logger.info("tts-cache: dropped %d candidate(s) — health=%s audio_faults=%s",
                            dropped, health, sorted(audio_bad) or "none")
            if unheard:
                logger.info("tts-cache: %d candidate(s) never reached the caller — not laddered",
                            unheard)
            return self._cache.ladder(heard)
        except Exception:
            logger.exception("tts-cache: flush failed — nothing laddered")
            self._items = []
            return 0


# Faults that implicate the AUDIO itself: synthesis stalled, the bot produced
# nothing, a reply never reached the caller, the pipeline died. These are the only
# ones that can say anything about whether a rendered string is trustworthy, so
# they are the only ones that veto a FIXED line. Names match diagnostics.py.
_AUDIO_BLOCKING_FAULTS = frozenset({
    "CRASH", "BOT_SILENT", "TTS_WEDGE", "REPLY_UNPLAYED",
})

# The stricter bar, for an LLM sentence — whose claim ("the model will plausibly
# say this again") does lean on the conversation having worked. Adds the faults
# about hearing and looping, and a RED verdict blocks on top.
_CACHE_BLOCKING_FAULTS = _AUDIO_BLOCKING_FAULTS | frozenset({
    "STT_DEAF", "REPLY_LOOP",
})


def make_turn_watcher_processor(watcher: TtsTurnWatcher):
    """A pass-through FrameProcessor that feeds the watcher. Goes immediately
    after `tts` in the chain, where every frame the engine produces passes."""
    from pipecat.processors.frame_processor import FrameProcessor

    class _TtsTurnWatcherProcessor(FrameProcessor):
        async def process_frame(self, frame, direction):
            await super().process_frame(frame, direction)
            watcher.observe(frame)
            await self.push_frame(frame, direction)

    return _TtsTurnWatcherProcessor()


def install_tts_cache(tts, *, engine: str, model: str, voice: str, pace,
                      temperature, term_map_version: str = "",
                      fixed_lines: Optional[set] = None,
                      agent_id: str = "", agent_name: str = "",
                      cache_mode: str = MODE_OFF,
                      normalize=None, diag=None,
                      cache: Optional[SpeechCache] = None,
                      watcher: Optional[TtsTurnWatcher] = None,
                      candidates: Optional[CallCandidates] = None):
    """Wrap a constructed TTS service so identical sentences are not paid for twice.

    ONE wrapper covers both paths — the bot's own fixed lines (which arrive as
    TTSSpeakFrame) and the LLM's sentences — because pipecat routes both through
    run_tts. An earlier design intercepted TTSSpeakFrame in a processor placed
    before `tts`; that is wrong, because TTSTextFrame subclasses TextFrame, so
    frames emitted upstream of the service are re-aggregated and SPOKEN TWICE.

    The wrapper only ever READS the cache. Writing happens off-call (§ renderer),
    so nothing a live call does can put audio in front of a future caller.
    """
    from pipecat.frames.frames import (TTSAudioRawFrame, TTSStartedFrame,
                                       TTSStoppedFrame)

    from .providers import has_word_char

    s = get_settings()
    cache = cache or get_cache()
    watcher = watcher or TtsTurnWatcher()
    fixed = {t for t in (fixed_lines or set()) if t}
    engine_l = (engine or "").strip().lower()
    async_arrival = is_async_arrival(engine_l)
    original = tts.run_tts
    # Resolved ONCE per call, not per sentence: the allowlist cannot change
    # mid-call, and re-deciding it 40 times a call would only invite a race.
    in_rollout = agent_allowed(s.tts_cache_agents, agent_id, agent_name)

    # NOT INSTALLED AT ALL when this agent cannot use the cache. Returning None
    # here rather than installing a wrapper that would decline per sentence is
    # the difference between "my code decided to do nothing" and "my code never
    # ran" — and for a feature that is OFF for every agent by default, only the
    # second is worth asserting. It also keeps the pipeline chain and the
    # engine's own run_tts byte-identical to today, so there is no extra
    # generator layer, no normalise call, and nothing of mine on the hot path.
    can_serve_anything = ((mode_allows(cache_mode, True) and s.tts_cache_speech_enabled)
                          or (mode_allows(cache_mode, False) and s.tts_cache_llm_enabled))
    if not (can_serve_anything and in_rollout):
        logger.info("tts-cache: NOT installed engine=%s agent=%s mode=%s rollout=%s "
                    "kill_speech=%s kill_llm=%s — call is untouched",
                    engine_l, agent_id or agent_name or "?",
                    (cache_mode or MODE_OFF).upper(), "in" if in_rollout else "OUT",
                    s.tts_cache_speech_enabled, s.tts_cache_llm_enabled)
        return None

    def _bump(name: str, *args) -> None:
        if diag is None:
            return
        try:
            getattr(diag, name)(*args)
        except Exception:
            pass

    async def run_tts(text: str, context_id: str = None):
        norm = text
        try:
            if normalize is not None:
                norm = normalize(text)
            norm = (norm or "").strip()
        except Exception:
            logger.exception("tts-cache: normalise failed — bypassing cache")
            async for f in original(text, context_id):
                yield f
            return

        # Preserve the existing letterless skip EXACTLY: Sarvam rejects a
        # letterless chunk with an error pipecat only logs, leaving an
        # open-but-dead socket and 8-10s of dead air. The cache must not change
        # which inputs reach that guard.
        if not has_word_char(norm):
            async for f in original(text, context_id):
                yield f
            return

        is_fixed = norm in fixed
        # Three gates, and they answer three different questions:
        #   mode_allows   — did an ADMIN turn this on for this agent? (the product
        #                   decision, per agent, no restart, V466)
        #   env switch    — is the feature allowed on this box at all? (ops kill
        #                   switch: stop it fleet-wide in one restart without
        #                   touching anybody's configuration)
        #   in_rollout    — optional extra ops restriction (TTS_CACHE_AGENTS)
        enabled = (mode_allows(cache_mode, is_fixed)
                   and in_rollout
                   and (s.tts_cache_speech_enabled if is_fixed
                        else s.tts_cache_llm_enabled))

        # G1. A fragment is not hashed, not looked up, and not laddered.
        if not enabled or not is_complete(norm):
            async for f in original(text, context_id):
                yield f
            return

        key = ""
        try:
            key = cache_key(engine=engine_l, model=model, voice=voice, pace=pace,
                            temperature=temperature, sample_rate=SAMPLE_RATE,
                            term_map_version=term_map_version, text=norm)
        except Exception:
            logger.exception("tts-cache: key derivation failed — bypassing cache")

        # Ordering (§ TtsTurnWatcher): on an async-arrival engine we may only
        # serve when the vendor owes us nothing, or the cached audio would be
        # heard before audio that was requested earlier.
        may_serve = key and (not async_arrival or not watcher.vendor_inflight)

        if not may_serve and s.tts_cache_debug:
            # The ordering guard, not the cache, refused this one. Worth its own
            # wording: it looks identical to a cold cache from the outside, and
            # chasing a "miss" that was really a deferral wastes a rollout.
            logger.info("tts-cache: MISS (vendor in flight, ordering) %r", norm[:48])

        if may_serve:
            entry = cache.lookup(key, norm)          # G6 verifies the stored text
            if entry is None and s.tts_cache_debug:
                logger.info("tts-cache: MISS (not stored) key=%s %r", key[:12], norm[:48])
            if entry is not None:
                blob = await cache.read(entry)       # G5 re-checks the length
                if blob:
                    _bump("note_tts_cache_hit", entry.duration_ms, len(norm))
                    cache.note_hit(key)
                    logger.info("tts-cache: HIT %dms %r", entry.duration_ms, norm[:48])

                    # Emit the turn brackets ONLY if the base class is not already
                    # doing it, or the caller hears two of everything.
                    #
                    # _push_tts_frames appends a TTSStartedFrame BEFORE calling
                    # run_tts when push_start_frame is set (sarvam and google both
                    # set it; our EdgeTTSService does not and yields its own). And
                    # because yielding TTSAudioRawFrame sets
                    # _is_yielding_frames_synchronously, on_turn_context_completed
                    # then appends the TTSStoppedFrame and closes the audio context
                    # for us when push_stop_frames is set. Mirroring the wrapped
                    # engine's own contract is what keeps a cached sentence
                    # indistinguishable from a synthesized one downstream.
                    own_start, own_stop = owns_turn_brackets(tts)
                    if own_start:
                        # Only start the clock when the base class did not: on
                        # sarvam/google _push_tts_frames already called
                        # start_ttfb_metrics, and restarting it would measure from
                        # here instead of from when pipecat began waiting —
                        # flattering the number by hiding our own lookup and read.
                        await tts.start_ttfb_metrics()
                        yield TTSStartedFrame(context_id=context_id)
                    await tts.stop_ttfb_metrics()
                    for i in range(0, len(blob), _CHUNK_BYTES):
                        yield TTSAudioRawFrame(blob[i:i + _CHUNK_BYTES],
                                               SAMPLE_RATE, CHANNELS,
                                               context_id=context_id)
                        # PACED, not dumped. A cached blob is available all at
                        # once, and emitting it in one burst would put the whole
                        # utterance past DuckGate and into the output queue
                        # before the caller has drawn breath — which is exactly
                        # the condition that made barge-in feel slow before
                        # AUDIO_MAX_LEAD_SECS (live call d6e82def: "dropping 0
                        # held frame(s)" on an interrupt, 1.96s of talk-over).
                        #
                        # Streaming vendor audio arrives at roughly the vendor's
                        # pace, so ducking always has frames still to hold. Half
                        # a chunk's wall time per chunk reproduces that: ~2x real
                        # time, the same rate pipecat's own websocket output
                        # uses. It costs NOTHING in playback latency — the
                        # transport paces the line regardless — and it keeps the
                        # amount of already-committed audio identical to today.
                        await asyncio.sleep(_EMIT_SLEEP)
                    if own_stop:
                        yield TTSStoppedFrame(context_id=context_id)
                    return

        # Counted here rather than at entry, so the denominator is "sentences the
        # cache could possibly have served". Fragments and letterless chunks were
        # never candidates and would only dilute the hit rate.
        _bump("note_tts_cache_miss", len(norm))
        if async_arrival:
            watcher.note_vendor_dispatch()

        # G2: only a sentence that ran to completion with no interruption over it
        # is allowed to become a candidate.
        t0 = time.time()
        clean = True
        try:
            async for f in original(text, context_id):
                yield f
        except (GeneratorExit, asyncio.CancelledError):
            clean = False
            raise
        finally:
            if clean and key and candidates is not None and not watcher.interrupted_since(t0):
                candidates.add(Candidate(
                    key=key, text=norm, chars=len(norm), engine=engine_l,
                    model=model or "", voice=voice or "", pace=pace,
                    temperature=temperature, fixed=is_fixed))

    tts.run_tts = run_tts
    # One line per call saying exactly which gates are open. Without it, "why did
    # this call not hit the cache" is a guess between four different switches.
    logger.info("tts-cache: installed engine=%s voice=%s agent=%s mode=%s rollout=%s "
                "kill_speech=%s kill_llm=%s async_arrival=%s entries=%d",
                engine_l, voice, agent_id or agent_name or "?",
                (cache_mode or MODE_OFF).upper(), "in" if in_rollout else "OUT",
                s.tts_cache_speech_enabled, s.tts_cache_llm_enabled,
                async_arrival, cache.size)
    return watcher
