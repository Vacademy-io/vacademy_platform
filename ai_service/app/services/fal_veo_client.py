"""fal.ai client for AI video generation via veo3.1/lite (Phase 3).

Used by `automation_pipeline._shot_task` when shot_type=='AI_VIDEO_HERO' or
when the per-shot HTML composer encounters an inline `<aivideo>` tag (Phase 6).

Endpoints (queue / async submit-poll):
  text-to-video:   POST https://queue.fal.run/fal-ai/veo3.1/lite
  image-to-video:  POST https://queue.fal.run/fal-ai/veo3.1/lite/image-to-video
  (Phase 4 wires the image-to-video path for >8s shot chaining via last-frame
  extraction. Phase 3 ships text-to-video only — `submit_image_to_video` is
  scaffolded here for Phase 4 to call.)

Pricing (the client emits cost_usd in each result so the pipeline circuit
breaker can tally and trip at $1.50 per video):
  720p + audio:    $0.05 / s
  720p no-audio:   $0.03 / s
  1080p + audio:   $0.08 / s   (not used — plan locks 720p)
  1080p no-audio:  $0.05 / s   (not used — plan locks 720p)

Single-shot lifecycle:
  1. submit_text_to_video(prompt, duration, ...)  → POST queue → FalVeoSubmission
  2. wait_for_result(submission)                  → poll status_url until DONE
  3. result.video_url                             → fal CDN URL (download or proxy)

Failure modes — all raise typed exceptions so the caller can dispatch:
  - VeoSafetyBlocked         (model rejected prompt; auto_fix didn't recover)
  - VeoQuotaExceeded         (fal.ai rate limit / per-day quota)
  - VeoTimeout               (job didn't complete within deadline)
  - VeoSubmitError           (4xx/5xx on submit)
  - VeoPollError             (5xx during polling)
  - VeoMalformedResponse     (success status but no video URL extractable)

Concurrency model: this client is sync-callable from threads (each call
manages its own short-lived asyncio loop via `asyncio.run`). The main
pipeline's per-shot ThreadPoolExecutor decides concurrency — typically
max_workers=2 for Veo (slow + expensive) per the plan §5 Phase 3.
"""
from __future__ import annotations

import asyncio
import json
import logging
import os
import time
from dataclasses import dataclass, field
from typing import Any, Dict, Optional, Tuple

import httpx

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants — locked by the plan
# ---------------------------------------------------------------------------
_FAL_QUEUE_BASE = "https://queue.fal.run"
_TEXT_TO_VIDEO_ENDPOINT = "fal-ai/veo3.1/lite"
_IMAGE_TO_VIDEO_ENDPOINT = "fal-ai/veo3.1/lite/image-to-video"

_DEFAULT_SUBMIT_TIMEOUT_S = 30.0
_DEFAULT_POLL_TIMEOUT_S = 30.0
_DEFAULT_RENDER_DEADLINE_S = 180.0   # 3 min hard ceiling per Veo call (most complete in 30-90s)
_DEFAULT_POLL_INTERVAL_S = 4.0

# Allowed enum values per the veo3.1/lite spec.
ALLOWED_DURATIONS_S = (4, 6, 8)
ALLOWED_ASPECT_RATIOS = ("16:9", "9:16")
ALLOWED_RESOLUTIONS = ("720p", "1080p")
ALLOWED_SAFETY_TOLERANCES = ("1", "2", "3", "4", "5", "6")

# Pricing table (per-second). Used to compute cost_usd from request params.
# Indexed by (resolution, audio_on).
_PRICE_PER_SECOND_USD: Dict[Tuple[str, bool], float] = {
    ("720p",  False): 0.03,
    ("720p",  True):  0.05,
    ("1080p", False): 0.05,
    ("1080p", True):  0.08,
}


def price_per_call_usd(*, resolution: str, duration_s: int, audio_on: bool) -> float:
    """Cost in USD for one Veo call at the given params. The pipeline
    increments the per-video circuit-breaker tally with this value
    immediately after a successful submit — params fully determine cost,
    no need to wait for the invoice."""
    rate = _PRICE_PER_SECOND_USD.get((resolution, bool(audio_on)))
    if rate is None:
        # Defensive: if a new combo arrives, charge the most expensive rate
        # we know so the circuit breaker stays conservative.
        rate = max(_PRICE_PER_SECOND_USD.values())
    return round(rate * float(duration_s), 4)


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class VeoError(RuntimeError):
    """Base — any failure that should trigger the AI_VIDEO_HERO regen-without-
    AI-video fallback path in automation_pipeline."""


