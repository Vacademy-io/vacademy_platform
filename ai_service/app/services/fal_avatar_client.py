"""
fal.ai client for per-shot host-avatar talking-head video generation.

Used by `automation_pipeline._run_avatar_batch` during the HTML stage when
`request.host.type == "avatar"`. Two supported models:
  • fal-ai/kling-video/ai-avatar/v2/standard  ($0.0562 / sec, default)
  • veed/fabric-1.0                            ($0.0800 / sec)

This is the *async + bounded-concurrency* path purpose-built for batch
per-shot generation. The legacy sync `FalAvatarProvider` in avatar_service.py
remains for the older single-PiP avatar flow.

Per-shot lifecycle:
  1. submit(image_url, audio_url, model, quality)
       → POST https://queue.fal.run/{model}      → {request_id, status_url}
  2. wait_for_result(submission)                 → poll status_url until DONE
  3. result.video_url                            → final S3 / fal CDN URL

Failure mode: any single-shot exception is captured into AvatarShotResult.error;
the batch does NOT abort. Caller (AvatarBatch) decides per-shot fallback to
host_present=false.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import httpx

logger = logging.getLogger(__name__)


_FAL_QUEUE_BASE = "https://queue.fal.run"
_DEFAULT_SUBMIT_TIMEOUT_S = 30.0
_DEFAULT_POLL_TIMEOUT_S = 30.0
_DEFAULT_RENDER_DEADLINE_S = 600.0   # 10 min hard ceiling per shot
_DEFAULT_POLL_INTERVAL_S = 5.0
_DEFAULT_CONCURRENCY = 4


# ---------------------------------------------------------------------------
# Per-model payload adapters
# ---------------------------------------------------------------------------
# fal.ai's input schema differs per model. Centralising the per-model adapter
# means callers only pass canonical (image_url, audio_url, quality) and we
# translate to the model's actual field names.

def _build_payload(
    model: str,
    image_url: str,
    audio_url: str,
    quality: str,
    details_prompt: str = "",
) -> Dict[str, Any]:
    """Map canonical inputs → model-specific fal.ai payload."""
    if model == "fal-ai/kling-video/ai-avatar/v2/standard":
        # Kling v2 standard: image_url + audio_url + optional prompt + resolution.
        return {
            "image_url": image_url,
            "audio_url": audio_url,
            "prompt": (details_prompt or
                       "A person speaking naturally with subtle head movements."),
            "resolution": "720p" if quality == "720p" else "480p",
        }
    if model == "veed/fabric-1.0":
        # VEED Fabric 1.0: image-to-video talking avatar. Schema uses
        # `resolution` (same key as Kling), not `video_size`. No `prompt` field.
        return {
            "image_url": image_url,
            "audio_url": audio_url,
            "resolution": "720p" if quality == "720p" else "480p",
        }
    raise ValueError(f"Unsupported fal.ai avatar model: {model!r}")


def _extract_video_url(result_json: Dict[str, Any]) -> Optional[str]:
    """Pull the final mp4 URL out of fal.ai's result payload.

    Both Kling and VEED return either {"video": {"url": "..."}} at the top
    level OR a nested {"output": {"video": {"url": "..."}}} envelope. We try
    both shapes.
    """
    # Direct shape
    video = result_json.get("video") if isinstance(result_json, dict) else None
    if isinstance(video, dict) and isinstance(video.get("url"), str):
        return video["url"]
    # Nested shape
    output = result_json.get("output") if isinstance(result_json, dict) else None
    if isinstance(output, dict):
        v = output.get("video")
        if isinstance(v, dict) and isinstance(v.get("url"), str):
            return v["url"]
    return None


# ---------------------------------------------------------------------------
# Result dataclasses
# ---------------------------------------------------------------------------

@dataclass
class FalSubmission:
    """Outcome of a successful submit() call."""
    request_id: str
    status_url: str
    response_url: Optional[str] = None  # some fal models return this directly


@dataclass
class AvatarShotResult:
    """Outcome of a single per-shot avatar render. Always populated; check `.error`."""
    shot_index: int
    fal_request_id: Optional[str] = None
    video_url: Optional[str] = None
    duration_s: Optional[float] = None
    model: str = ""
    quality: str = ""
    error: Optional[str] = None
    error_stage: Optional[str] = None  # "submit" | "poll" | "fetch" | "timeout"
    elapsed_s: float = 0.0
    raw_result: Dict[str, Any] = field(default_factory=dict)


# ---------------------------------------------------------------------------
# Client
# ---------------------------------------------------------------------------

class FalAvatarClient:
    """Async batch client for fal.ai talking-head avatar generation."""

    def __init__(
        self,
        api_key: str,
        *,
        concurrency: int = _DEFAULT_CONCURRENCY,
        render_deadline_s: float = _DEFAULT_RENDER_DEADLINE_S,
        poll_interval_s: float = _DEFAULT_POLL_INTERVAL_S,
    ):
        if not api_key:
            raise ValueError("FalAvatarClient requires a non-empty api_key (set FAL_API_KEY).")
        self._api_key = api_key
        self._sema = asyncio.Semaphore(max(1, int(concurrency)))
        self._render_deadline_s = float(render_deadline_s)
        self._poll_interval_s = float(poll_interval_s)
        # First-success debug log: dumps the raw final-result payload of the
        # first shot that returns COMPLETED in this client's lifetime, so we
        # can verify the actual fal.ai response shape in production and
        # harden _extract_video_url if the schema differs from our two
        # known-good shapes ({video.url} and {output.video.url}).
        self._payload_logged: bool = False

    # ------------------------------------------------------------------
    # Single-shot primitives
    # ------------------------------------------------------------------

    @property
    def _headers(self) -> Dict[str, str]:
        return {
            "Authorization": f"Key {self._api_key}",
            "Content-Type": "application/json",
        }

    def _maybe_log_first_payload(self, payload: Dict[str, Any], *, source: str) -> None:
        """One-shot INFO log of fal.ai's raw result payload (truncated).

        Fires once per FalAvatarClient instance — i.e. once per video run, on the
        first shot that completes. Lets us verify the actual fal.ai response shape
        in prod without spamming logs. Safe to remove once we've confirmed the
        schema in `_extract_video_url` covers both supported models.
        """
        if self._payload_logged:
            return
        self._payload_logged = True
        try:
            dumped = json.dumps(payload, default=str, ensure_ascii=False)
        except Exception:
            dumped = repr(payload)
        if len(dumped) > 1500:
            dumped = dumped[:1500] + "…<truncated>"
        logger.info(f"[FalAvatar] raw result payload (source={source}): {dumped}")

    async def submit(
        self,
        *,
        model: str,
        image_url: str,
        audio_url: str,
        quality: str,
        details_prompt: str = "",
    ) -> FalSubmission:
        """POST /queue.fal.run/{model} → {request_id, status_url}."""
        payload = _build_payload(model, image_url, audio_url, quality, details_prompt)
        url = f"{_FAL_QUEUE_BASE}/{model}"
        async with httpx.AsyncClient(timeout=_DEFAULT_SUBMIT_TIMEOUT_S) as client:
            resp = await client.post(url, headers=self._headers, json=payload)
            resp.raise_for_status()
            data = resp.json()
        request_id = data.get("request_id") or data.get("id")
        status_url = data.get("status_url")
        response_url = data.get("response_url")
        if not request_id or not status_url:
            raise RuntimeError(
                f"fal.ai submit returned unexpected payload (missing request_id/status_url): {data!r}"
            )
        return FalSubmission(
            request_id=str(request_id),
            status_url=str(status_url),
            response_url=str(response_url) if response_url else None,
        )

    async def wait_for_result(self, submission: FalSubmission) -> Dict[str, Any]:
        """Poll status_url until COMPLETED, then fetch response_url. Raises on FAILED/timeout."""
        deadline = time.time() + self._render_deadline_s
        async with httpx.AsyncClient(timeout=_DEFAULT_POLL_TIMEOUT_S) as client:
            while time.time() < deadline:
                resp = await client.get(submission.status_url, headers=self._headers)
                resp.raise_for_status()
                status_payload = resp.json()
                status = (status_payload.get("status") or "").upper()
                if status in ("COMPLETED", "OK", "SUCCESS"):
                    # Some models return the result inline in the status payload;
                    # others require a follow-up GET on response_url.
                    inline_url = _extract_video_url(status_payload)
                    if inline_url:
                        self._maybe_log_first_payload(status_payload, source="status_inline")
                        return status_payload
                    target = submission.response_url or submission.status_url.replace(
                        "/status", ""
                    )
                    final = await client.get(target, headers=self._headers)
                    final.raise_for_status()
                    final_payload = final.json()
                    self._maybe_log_first_payload(final_payload, source="response_url")
                    return final_payload
                if status in ("FAILED", "ERROR", "CANCELLED"):
                    err = status_payload.get("error") or status_payload.get("message") or "unknown"
                    raise RuntimeError(f"fal.ai job failed: {err}")
                await asyncio.sleep(self._poll_interval_s)
        raise TimeoutError(
            f"fal.ai job did not complete within {self._render_deadline_s:.0f}s "
            f"(request_id={submission.request_id})"
        )

    # ------------------------------------------------------------------
    # Batch
    # ------------------------------------------------------------------

    async def render_shot(
        self,
        *,
        shot_index: int,
        model: str,
        image_url: str,
        audio_url: str,
        quality: str,
        details_prompt: str = "",
    ) -> AvatarShotResult:
        """Submit + poll a single shot under the bounded concurrency semaphore.

        Always returns a result; `.error` is populated on failure (caller decides
        whether to fall back to host_present=false for that shot).
        """
        result = AvatarShotResult(shot_index=shot_index, model=model, quality=quality)
        t0 = time.time()
        async with self._sema:
            try:
                submission = await self.submit(
                    model=model,
                    image_url=image_url,
                    audio_url=audio_url,
                    quality=quality,
                    details_prompt=details_prompt,
                )
                result.fal_request_id = submission.request_id
            except Exception as e:
                result.error = str(e)
                result.error_stage = "submit"
                result.elapsed_s = time.time() - t0
                logger.warning(f"[FalAvatar] shot={shot_index} submit failed: {e}")
                return result

            try:
                payload = await self.wait_for_result(submission)
                result.raw_result = payload if isinstance(payload, dict) else {}
                video_url = _extract_video_url(payload)
                if not video_url:
                    raise RuntimeError(f"fal.ai result missing video.url: {payload!r}")
                result.video_url = video_url
                # Some models echo a duration in the result; if so, surface it.
                duration = None
                output = payload.get("output") if isinstance(payload, dict) else None
                if isinstance(output, dict):
                    duration = output.get("duration") or output.get("duration_seconds")
                duration = duration or (
                    payload.get("video", {}).get("duration")
                    if isinstance(payload, dict) and isinstance(payload.get("video"), dict)
                    else None
                )
                if duration is not None:
                    try:
                        result.duration_s = float(duration)
                    except (TypeError, ValueError):
                        pass
            except TimeoutError as e:
                result.error = str(e)
                result.error_stage = "timeout"
                logger.warning(f"[FalAvatar] shot={shot_index} timed out: {e}")
            except Exception as e:
                result.error = str(e)
                result.error_stage = "poll"
                logger.warning(f"[FalAvatar] shot={shot_index} render failed: {e}")

        result.elapsed_s = time.time() - t0
        return result

    async def render_batch(
        self,
        shots: List[Dict[str, Any]],
        *,
        model: str,
        quality: str,
        details_prompt: str = "",
    ) -> List[AvatarShotResult]:
        """Render N shots concurrently (bounded by the semaphore).

        `shots` is a list of dicts with keys:
            shot_index, image_url, audio_url
        """
        coros = [
            self.render_shot(
                shot_index=int(s["shot_index"]),
                model=model,
                image_url=str(s["image_url"]),
                audio_url=str(s["audio_url"]),
                quality=quality,
                details_prompt=details_prompt,
            )
            for s in shots
        ]
        return await asyncio.gather(*coros)
