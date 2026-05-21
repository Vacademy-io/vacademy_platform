"""fal.ai client for ElevenLabs sound-effects-v2 audio generation.

Used by the audio pipeline for three jobs:
  1. Background music beds — long-form looped musical pads / underbeds
     (`loop=true`, 22s seamless loop, prompt like "warm cinematic strings,
     gentle motion, uplifting")
  2. SFX cues — short stingers / chimes / impacts emitted by sound_planner
     for shot transitions and emphasis points
  3. Transition stingers — fresh-feeling whooshes generated per video so
     consecutive transitions don't sound identical (vs. the static
     sounds_metadata.json library which repeats)

Endpoint: https://fal.run/fal-ai/elevenlabs/sound-effects/v2
Pricing:  $0.002 per second of generated audio
Max duration per call: 22.0 seconds
Min duration per call: 0.5 seconds

The "Music generation not supported" disclaimer in fal's docs refers to
song / vocal generation. Instrumental musical beds with `loop=true` work
fine — the model treats them as ambient sound. Two-decade-of-keynote-tier
musical pads come out clean.

Caching: every successful generation is content-hashed (sha256 of
text|duration|loop|prompt_influence) and saved to disk. Re-renders of
the same video reuse cached audio. The cache directory is run-scoped so
old runs don't leak into new ones unless explicitly shared via
`shared_cache_dir`.

Failure posture: every method has a graceful degradation path. The
audio pipeline downgrades to VO-only on full client failure (env var
missing, all requests 5xx) rather than blocking the render.
"""
from __future__ import annotations

import hashlib
import logging
import os
import random
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_FAL_BASE = "https://fal.run"
_ENDPOINT = "fal-ai/elevenlabs/sound-effects/v2"

# Per the fal docs llms.txt — strict bounds. Caller-supplied durations are
# clamped to this range before submit.
MIN_DURATION_S = 0.5
MAX_DURATION_S = 22.0

# Pricing: $0.002/sec generated. Used to compute cost_usd locally so the
# cost ledger / circuit breaker doesn't have to wait for an invoice round-
# trip. Match fal's stated rate; if they change it, update here.
PRICE_PER_SECOND_USD = 0.002

# Allowed output_format values per the spec. Default to mp3 at 128kbps
# 44.1kHz — close enough to perceptual transparency for short SFX and
# small enough to keep S3 storage costs negligible.
ALLOWED_OUTPUT_FORMATS = (
    "mp3_22050_32", "mp3_44100_32", "mp3_44100_64", "mp3_44100_96",
    "mp3_44100_128", "mp3_44100_192",
    "pcm_8000", "pcm_16000", "pcm_22050", "pcm_24000",
    "pcm_44100", "pcm_48000",
    "ulaw_8000", "alaw_8000",
    "opus_48000_32", "opus_48000_64", "opus_48000_96",
    "opus_48000_128", "opus_48000_192",
)
DEFAULT_OUTPUT_FORMAT = "mp3_44100_128"

# Transport timeouts. fal's endpoint is synchronous for sound-effects
# (unlike Veo which uses queue+poll). A 22s generation usually returns
# in 3-8s; we set a generous 60s ceiling so a slow render doesn't kill
# the whole audio pipeline.
_DEFAULT_REQUEST_TIMEOUT_S = 60.0


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class ElevenLabsError(RuntimeError):
    """Base — any fal-elevenlabs failure that callers should treat as a
    graceful degradation trigger. Audio pipeline drops the failing track
    and continues rather than aborting the whole render."""


class ElevenLabsSubmitError(ElevenLabsError):
    """HTTP error from fal. Includes status + body excerpt for diagnostics."""
    def __init__(self, status_code: int, body: str):
        super().__init__(f"fal-elevenlabs HTTP {status_code}: {body[:300]}")
        self.status_code = status_code
        self.body = body


class ElevenLabsTimeout(ElevenLabsError):
    """Request didn't complete within the per-call deadline."""


class ElevenLabsQuotaExceeded(ElevenLabsError):
    """429 with no Retry-After or after max retries exhausted. Treat as
    'fal is unhappy right now' — cascade to fallback library / no-music
    mode for this run."""


# ---------------------------------------------------------------------------
# Result type
# ---------------------------------------------------------------------------