class VeoSubmitError(VeoError):
    """HTTP error on submit (4xx/5xx). Includes status code + body excerpt."""
    def __init__(self, status_code: int, body: str):
        super().__init__(f"Veo submit failed: HTTP {status_code} — {body[:300]}")
        self.status_code = status_code
        self.body = body


class VeoPollError(VeoError):
    """HTTP error during polling. Submit succeeded but status fetch failed."""


class VeoSafetyBlocked(VeoError):
    """Model rejected the prompt for safety reasons. `auto_fix` (when on) tries
    to rewrite the prompt; if it still fails this is raised. Caller should
    fall back to a non-AI shot type rather than retry."""


class VeoQuotaExceeded(VeoError):
    """fal.ai returned 429 — backoff / circuit-break the pipeline."""


class VeoTimeout(VeoError):
    """Job didn't reach COMPLETED within the deadline."""


class VeoMalformedResponse(VeoError):
    """Veo reported COMPLETED but the response payload lacked a video URL we
    could extract. The pipeline treats this as a soft failure (fallback path)
    rather than crashing — the `raw` payload is logged for diagnosis."""


# ---------------------------------------------------------------------------
# Dataclasses
# ---------------------------------------------------------------------------

@dataclass
class VeoSubmission:
    """Outcome of a successful Veo submit."""
    request_id: str
    status_url: str
    response_url: Optional[str] = None


@dataclass
class VeoResult:
    """Final result of one Veo call. Always populated when no exception
    raised; on exception, the caller never sees this."""
    request_id: str
    video_url: str
    duration_s: int
    resolution: str
    aspect_ratio: str
    audio_on: bool
    cost_usd: float
    elapsed_s: float
    endpoint: str
    raw_response: Dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

