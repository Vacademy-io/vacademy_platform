"""
fal.ai client for per-shot host-avatar talking-head video generation.

Used by `automation_pipeline._run_avatar_batch` during the HTML stage when
`request.host.type == "avatar"`. Supported endpoints, dispatched by
`provider`:

  Custom (image + audio → video — needs Seedream-generated host image upstream):
    • fal-ai/flashtalk                           ($0.0200 / sec, fastest/cheapest, fixed 768x448)
    • fal-ai/kling-video/ai-avatar/v2/standard  ($0.0562 / sec, default)
    • veed/fabric-1.0                            ($0.0800 / sec)
    • fal-ai/heygen/avatar4/image-to-video       ($0.1000 / sec, supports aspect ratio)
    • fal-ai/kling-video/ai-avatar/v2/pro        ($0.1150 / sec, highest fidelity)
    • fal-ai/ltx-2.3-quality/audio-to-video      (priced PER-MEGAPIXEL, ~$0.024/sec @480p·24fps;
                                                 general audio-driven gen, NOT dedicated lip-sync;
                                                 host image is the OPTIONAL initial frame; tunable fps)
    • bytedance/seedance-2.0/reference-to-video  ($0.3034/sec @720p; reference image(s) + driving
                                                 audio as LISTS; native audio + camera control;
                                                 ≤15s audio cap; no fps param)

  Built-in catalog (enum + audio → video — no Seedream, no face image):
    • argil/avatars/audio-to-video               ($0.02  / input-sec)
    • veed/avatars/audio-to-video                ($0.005 / sec)

This is the *async + bounded-concurrency* path purpose-built for batch
per-shot generation. The legacy sync `FalAvatarProvider` in avatar_service.py
remains for the older single-PiP avatar flow.

Per-shot lifecycle:
  1. submit(provider, model, image_url|external_avatar_id, audio_url, quality)
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
import os
import subprocess
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
# Per-model audio duration caps (PR 1)
# ---------------------------------------------------------------------------
# fal.ai rejects oversize audio with a moderation_error on submit. Each model
# has its own ceiling and they are NOT documented in any one place — values
# below are confirmed empirically (Kling v2 standard rejected at 63.7s with
# "exceeds maximum allowed duration of 40s" on prod run output(24).mp4) or
# from fal's per-model docs.
#
# Models not in the table get cap=0.0 → no preflight enforcement (fal stays
# the gate). Add entries here as we wire new models.
MODEL_AUDIO_CAP_S: Dict[str, float] = {
    "fal-ai/kling-video/ai-avatar/v2/standard": 40.0,
    "fal-ai/kling-video/ai-avatar/v2/pro":      40.0,
    "veed/fabric-1.0":                          60.0,
    # Seedance accepts ≤15s combined reference audio (hard fal limit).
    "bytedance/seedance-2.0/reference-to-video": 15.0,
}
# Subtract from the model cap before enforcing. fal's gate is inclusive and
# slight ffprobe/encoder rounding (≤ 0.5s) has burned us before.
AUDIO_CAP_SAFETY_MARGIN_S: float = 2.0


def get_audio_cap_s(model_id: str) -> float:
    """Effective audio cap for `model_id` (incl. safety margin), or 0.0 if unknown.

    0.0 means "no preflight enforcement" — let fal be the gate. Callers
    should treat 0.0 as a signal to skip the preflight, not as "cap=0".
    """
    raw = MODEL_AUDIO_CAP_S.get(model_id, 0.0)
    if raw <= 0:
        return 0.0
    return max(0.0, raw - AUDIO_CAP_SAFETY_MARGIN_S)


def _ffprobe_duration_s(audio_url: str, *, timeout_s: float = 15.0) -> Optional[float]:
    """Return audio duration in seconds via ffprobe, or None if probe fails.

    Fail-soft by design: if ffprobe is missing, the URL is unreachable, or
    parsing fails, we return None and let fal be the gate. We never want the
    preflight itself to be a new failure source.

    Honors `FFPROBE_PATH` env var (mirrors how automation_pipeline finds
    ffmpeg via FFMPEG_PATH).
    """
    ffprobe_path = os.environ.get("FFPROBE_PATH") or "ffprobe"
    cmd = [
        ffprobe_path,
        "-v", "error",
        "-show_entries", "format=duration",
        "-of", "default=noprint_wrappers=1:nokey=1",
        audio_url,
    ]
    try:
        r = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_s)
    except (subprocess.TimeoutExpired, FileNotFoundError, OSError) as e:
        logger.warning(f"[FalAvatar] ffprobe preflight unavailable ({e}) — skipping cap check")
        return None
    if r.returncode != 0:
        logger.warning(
            f"[FalAvatar] ffprobe returned {r.returncode} for {audio_url} — "
            f"skipping cap check (stderr: {(r.stderr or '').strip()[:200]})"
        )
        return None
    try:
        return float(r.stdout.strip())
    except (ValueError, AttributeError):
        return None


class AudioCapExceeded(RuntimeError):
    """Raised by submit() when audio duration would trip the model's fal cap.

    Carries structured fields so the caller (AvatarBatch) can distinguish this
    from a submit-time HTTP/network failure and handle it deterministically
    (split the run further, fall back to host_present=false, etc.) without
    parsing error strings.
    """
    def __init__(self, *, model: str, audio_duration_s: float, cap_s: float):
        self.model = model
        self.audio_duration_s = float(audio_duration_s)
        self.cap_s = float(cap_s)
        super().__init__(
            f"Audio duration {self.audio_duration_s:.1f}s exceeds effective cap "
            f"{self.cap_s:.1f}s for model {model!r} (raw cap "
            f"{MODEL_AUDIO_CAP_S.get(model, 0.0):.1f}s minus "
            f"{AUDIO_CAP_SAFETY_MARGIN_S:.1f}s safety margin). "
            f"Pre-slice the audio before calling fal."
        )


# ---------------------------------------------------------------------------
# Per-model payload adapters
# ---------------------------------------------------------------------------
# fal.ai's input schema differs per model. Centralising the per-model adapter
# means callers only pass canonical (image_url, audio_url, quality) and we
# translate to the model's actual field names.

def _build_payload(
    provider: str,
    model: str,
    image_url: str,
    audio_url: str,
    quality: str,
    details_prompt: str = "",
    external_avatar_id: Optional[str] = None,
    orientation: str = "landscape",
    fps: Optional[int] = None,
) -> Dict[str, Any]:
    """Map canonical inputs → model-specific fal.ai payload.

    `provider` selects the dispatch family:
      'custom' → image-conditioned (Kling / Fabric / HeyGen / FlashTalk)
      'argil'  → catalog enum (`avatar` field) + `audio_url: {url}` object
      'veed'   → catalog enum (`avatar_id` field) + `audio_url` plain string

    `orientation` ('landscape' | 'portrait') currently only feeds HeyGen's
    `aspect_ratio` field (16:9 vs 9:16). Other models ignore it — they either
    don't expose an aspect param (Kling, Fabric) or have a fixed output size
    (FlashTalk: 768x448).
    """
    if provider == "custom":
        if model == "fal-ai/kling-video/ai-avatar/v2/standard":
            # Kling v2 standard: image_url + audio_url + optional prompt + resolution.
            return {
                "image_url": image_url,
                "audio_url": audio_url,
                "prompt": (details_prompt or
                           "A person speaking naturally with subtle head movements."),
                "resolution": "720p" if quality == "720p" else "480p",
            }
        if model == "fal-ai/kling-video/ai-avatar/v2/pro":
            # Kling v2 pro: image_url + audio_url + optional prompt. No
            # resolution field in the schema — fal picks the output size.
            return {
                "image_url": image_url,
                "audio_url": audio_url,
                "prompt": (details_prompt or
                           "A person speaking naturally with subtle head movements."),
            }
        if model == "veed/fabric-1.0":
            # VEED Fabric 1.0: image-to-video talking avatar. Schema uses
            # `resolution` (same key as Kling), not `video_size`. No `prompt` field.
            return {
                "image_url": image_url,
                "audio_url": audio_url,
                "resolution": "720p" if quality == "720p" else "480p",
            }
        if model == "fal-ai/heygen/avatar4/image-to-video":
            # HeyGen Avatar 4: image_url + audio_url + optional prompt +
            # resolution (360p/480p/540p/720p/1080p) + aspect_ratio. We map
            # the canonical quality to the matching enum, and orientation
            # to aspect ratio so portrait videos don't get a letterboxed
            # 16:9 host clip.
            return {
                "image_url": image_url,
                "audio_url": audio_url,
                "prompt": (details_prompt or
                           "A person speaking naturally with subtle head movements."),
                "resolution": "720p" if quality == "720p" else "480p",
                "aspect_ratio": "9:16" if orientation == "portrait" else "16:9",
            }
        if model == "fal-ai/flashtalk":
            # FlashTalk: image_url + audio_url only. Fixed 768x448 output —
            # the `resolution` and `prompt` fields don't exist on this model,
            # so they're intentionally omitted (sending them throws a 422).
            return {
                "image_url": image_url,
                "audio_url": audio_url,
            }
        if model == "fal-ai/ltx-2.3-quality/audio-to-video":
            # LTX 2.3 audio-to-video. Unlike the dedicated lip-sync avatars
            # above, this is a GENERAL audio-driven generator: audio_url +
            # prompt (+ optional initial frame). No `loras` field on this
            # (non-LoRA) endpoint.
            #   • `match_audio_length` keys the clip length off the narration.
            #     fal caps num_frames at 481, so a single audio slice longer
            #     than ~481/fps s (≈20s @ 24fps) will be rejected by fal.
            #   • `generate_audio` keeps the driving narration in the output mp4.
            #   • `resolution="auto"` sizes the output to the host image's
            #     aspect (so portrait/landscape follows the face image); the
            #     480p/720p `quality` field is not a valid LTX resolution enum,
            #     so it is intentionally NOT forwarded here.
            payload: Dict[str, Any] = {
                "audio_url": audio_url,
                "prompt": (details_prompt or
                           "A person speaking naturally with subtle head movements."),
                "match_audio_length": True,
                "generate_audio": True,
                "resolution": "auto",
            }
            if image_url:
                payload["image_url"] = image_url
                payload["image_strength"] = 0.7
            if fps:
                payload["frames_per_second"] = int(fps)
            return payload
        if model == "bytedance/seedance-2.0/reference-to-video":
            # Seedance 2.0 reference-to-video. Audio-capable generator: drives
            # motion from reference audio (up to 3 clips, ≤15s combined — see
            # MODEL_AUDIO_CAP_S) + up to 9 reference images. We pass the host
            # face as the single reference image and the per-shot narration
            # slice as the driving audio — both are LISTS here, unlike the
            # single-string fields the other models use.
            #   • resolution accepts 480p/720p/1080p — map the avatar quality
            #     (the picker exposes 480p/720p).
            #   • aspect_ratio follows the canvas orientation (avoid letterboxing).
            #   • duration="auto" lets the clip length follow the inputs.
            #   • generate_audio is left at the model default (true) so the audio
            #     natively drives the result; the pipeline overlays master
            #     narration as the final track regardless. No fps param exists.
            payload = {
                "prompt": (details_prompt or
                           "A person speaking naturally with subtle head movements."),
                "audio_urls": [audio_url],
                "resolution": "720p" if quality == "720p" else "480p",
                "aspect_ratio": "9:16" if orientation == "portrait" else "16:9",
                "duration": "auto",
            }
            if image_url:
                payload["image_urls"] = [image_url]
            return payload
        raise ValueError(f"Unsupported custom-avatar model: {model!r}")

    if provider == "argil":
        # Argil's audio_to_video catalog. Identity is locked to the enum.
        # `audio_url` is a plain string at the live endpoint — the llms.txt
        # example shows an `{url: …}` object, but fal's actual validator
        # rejects that with `"type": "string_type"`. Same shape as VEED.
        # `remove_background` defaults false (50% surcharge if true; we don't
        # surface that toggle in v1).
        if not external_avatar_id:
            raise ValueError("provider=argil requires external_avatar_id (catalog enum).")
        return {
            "avatar": external_avatar_id,
            "audio_url": audio_url,
            "remove_background": False,
        }

    if provider == "veed":
        # VEED Avatars audio_to_video catalog. `avatar_id` field name (vs Argil's
        # `avatar`); audio_url is a plain string here.
        if not external_avatar_id:
            raise ValueError("provider=veed requires external_avatar_id (catalog enum).")
        return {
            "avatar_id": external_avatar_id,
            "audio_url": audio_url,
        }

    raise ValueError(f"Unsupported avatar provider: {provider!r}")


def _resolve_endpoint_model(provider: str, model: str) -> str:
    """The fal.ai queue path slug for a given provider.

    For built-in catalog providers the endpoint is fixed; the caller-supplied
    `model` is informational only and not used in URL construction.
    """
    if provider == "argil":
        return "argil/avatars/audio-to-video"
    if provider == "veed":
        return "veed/avatars/audio-to-video"
    # provider == "custom": URL is the model id itself
    return model


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
        provider: str = "custom",
        external_avatar_id: Optional[str] = None,
        orientation: str = "landscape",
        fps: Optional[int] = None,
    ) -> FalSubmission:
        """POST /queue.fal.run/{endpoint} → {request_id, status_url}.

        For provider in {'argil','veed'}, the endpoint is the catalog audio-to-video
        path and `image_url` is ignored (identity comes from external_avatar_id).
        `orientation` only affects HeyGen (aspect_ratio); other models ignore it.
        """
        payload = _build_payload(
            provider=provider,
            model=model,
            image_url=image_url,
            audio_url=audio_url,
            quality=quality,
            details_prompt=details_prompt,
            external_avatar_id=external_avatar_id,
            orientation=orientation,
            fps=fps,
        )
        endpoint = _resolve_endpoint_model(provider, model)

        # Preflight: ffprobe the audio and reject before the fal call if it
        # would trip the model's documented cap. Saves a wasted submit and
        # gives the caller a typed exception (AudioCapExceeded) to dispatch
        # on instead of having to parse fal's moderation_error string. If the
        # model isn't in the cap table, get_audio_cap_s returns 0.0 and we
        # skip — fal stays the gate as before.
        cap_s = get_audio_cap_s(endpoint)
        if cap_s > 0 and audio_url:
            dur = _ffprobe_duration_s(audio_url)
            if dur is not None and dur > cap_s:
                raise AudioCapExceeded(
                    model=endpoint,
                    audio_duration_s=dur,
                    cap_s=cap_s,
                )

        url = f"{_FAL_QUEUE_BASE}/{endpoint}"
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
        provider: str = "custom",
        external_avatar_id: Optional[str] = None,
        orientation: str = "landscape",
        fps: Optional[int] = None,
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
                    provider=provider,
                    external_avatar_id=external_avatar_id,
                    orientation=orientation,
                    fps=fps,
                )
                result.fal_request_id = submission.request_id
            except AudioCapExceeded as e:
                # Preflight rejected this shot — never hit fal. Distinct from a
                # submit-time HTTP/network failure: the caller (AvatarBatch /
                # run-based renderer in PR 2) splits the run further or falls
                # back to host_present=false. Marking the stage explicitly lets
                # downstream code branch without parsing error strings.
                result.error = str(e)
                result.error_stage = "audio_cap"
                result.elapsed_s = time.time() - t0
                logger.warning(
                    f"[FalAvatar] shot={shot_index} preflight cap exceeded: "
                    f"{e.audio_duration_s:.1f}s > {e.cap_s:.1f}s ({e.model})"
                )
                return result
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
        provider: str = "custom",
        external_avatar_id: Optional[str] = None,
        orientation: str = "landscape",
        fps: Optional[int] = None,
    ) -> List[AvatarShotResult]:
        """Render N shots concurrently (bounded by the semaphore).

        `shots` is a list of dicts with keys:
            shot_index, image_url (custom only — empty string for built-ins), audio_url

        `provider`, `external_avatar_id`, and `orientation` apply to the whole
        batch — the run's host config picks one identity / canvas shape that's
        used across every host shot.
        """
        coros = [
            self.render_shot(
                shot_index=int(s["shot_index"]),
                model=model,
                image_url=str(s.get("image_url") or ""),
                audio_url=str(s["audio_url"]),
                quality=quality,
                details_prompt=details_prompt,
                provider=provider,
                external_avatar_id=external_avatar_id,
                orientation=orientation,
                fps=fps,
            )
            for s in shots
        ]
        return await asyncio.gather(*coros)