@dataclass
class AudioResult:
    """Outcome of one generation call.

    `url` is the fal CDN URL (also `audio_bytes` when we proactively
    downloaded). `cost_usd` is computed locally from `duration_s` ×
    PRICE_PER_SECOND_USD. `cache_hit=True` means the bytes came from
    disk cache; no network call, no cost.
    """
    url: str = ""
    audio_bytes: bytes = b""
    duration_s: float = 0.0
    cost_usd: float = 0.0
    cache_hit: bool = False
    text: str = ""
    output_format: str = DEFAULT_OUTPUT_FORMAT
    raw_response: Dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def price_per_call_usd(duration_s: float) -> float:
    """Cost for one ElevenLabs call. Cap at the max duration so over-long
    requests (which fal will clamp anyway) don't over-charge in the
    ledger."""
    clamped = min(max(float(duration_s), MIN_DURATION_S), MAX_DURATION_S)
    return round(PRICE_PER_SECOND_USD * clamped, 5)


def _content_hash(text: str, duration_s: float, loop: bool,
                  prompt_influence: float, output_format: str) -> str:
    """Sha256 over the canonical request shape. Used as the cache key.
    Order matters — keep stable across versions or all caches invalidate
    silently."""
    payload = f"{text}|{round(duration_s, 3)}|{int(loop)}|{round(prompt_influence, 3)}|{output_format}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:32]


def get_fal_api_key_from_env() -> Optional[str]:
    """Resolve the fal.ai API key. Mirrors `fal_veo_client.get_fal_api_key_from_env`
    so all fal-backed clients pull from the same env var.

    Returns None if `FAL_API_KEY` is not set so the caller can degrade
    gracefully (audio pipeline becomes VO-only).
    """
    v = os.environ.get("FAL_API_KEY")
    if v and v.strip():
        return v.strip()
    return None


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