class FalVeoClient:
    """Sync-callable Veo client (uses async internally via asyncio.run).

    Mirrors `FalAvatarClient`'s queue submit-poll pattern. Holds the API key
    and a few tunable knobs; safe to construct once per pipeline run.
    """

    def __init__(
        self,
        api_key: str,
        *,
        render_deadline_s: float = _DEFAULT_RENDER_DEADLINE_S,
        poll_interval_s: float = _DEFAULT_POLL_INTERVAL_S,
        submit_timeout_s: float = _DEFAULT_SUBMIT_TIMEOUT_S,
        poll_timeout_s: float = _DEFAULT_POLL_TIMEOUT_S,
    ):
        if not api_key:
            raise ValueError("FalVeoClient requires a non-empty api_key (set FAL_API_KEY).")
        self._api_key = api_key
        self._render_deadline_s = float(render_deadline_s)
        self._poll_interval_s = float(poll_interval_s)
        self._submit_timeout_s = float(submit_timeout_s)
        self._poll_timeout_s = float(poll_timeout_s)

    @property
    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Key {self._api_key}",
            "Content-Type": "application/json",
        }

    # ------------------------------------------------------------------
    # Public sync API — what automation_pipeline calls
    # ------------------------------------------------------------------

    def generate_text_to_video(
        self,
        *,
        prompt: str,
        duration_s: int = 8,
        aspect_ratio: str = "16:9",
        resolution: str = "720p",
        generate_audio: bool = False,
        negative_prompt: Optional[str] = None,
        seed: Optional[int] = None,
        auto_fix: bool = True,
        safety_tolerance: str = "3",
    ) -> VeoResult:
        """Text-to-video: one Veo call, returns the result.

        Blocking call (up to `render_deadline_s` total). Raises a typed
        VeoError subclass on any failure — the caller's job to map that to
        the AI_VIDEO_HERO fallback path.
        """
        payload = _build_text_to_video_payload(
            prompt=prompt,
            duration_s=duration_s,
            aspect_ratio=aspect_ratio,
            resolution=resolution,
            generate_audio=generate_audio,
            negative_prompt=negative_prompt,
            seed=seed,
            auto_fix=auto_fix,
            safety_tolerance=safety_tolerance,
        )
        return self._run_sync(
            endpoint=_TEXT_TO_VIDEO_ENDPOINT,
            payload=payload,
            duration_s=duration_s,
            resolution=resolution,
            aspect_ratio=aspect_ratio,
            audio_on=bool(generate_audio),
        )

    def generate_image_to_video(
        self,
        *,
        prompt: str,
        image_url: str,
        duration_s: int = 8,
        aspect_ratio: str = "16:9",
        resolution: str = "720p",
        generate_audio: bool = False,
        negative_prompt: Optional[str] = None,
        seed: Optional[int] = None,
        auto_fix: bool = True,
        safety_tolerance: str = "3",
    ) -> VeoResult:
        """Image-to-video: animates `image_url` per `prompt`. Used by Phase 4
        for shot chaining (ffmpeg-extracted last frame of segment N becomes
        the image_url for segment N+1, preserving character/scene continuity).

        Scaffolded in Phase 3, exercised in Phase 4 when chaining ships.
        """
        if not image_url or not str(image_url).strip():
            raise ValueError("generate_image_to_video requires non-empty image_url")
        payload = _build_image_to_video_payload(
            prompt=prompt,
            image_url=image_url,
            duration_s=duration_s,
            aspect_ratio=aspect_ratio,
            resolution=resolution,
            generate_audio=generate_audio,
            negative_prompt=negative_prompt,
            seed=seed,
            auto_fix=auto_fix,
            safety_tolerance=safety_tolerance,
        )
        return self._run_sync(
            endpoint=_IMAGE_TO_VIDEO_ENDPOINT,
            payload=payload,
            duration_s=duration_s,
            resolution=resolution,
            aspect_ratio=aspect_ratio,
            audio_on=bool(generate_audio),
        )

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _run_sync(
        self,
        *,
        endpoint: str,
        payload: Dict[str, Any],
        duration_s: int,
        resolution: str,
        aspect_ratio: str,
        audio_on: bool,
    ) -> VeoResult:
        """Drive one submit-then-poll cycle synchronously."""
        t0 = time.time()
        # Single short-lived event loop per call — matches how
        # `_run_avatar_batch_sync` invokes the fal avatar client from
        # automation_pipeline's thread pool.
        try:
            submission = asyncio.run(self._submit(endpoint, payload))
            final_payload = asyncio.run(self._wait_for_result(submission))
        except VeoError:
            raise
        except httpx.HTTPStatusError as e:
            # Defensive — _submit/_wait_for_result should already wrap these,
            # but if a new error path slips through we still want a typed
            # exception, not a raw httpx leak.
            sc = e.response.status_code if e.response is not None else 0
            body = e.response.text[:500] if e.response is not None else ""
            if sc == 429:
                raise VeoQuotaExceeded(f"fal.ai 429 (quota): {body}") from e
            raise VeoSubmitError(sc, body) from e
        elapsed = time.time() - t0
        video_url = _extract_video_url(final_payload)
        if not video_url:
            raise VeoMalformedResponse(
                f"Veo completed but no video URL found in payload. "
                f"Keys: {list(final_payload.keys()) if isinstance(final_payload, dict) else type(final_payload).__name__}"
            )
        cost = price_per_call_usd(resolution=resolution, duration_s=duration_s, audio_on=audio_on)
        return VeoResult(
            request_id=submission.request_id,
            video_url=video_url,
            duration_s=duration_s,
            resolution=resolution,
            aspect_ratio=aspect_ratio,
            audio_on=audio_on,
            cost_usd=cost,
            elapsed_s=round(elapsed, 2),
            endpoint=endpoint,
            raw_response=final_payload if isinstance(final_payload, dict) else {},
        )

    async def _submit(self, endpoint: str, payload: Dict[str, Any]) -> VeoSubmission:
        url = f"{_FAL_QUEUE_BASE}/{endpoint}"
        async with httpx.AsyncClient(timeout=self._submit_timeout_s) as client:
            resp = await client.post(url, headers=self._headers, json=payload)
            if resp.status_code == 429:
                raise VeoQuotaExceeded(f"fal.ai returned 429 on submit: {resp.text[:300]}")
            if resp.status_code >= 400:
                # Heuristic: detect safety blocks from the response body so the
                # caller can dispatch on a typed exception. fal.ai's exact error
                # strings vary by model; this catches the common phrasings.
                body = resp.text or ""
                if _looks_like_safety_block(body):
                    raise VeoSafetyBlocked(f"Veo rejected prompt: {body[:300]}")
                raise VeoSubmitError(resp.status_code, body)
            data = resp.json()
        request_id = data.get("request_id") or data.get("id")
        status_url = data.get("status_url")
        response_url = data.get("response_url")
        if not request_id or not status_url:
            raise VeoMalformedResponse(
                f"Veo submit returned unexpected payload (no request_id/status_url): {data!r}"
            )
        return VeoSubmission(
            request_id=str(request_id),
            status_url=str(status_url),
            response_url=str(response_url) if response_url else None,
        )

    async def _wait_for_result(self, submission: VeoSubmission) -> Dict[str, Any]:
        deadline = time.time() + self._render_deadline_s
        async with httpx.AsyncClient(timeout=self._poll_timeout_s) as client:
            while time.time() < deadline:
                try:
                    resp = await client.get(submission.status_url, headers=self._headers)
                except httpx.HTTPError as e:
                    raise VeoPollError(f"Veo poll HTTP error: {e}") from e
                if resp.status_code >= 500:
                    # Transient — keep polling, but log
                    logger.warning(f"[Veo] poll returned {resp.status_code}; retrying after {self._poll_interval_s}s")
                    await asyncio.sleep(self._poll_interval_s)
                    continue
                if resp.status_code == 429:
                    raise VeoQuotaExceeded(f"Veo poll returned 429: {resp.text[:300]}")
                if resp.status_code >= 400:
                    raise VeoPollError(f"Veo poll HTTP {resp.status_code}: {resp.text[:300]}")
                status_payload = resp.json()
                status = (status_payload.get("status") or "").upper()
                if status in ("COMPLETED", "OK", "SUCCESS"):
                    inline_url = _extract_video_url(status_payload)
                    if inline_url:
                        return status_payload
                    target = submission.response_url or submission.status_url.replace("/status", "")
                    final = await client.get(target, headers=self._headers)
                    if final.status_code >= 400:
                        raise VeoPollError(f"Veo response fetch HTTP {final.status_code}: {final.text[:300]}")
                    return final.json()
                if status in ("FAILED", "ERROR", "CANCELLED"):
                    err = status_payload.get("error") or status_payload.get("message") or "unknown"
                    if _looks_like_safety_block(str(err)):
                        raise VeoSafetyBlocked(f"Veo job failed with safety block: {err}")
                    raise VeoError(f"Veo job failed: {err}")
                await asyncio.sleep(self._poll_interval_s)
        raise VeoTimeout(
            f"Veo job did not complete within {self._render_deadline_s:.0f}s "
            f"(request_id={submission.request_id})"
        )


