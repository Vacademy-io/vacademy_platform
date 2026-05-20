"""fal.ai client for CassetteAI sound-effects-generator.

Replaces fal-ai/elevenlabs/sound-effects-v2 as the SFX source. CassetteAI
positioned its model as "stunningly realistic" and "high-quality SFX up
to 30 seconds" — anecdotally tighter prompt adherence on cinematic /
physical-event sounds (typewriter ticks, paper rustle, bar growth tone,
button click, etc.) which is exactly the event-driven palette we now
need after demolishing the auto-transition rules.

Endpoint:   https://fal.run/cassetteai/sound-effects-generator
Pricing:    $0.01 per generation (FLAT — duration-independent)
Duration:   integer 1-30 seconds (NOT a float — model takes int only)
Output:     .wav file URL in `audio_file.url` (NOT `audio.url`!)

Input schema:
    {"prompt": "<text>", "duration": <int 1-30>}

Output schema:
    {"audio_file": {"url": "https://v3.fal.media/.../generated.wav"}}

Key differences vs ElevenLabs client:
  - flat price → cost is $0.01 regardless of duration
  - integer duration (must be in [1, 30])
  - no loop / prompt_influence / output_format params (simpler API)
  - response key is `audio_file.url` not `audio.url`
  - output is WAV not MP3 (caller may want to re-encode for storage)

Mirrors fal_elevenlabs_client's surface so the swap is mechanical at
the call site: same `submit(text, duration_s=..., proactively_download=True)`
signature, same `AudioResult` shape.

Failure posture: graceful — every method has a fallback path. The audio
pipeline degrades to no-SFX rather than blocking the render.
"""
from __future__ import annotations

import hashlib
import logging
import os
import random
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Dict, Optional

import httpx

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
_FAL_BASE = "https://fal.run"
_ENDPOINT = "cassetteai/sound-effects-generator"

# Per the fal docs llms.txt — integer seconds in [1, 30]. Callers may pass
# a float; we round + clamp before sending.
MIN_DURATION_S = 1
MAX_DURATION_S = 30

# Flat $0.01 per call regardless of duration. Local cost tracking uses
# this constant so the ledger reflects spend without waiting for invoices.
PRICE_PER_CALL_USD = 0.01

# Output is always WAV from this model. We keep the constant for parity
# with the ElevenLabs client where output_format was tunable.
DEFAULT_OUTPUT_EXTENSION = "wav"

# Transport timeout. The model claims ~1 second of processing per gen
# but allow generous headroom for cold starts / queueing.
_DEFAULT_REQUEST_TIMEOUT_S = 60.0


# ---------------------------------------------------------------------------
# Exceptions (mirror ElevenLabs surface so the call site catches both
# the same way during the transition window)
# ---------------------------------------------------------------------------

class CassetteAIError(RuntimeError):
    """Any fal-cassetteai failure callers should treat as graceful
    degradation. Audio pipeline drops the failing cue + continues."""


class CassetteAISubmitError(CassetteAIError):
    """HTTP error from fal. Includes status + body excerpt."""
    def __init__(self, status_code: int, body: str):
        super().__init__(f"fal-cassetteai HTTP {status_code}: {body[:300]}")
        self.status_code = status_code
        self.body = body


class CassetteAITimeout(CassetteAIError):
    """Request didn't complete within the per-call deadline."""


class CassetteAIQuotaExceeded(CassetteAIError):
    """Persistent 429 — degrade to fallback (library or no-SFX)."""


# ---------------------------------------------------------------------------
# Result type — same shape as ElevenLabs's AudioResult so callers can
# treat both interchangeably during the transition.
# ---------------------------------------------------------------------------

@dataclass
class AudioResult:
    """Outcome of one generation call."""
    url: str = ""
    audio_bytes: bytes = b""
    duration_s: float = 0.0
    cost_usd: float = 0.0
    cache_hit: bool = False
    text: str = ""
    output_format: str = "wav"
    raw_response: Dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def price_per_call_usd(_duration_s: float = 0.0) -> float:
    """Flat cost per call. Duration is accepted for signature compatibility
    with the ElevenLabs client but ignored — CassetteAI charges per-call."""
    return PRICE_PER_CALL_USD


def _content_hash(text: str, duration_int: int) -> str:
    """Sha256 over the request shape. Used as the cache key.
    Order matters — keep stable across versions or caches invalidate
    silently."""
    payload = f"{text}|{duration_int}|cassetteai_v1"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:32]


def get_fal_api_key_from_env() -> Optional[str]:
    """Resolve the fal.ai API key (same env vars all fal clients use)."""
    for key in ("FAL_API_KEY", "FAL_KEY"):
        v = os.environ.get(key)
        if v and v.strip():
            return v.strip()
    return None