class FalElevenLabsClient:
    """HTTP client for fal-ai/elevenlabs/sound-effects/v2.

    Stateless aside from the optional disk cache. Safe to instantiate per
    request OR pass around as a singleton — both work.

    Usage:
        client = FalElevenLabsClient(api_key=get_fal_api_key_from_env(),
                                     cache_dir=run_dir / "_audio_cache")
        result = client.submit(
            text="Warm cinematic ambient pad, gentle motion",
            duration_s=22.0,
            loop=True,
        )
        if result.audio_bytes:
            (run_dir / "music.mp3").write_bytes(result.audio_bytes)
    """

    def __init__(
        self,
        api_key: str,
        *,
        cache_dir: Optional[Path] = None,
        request_timeout_s: float = _DEFAULT_REQUEST_TIMEOUT_S,
        max_retries: int = 3,
        user_agent: str = "vacademy-audio-pipeline/1",
    ):
        if not api_key:
            raise ValueError("FalElevenLabsClient requires an api_key")
        self._api_key = api_key
        self._timeout = float(request_timeout_s)
        self._max_retries = int(max_retries)
        self._user_agent = user_agent
        self._cache_dir: Optional[Path] = None
        if cache_dir is not None:
            self._cache_dir = Path(cache_dir)
            try:
                self._cache_dir.mkdir(parents=True, exist_ok=True)
            except OSError as e:
                logger.warning("Could not create cache dir %s: %s", self._cache_dir, e)
                self._cache_dir = None

    # ----- public API ----------------------------------------------------

    def submit(
        self,
        text: str,
        *,
        duration_s: Optional[float] = None,
        loop: bool = False,
        prompt_influence: float = 0.5,
        output_format: str = DEFAULT_OUTPUT_FORMAT,
        proactively_download: bool = True,
    ) -> AudioResult:
        """Generate one audio clip.

        Args:
            text: prompt describing the desired sound / music. No length
                cap documented but keep it under ~500 chars for best
                adherence. Avoid named brands or copyrighted material
                in the prompt — fal will refuse.
            duration_s: target length in seconds. Clamped to [0.5, 22.0].
                When None, fal picks an optimal length from the prompt.
            loop: when True, output is engineered to loop seamlessly.
                Use for music beds; leave False for one-shot SFX/stingers.
            prompt_influence: 0..1; 0.3 is fal's default. Higher = stricter
                adherence to text, lower = more creative variation. 0.5 is
                a good middle for predictable musical beds.
            output_format: one of ALLOWED_OUTPUT_FORMATS. Defaults to
                mp3_44100_128 (~128kbps mp3, 44.1kHz).
            proactively_download: when True, the client downloads the
                returned URL's bytes and includes them in `audio_bytes`.
                When False, only the URL is returned (cheaper if the
                caller will hand the URL straight to ffmpeg via http).

        Returns:
            AudioResult with the chosen `text`, the fal `url`, optional
            `audio_bytes`, and `cost_usd` computed locally.

        Raises:
            ElevenLabsSubmitError on 4xx (after retries don't help).
            ElevenLabsQuotaExceeded on persistent 429.
            ElevenLabsTimeout when the call exceeds the deadline.
        """
        if not text or not text.strip():
            raise ValueError("ElevenLabs submit requires non-empty text")

        # Validate + normalize inputs upstream of any network call.
        if duration_s is not None:
            duration_s = min(max(float(duration_s), MIN_DURATION_S), MAX_DURATION_S)
        prompt_influence = max(0.0, min(1.0, float(prompt_influence)))
        if output_format not in ALLOWED_OUTPUT_FORMATS:
            logger.warning(
                "Unknown output_format %r — defaulting to %s",
                output_format, DEFAULT_OUTPUT_FORMAT,
            )
            output_format = DEFAULT_OUTPUT_FORMAT

        # Cache lookup — content-hash includes every request param so
        # any change to the prompt / duration / format invalidates.
        cache_key = _content_hash(
            text.strip(), duration_s or 0.0, loop, prompt_influence, output_format,
        )
        cached = self._load_from_cache(cache_key, output_format)
        if cached is not None:
            logger.info("fal-elevenlabs cache HIT for hash=%s", cache_key)
            return AudioResult(
                url="",  # cached payload — no fresh URL
                audio_bytes=cached,
                duration_s=duration_s or 0.0,
                cost_usd=0.0,
                cache_hit=True,
                text=text,
                output_format=output_format,
            )

        # Build request body. fal accepts JSON; omit None duration so the
        # model picks an optimal length from the prompt.
        body: Dict[str, Any] = {
            "text": text.strip(),
            "prompt_influence": prompt_influence,
            "output_format": output_format,
            "loop": bool(loop),
        }
        if duration_s is not None:
            body["duration_seconds"] = duration_s

        url = f"{_FAL_BASE}/{_ENDPOINT}"
        headers = {
            "Authorization": f"Key {self._api_key}",
            "Content-Type": "application/json",
            "User-Agent": self._user_agent,
        }

        # Retry loop. 429 = exponential backoff with Retry-After honored.
        # 5xx = linear backoff. 4xx other than 429 = hard fail (caller's
        # prompt is wrong; retrying won't help).
        last_exc: Optional[Exception] = None
        attempt = 0
        while attempt <= self._max_retries:
            attempt += 1
            try:
                with httpx.Client(timeout=self._timeout) as client:
                    resp = client.post(url, json=body, headers=headers)
            except httpx.TimeoutException as e:
                last_exc = ElevenLabsTimeout(f"fal-elevenlabs timeout after {self._timeout}s: {e}")
                logger.warning(
                    "fal-elevenlabs attempt %d/%d timed out for prompt=%r",
                    attempt, self._max_retries + 1, text[:60],
                )
                if attempt > self._max_retries:
                    raise last_exc
                time.sleep(self._linear_backoff(attempt))
                continue
            except httpx.RequestError as e:
                last_exc = ElevenLabsSubmitError(0, f"transport error: {e}")
                logger.warning("fal-elevenlabs attempt %d transport error: %s", attempt, e)
                if attempt > self._max_retries:
                    raise last_exc
                time.sleep(self._linear_backoff(attempt))
                continue

            if resp.status_code == 200:
                return self._handle_success(
                    resp, text=text, duration_s=duration_s or 0.0,
                    output_format=output_format,
                    proactively_download=proactively_download,
                    cache_key=cache_key,
                )

            if resp.status_code == 429:
                # Quota exceeded. Honor Retry-After if present.
                retry_after = self._parse_retry_after(resp)
                logger.warning(
                    "fal-elevenlabs 429 attempt %d/%d — retry-after %.1fs",
                    attempt, self._max_retries + 1, retry_after,
                )
                if attempt > self._max_retries:
                    raise ElevenLabsQuotaExceeded(
                        f"fal-elevenlabs persistent 429 after {self._max_retries} retries"
                    )
                time.sleep(retry_after)
                continue

            if 500 <= resp.status_code < 600:
                logger.warning(
                    "fal-elevenlabs 5xx attempt %d/%d: HTTP %d",
                    attempt, self._max_retries + 1, resp.status_code,
                )
                if attempt > self._max_retries:
                    raise ElevenLabsSubmitError(resp.status_code, resp.text)
                time.sleep(self._linear_backoff(attempt))
                continue

            # 4xx (not 429) — hard fail. Retry won't help.
            raise ElevenLabsSubmitError(resp.status_code, resp.text)

        # Loop exit without success — shouldn't reach here, but defensive.
        if last_exc:
            raise last_exc
        raise ElevenLabsError("fal-elevenlabs retry loop exhausted without success or exception")

    # ----- internal helpers ---------------------------------------------

    def _handle_success(
        self,
        resp: httpx.Response,
        *,
        text: str,
        duration_s: float,
        output_format: str,
        proactively_download: bool,
        cache_key: str,
    ) -> AudioResult:
        """Parse a 200 response and optionally download the audio bytes.
        Always returns an AudioResult; never raises on parse glitches
        (returns empty bytes + URL, caller decides what to do)."""
        try:
            data = resp.json()
        except Exception as e:
            logger.error("fal-elevenlabs 200 had non-JSON body: %s", e)
            return AudioResult(text=text, duration_s=duration_s,
                               cost_usd=price_per_call_usd(duration_s),
                               output_format=output_format, raw_response={})

        audio = (data.get("audio") or {})
        audio_url = (audio.get("url") or "").strip()
        if not audio_url:
            logger.error("fal-elevenlabs response missing audio.url: %s", data)
            return AudioResult(text=text, duration_s=duration_s,
                               cost_usd=price_per_call_usd(duration_s),
                               output_format=output_format, raw_response=data)

        audio_bytes = b""
        if proactively_download:
            try:
                with httpx.Client(timeout=self._timeout) as client:
                    dl = client.get(audio_url)
                if dl.status_code == 200 and dl.content:
                    audio_bytes = dl.content
                    # Save to cache for re-renders.
                    self._save_to_cache(cache_key, audio_bytes, output_format)
                else:
                    logger.warning(
                        "fal CDN GET %s returned HTTP %d", audio_url, dl.status_code,
                    )
            except Exception as e:
                logger.warning("Could not download fal CDN audio: %s", e)
                # Caller still gets the URL — they can fetch it later or
                # hand it directly to ffmpeg.

        return AudioResult(
            url=audio_url,
            audio_bytes=audio_bytes,
            duration_s=duration_s,
            cost_usd=price_per_call_usd(duration_s),
            cache_hit=False,
            text=text,
            output_format=output_format,
            raw_response=data,
        )

    def _cache_path(self, key: str, output_format: str) -> Optional[Path]:
        if self._cache_dir is None:
            return None
        ext = self._ext_for_format(output_format)
        return self._cache_dir / f"{key}.{ext}"

    def _load_from_cache(self, key: str, output_format: str) -> Optional[bytes]:
        path = self._cache_path(key, output_format)
        if path is None or not path.exists():
            return None
        try:
            data = path.read_bytes()
            return data if data else None
        except OSError as e:
            logger.warning("Could not read cache file %s: %s", path, e)
            return None

    def _save_to_cache(self, key: str, data: bytes, output_format: str) -> None:
        path = self._cache_path(key, output_format)
        if path is None or not data:
            return
        try:
            path.write_bytes(data)
        except OSError as e:
            logger.warning("Could not write cache file %s: %s", path, e)

    @staticmethod
    def _ext_for_format(output_format: str) -> str:
        if output_format.startswith("mp3"):
            return "mp3"
        if output_format.startswith("pcm"):
            return "wav"
        if output_format.startswith("opus"):
            return "opus"
        if output_format.startswith(("ulaw", "alaw")):
            return "wav"
        return "bin"

    @staticmethod
    def _linear_backoff(attempt: int) -> float:
        """Linear backoff with small jitter. attempt=1 → ~2s,
        attempt=2 → ~4s, attempt=3 → ~6s."""
        return float(2 * attempt) + random.uniform(0.0, 1.0)

    @staticmethod
    def _parse_retry_after(resp: httpx.Response) -> float:
        """Read Retry-After header. Some 429s come with seconds, some
        with HTTP-date. Some come with neither — fall back to 10s."""
        raw = resp.headers.get("Retry-After", "").strip()
        if not raw:
            return 10.0
        try:
            return float(raw) + 0.5
        except ValueError:
            # HTTP-date format — too rare to parse properly; use floor.
            return 10.0


# ---------------------------------------------------------------------------
# Convenience helpers for common call shapes
# ---------------------------------------------------------------------------

def generate_music_bed(
    client: FalElevenLabsClient,
    prompt: str,
    *,
    duration_s: float = 22.0,
) -> AudioResult:
    """Generate a seamless looping music bed.

    Always uses `loop=True` and prompt_influence=0.55 (mid-high so the
    bed stays on-mood without being too literal). Useful when the
    music_generator just wants "a 22s loopable bed in mood X" without
    repeating the constants.
    """
    return client.submit(
        prompt,
        duration_s=min(duration_s, MAX_DURATION_S),
        loop=True,
        prompt_influence=0.55,
    )


def generate_sfx_oneshot(
    client: FalElevenLabsClient,
    prompt: str,
    *,
    duration_s: float = 1.0,
) -> AudioResult:
    """Generate a one-shot SFX (whoosh / chime / impact).

    Always `loop=False`, slightly higher prompt_influence (0.65) so
    short clips stay on-effect. Caller is responsible for placement
    (adelay) in the mix.
    """
    return client.submit(
        prompt,
        duration_s=max(min(duration_s, MAX_DURATION_S), MIN_DURATION_S),
        loop=False,
        prompt_influence=0.65,
    )