# ---------------------------------------------------------------------------
# Payload builders & helpers (pure, no I/O — testable in isolation)
# ---------------------------------------------------------------------------

def _validate_common(
    *,
    prompt: str,
    duration_s: int,
    aspect_ratio: str,
    resolution: str,
    safety_tolerance: str,
) -> None:
    if not prompt or not str(prompt).strip():
        raise ValueError("Veo requires a non-empty prompt")
    if int(duration_s) not in ALLOWED_DURATIONS_S:
        raise ValueError(f"duration_s must be one of {ALLOWED_DURATIONS_S}, got {duration_s!r}")
    if aspect_ratio not in ALLOWED_ASPECT_RATIOS:
        raise ValueError(f"aspect_ratio must be one of {ALLOWED_ASPECT_RATIOS}, got {aspect_ratio!r}")
    if resolution not in ALLOWED_RESOLUTIONS:
        raise ValueError(f"resolution must be one of {ALLOWED_RESOLUTIONS}, got {resolution!r}")
    if str(safety_tolerance) not in ALLOWED_SAFETY_TOLERANCES:
        raise ValueError(f"safety_tolerance must be one of {ALLOWED_SAFETY_TOLERANCES}, got {safety_tolerance!r}")


def _build_text_to_video_payload(
    *,
    prompt: str,
    duration_s: int,
    aspect_ratio: str,
    resolution: str,
    generate_audio: bool,
    negative_prompt: Optional[str],
    seed: Optional[int],
    auto_fix: bool,
    safety_tolerance: str,
) -> Dict[str, Any]:
    _validate_common(prompt=prompt, duration_s=duration_s, aspect_ratio=aspect_ratio,
                     resolution=resolution, safety_tolerance=safety_tolerance)
    body: Dict[str, Any] = {
        "prompt": prompt.strip(),
        "duration": f"{int(duration_s)}s",
        "aspect_ratio": aspect_ratio,
        "resolution": resolution,
        "generate_audio": bool(generate_audio),
        "auto_fix": bool(auto_fix),
        "safety_tolerance": str(safety_tolerance),
    }
    if negative_prompt:
        body["negative_prompt"] = str(negative_prompt).strip()
    if seed is not None:
        body["seed"] = int(seed)
    return body