def _normalize_duration(duration_s: Optional[float]) -> int:
    """Clamp + round a caller-supplied float duration to the integer
    range CassetteAI accepts. Default 2 seconds when nothing specified —
    long enough for most SFX events the GSAP scanner emits."""
    if duration_s is None:
        return 2
    try:
        rounded = int(round(float(duration_s)))
    except (TypeError, ValueError):
        return 2
    return max(MIN_DURATION_S, min(MAX_DURATION_S, rounded))


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

class FalCassetteAIClient:
    """HTTP client for cassetteai/sound-effects-generator.

    Stateless aside from the optional disk cache. Safe per-request or as
    a singleton.

    Usage:
        client = FalCassetteAIClient(
            api_key=get_fal_api_key_from_env(),
            cache_dir=run_dir / "_audio_cache",
        )
        result = client.submit(
            text="Typewriter clattering, mechanical keyboard, individual key clicks",
            duration_s=1.5,
        )
        if result.audio_bytes:
            (run_dir / "sfx_typewriter.wav").write_bytes(result.audio_bytes)
    """

    def __init__(
        self,
        api_key: str,
        *,
        cache_dir: Optional[Path] = None,
        request_timeout_s: float = _DEFAULT_REQUEST_TIMEOUT_S,
        max_retries: int = 3,
        user_agent: str = "vacademy-audio-pipeline/2",
    ):
        if not api_key:
            raise ValueError("FalCassetteAIClient requires an api_key")
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
        proactively_download: bool = True,
        # Accept-and-ignore params that exist on the ElevenLabs client so
        # callers can swap clients without changing every call site.
        loop: bool = False,  # noqa: ARG002  (unused — cassetteai has no loop)
        prompt_influence: float = 0.5,  # noqa: ARG002  (unused — no influence param)
        output_format: str = "wav",  # noqa: ARG002  (always wav)
    ) -> AudioResult:
        """Generate one SFX clip.

        Args:
            text: prompt describing the desired sound. Keep concrete and
                physical ("typewriter clatter on mechanical keyboard",
                "single bell strike with warm decay") — the model
                responds best to source-material descriptions, not
                abstract adjectives like "celebratory" or "cinematic".
            duration_s: target length. Clamped + rounded to integer
                [1, 30]. Defaults to 2 when None.
            proactively_download: when True, fetch the audio bytes after
                submit so the caller gets them inline. When False, only
                the URL is returned.
            loop / prompt_influence / output_format: accepted for source
                compatibility with the ElevenLabs client; ignored here
                because CassetteAI's API doesn't expose these.

        Returns:
            AudioResult with `url`, `audio_bytes` (when downloaded), and
            cost_usd=PRICE_PER_CALL_USD (flat).

        Raises:
            CassetteAISubmitError on 4xx (after retries don't help).
            CassetteAIQuotaExceeded on persistent 429.
            CassetteAITimeout when the call exceeds the deadline.
        """
        if not text or not text.strip():
            raise ValueError("CassetteAI submit requires non-empty text")

        duration_int = _normalize_duration(duration_s)
        # Caller-facing duration_s reflects the actual model duration so
        # downstream timing math is consistent (we round down to int).
        effective_duration_s = float(duration_int)

        # Cache lookup — content-hash includes text + duration only since
        # those are the only request params the model takes.
        cache_key = _content_hash(text.strip(), duration_int)
        cached = self._load_from_cache(cache_key)
        if cached is not None:
            logger.info("fal-cassetteai cache HIT for hash=%s", cache_key)
            return AudioResult(
                url="",
                audio_bytes=cached,
                duration_s=effective_duration_s,
                cost_usd=0.0,
                cache_hit=True,
                text=text,
                output_format="wav",
            )

        body: Dict[str, Any] = {
            "prompt": text.strip(),
            "duration": duration_int,
        }

        url = f"{_FAL_BASE}/{_ENDPOINT}"
        headers = {
            "Authorization": f"Key {self._api_key}",
            "Content-Type": "application/json",
            "User-Agent": self._user_agent,
        }

        # Retry loop — same shape as the ElevenLabs client. 429 = exp
        # backoff; 5xx = linear; other 4xx = hard fail.
        last_exc: Optional[Exception] = None
        attempt = 0
        while attempt <= self._max_retries:
            attempt += 1
            try:
                with httpx.Client(timeout=self._timeout) as client:
                    resp = client.post(url, json=body, headers=headers)
            except httpx.TimeoutException as e:
                last_exc = CassetteAITimeout(
                    f"fal-cassetteai timeout after {self._timeout}s: {e}"
                )
                logger.warning(
                    "fal-cassetteai attempt %d/%d timed out for prompt=%r",
                    attempt, self._max_retries + 1, text[:60],
                )
                if attempt > self._max_retries:
                    raise last_exc
                time.sleep(self._linear_backoff(attempt))
                continue
            except httpx.RequestError as e:
                last_exc = CassetteAISubmitError(0, f"transport error: {e}")
                logger.warning("fal-cassetteai attempt %d transport error: %s",
                               attempt, e)
                if attempt > self._max_retries:
                    raise last_exc
                time.sleep(self._linear_backoff(attempt))
                continue

            if resp.status_code == 200:
                return self._handle_success(
                    resp, text=text, duration_s=effective_duration_s,
                    proactively_download=proactively_download,
                    cache_key=cache_key,
                )

            if resp.status_code == 429:
                retry_after = self._parse_retry_after(resp)
                logger.warning(
                    "fal-cassetteai 429 attempt %d/%d — retry-after %.1fs",
                    attempt, self._max_retries + 1, retry_after,
                )
                if attempt > self._max_retries:
                    raise CassetteAIQuotaExceeded(
                        f"fal-cassetteai persistent 429 after {self._max_retries} retries"
                    )
                time.sleep(retry_after)
                continue

            if 500 <= resp.status_code < 600:
                logger.warning(
                    "fal-cassetteai 5xx attempt %d/%d: HTTP %d",
                    attempt, self._max_retries + 1, resp.status_code,
                )
                if attempt > self._max_retries:
                    raise CassetteAISubmitError(resp.status_code, resp.text)
                time.sleep(self._linear_backoff(attempt))
                continue

            # 4xx other than 429 — hard fail.
            raise CassetteAISubmitError(resp.status_code, resp.text)

        if last_exc:
            raise last_exc
        raise CassetteAIError("fal-cassetteai retry loop exhausted unexpectedly")

    # ----- internal helpers ---------------------------------------------

    def _handle_success(
        self,
        resp: httpx.Response,
        *,
        text: str,
        duration_s: float,
        proactively_download: bool,
        cache_key: str,
    ) -> AudioResult:
        """Parse a 200 response. NOTE the key is `audio_file.url` for
        CassetteAI (different from ElevenLabs's `audio.url`)."""
        try:
            data = resp.json()
        except Exception as e:
            logger.error("fal-cassetteai 200 had non-JSON body: %s", e)
            return AudioResult(
                text=text, duration_s=duration_s,
                cost_usd=PRICE_PER_CALL_USD,
                output_format="wav", raw_response={},
            )

        audio_file = (data.get("audio_file") or {})
        audio_url = (audio_file.get("url") or "").strip()
        if not audio_url:
            logger.error("fal-cassetteai response missing audio_file.url: %s", data)
            return AudioResult(
                text=text, duration_s=duration_s,
                cost_usd=PRICE_PER_CALL_USD,
                output_format="wav", raw_response=data,
            )

        audio_bytes = b""
        if proactively_download:
            try:
                with httpx.Client(timeout=self._timeout) as client:
                    dl = client.get(audio_url)
                if dl.status_code == 200 and dl.content:
                    audio_bytes = dl.content
                    self._save_to_cache(cache_key, audio_bytes)
                else:
                    logger.warning(
                        "fal CDN GET %s returned HTTP %d",
                        audio_url, dl.status_code,
                    )
            except Exception as e:
                logger.warning("Could not download fal CDN audio: %s", e)

        return AudioResult(
            url=audio_url,
            audio_bytes=audio_bytes,
            duration_s=duration_s,
            cost_usd=PRICE_PER_CALL_USD,
            cache_hit=False,
            text=text,
            output_format="wav",
            raw_response=data,
        )

    def _cache_path(self, key: str) -> Optional[Path]:
        if self._cache_dir is None:
            return None
        return self._cache_dir / f"{key}.{DEFAULT_OUTPUT_EXTENSION}"

    def _load_from_cache(self, key: str) -> Optional[bytes]:
        path = self._cache_path(key)
        if path is None or not path.exists():
            return None
        try:
            data = path.read_bytes()
            return data if data else None
        except OSError as e:
            logger.warning("Could not read cache file %s: %s", path, e)
            return None

    def _save_to_cache(self, key: str, data: bytes) -> None:
        path = self._cache_path(key)
        if path is None or not data:
            return
        try:
            path.write_bytes(data)
        except OSError as e:
            logger.warning("Could not write cache file %s: %s", path, e)

    @staticmethod
    def _linear_backoff(attempt: int) -> float:
        return float(2 * attempt) + random.uniform(0.0, 1.0)

    @staticmethod
    def _parse_retry_after(resp: httpx.Response) -> float:
        raw = resp.headers.get("Retry-After", "").strip()
        if not raw:
            return 10.0
        try:
            return float(raw) + 0.5
        except ValueError:
            return 10.0