def _build_image_to_video_payload(
    *,
    prompt: str,
    image_url: str,
    duration_s: int,
    aspect_ratio: str,
    resolution: str,
    generate_audio: bool,
    negative_prompt: Optional[str],
    seed: Optional[int],
    auto_fix: bool,
    safety_tolerance: str,
) -> Dict[str, Any]:
    body = _build_text_to_video_payload(
        prompt=prompt,
        duration_s=duration_s,
        aspect_ratio=aspect_ratio,
        resolution=resolution,
        generate_audio=generate_audio,
        negative_prompt=negative_prompt,
        seed=seed,
        auto_fix=auto_fix,
        safety_tolerance=safety_tolerance,
    )
    body["image_url"] = str(image_url).strip()
    return body


def _extract_video_url(payload: Any) -> Optional[str]:
    """Locate the video URL in a Veo response. Tries several shapes:
      - {video: {url: ...}}            ← documented
      - {output: {video: {url: ...}}}  ← seen on some fal models
      - {video_url: ...}               ← defensive fallback
    Returns None if no recognizable shape matches.
    """
    if not isinstance(payload, dict):
        return None
    # Shape 1: {video: {url}}
    v = payload.get("video")
    if isinstance(v, dict):
        url = v.get("url")
        if isinstance(url, str) and url:
            return url
    # Shape 2: {output: {video: {url}}}
    out = payload.get("output")
    if isinstance(out, dict):
        ov = out.get("video")
        if isinstance(ov, dict):
            url = ov.get("url")
            if isinstance(url, str) and url:
                return url
    # Shape 3: {video_url}
    direct = payload.get("video_url")
    if isinstance(direct, str) and direct:
        return direct
    return None


# Heuristic safety-block detector — fal.ai's error strings aren't standardized
# across models. These substrings are the ones we've seen in practice (Veo,
# Kling) and from fal docs. Add more as new error phrasings turn up.
_SAFETY_BLOCK_SIGNALS = (
    "safety", "moderation", "policy violation", "prohibited",
    "not allowed", "harmful", "inappropriate", "blocked",
)


def _looks_like_safety_block(text: str) -> bool:
    """Return True if `text` reads like a content-moderation rejection.

    Conservative on false positives — only the specific signals above match;
    we'd rather classify some safety blocks as generic errors than
    misclassify a network glitch as a safety block (the former retries via
    fallback regen; the latter retries the same call, wasting cost).
    """
    if not text:
        return False
    lowered = text.lower()
    return any(sig in lowered for sig in _SAFETY_BLOCK_SIGNALS)


# ---------------------------------------------------------------------------
# Environment helper
# ---------------------------------------------------------------------------

def get_fal_api_key_from_env() -> Optional[str]:
    """Resolve the fal.ai API key from environment.

    Honors `FAL_KEY` (the canonical fal.ai env var name) AND `FAL_API_KEY`
    (the legacy variant used elsewhere in this codebase). Returns None if
    neither is set so the caller can degrade gracefully.
    """
    for key in ("FAL_KEY", "FAL_API_KEY"):
        v = os.environ.get(key)
        if v and v.strip():
            return v.strip()
    return None
