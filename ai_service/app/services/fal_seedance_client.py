"""fal.ai Seedance 2.0 client — reference-to-video with AUDIO INPUT.

The one major video model (mid-2026) that accepts our TTS as input:
`audio_urls` (≤3 clips, ≤15s combined, MP3 most reliable) referenced in the
prompt as @Audio1..3 — the model lip-syncs on-screen characters to those
lines while still generating its own SFX/ambience. This is the voice-lock
that makes the DIALOGUE_SCENE (storybook/drama) mode's characters speak in
OUR deterministic TTS voices instead of a per-clip invented voice.

Also supports up to 9 reference images (@Image1..9) for character/setting
consistency across independently generated clips.

Endpoint: POST https://queue.fal.run/bytedance/seedance-2.0/reference-to-video
Contract verified against https://fal.ai/models/bytedance/seedance-2.0/reference-to-video/llms.txt
(duration "4".."15" or "auto"; resolution 480p|720p|1080p|4k; aspect auto/16:9/9:16/…;
generate_audio default true — same price either way; output = muxed video + seed).

Reuses FalVeoClient's queue submit→poll machinery + typed VeoError taxonomy —
callers keep their existing `except VeoError` branches.
"""
from __future__ import annotations

from typing import Any, Dict, List, Optional

from .fal_veo_client import FalVeoClient, VeoResult

_REFERENCE_TO_VIDEO_ENDPOINT = "bytedance/seedance-2.0/reference-to-video"
# i2v: `image_url` IS the first frame (not an approximated reference) →
# mathematically seamless continuation from a previous clip's last frame.
# Contract per fal llms.txt: image_url required, optional end_image_url,
# duration auto|4-15, 480p-4k, generate_audio — but NO audio input, so
# lip-sync to our TTS is impossible here: SILENT scenes only.
_IMAGE_TO_VIDEO_ENDPOINT = "bytedance/seedance-2.0/image-to-video"

# Verified pricing (fal llms.txt): $0.3034/s at 720p, $0.682/s at 1080p.
# 480p scales by the token formula (~area-proportional); audio on/off does
# NOT change the price. Video refs multiply by 0.6 (unused here — we pass
# image + audio refs only).
_PRICE_PER_S_BY_RES = {
    "480p": 0.135,
    "720p": 0.3034,
    "1080p": 0.682,
}


def seedance_price_per_call_usd(*, resolution: str, duration_s: int) -> float:
    """Expected cost of one reference-to-video call (audio-neutral)."""
    rate = _PRICE_PER_S_BY_RES.get((resolution or "720p").lower(), _PRICE_PER_S_BY_RES["720p"])
    return round(rate * max(1, int(duration_s)), 4)


def clamp_seedance_duration_s(value: Any, default: int = 8) -> int:
    """Seedance accepts 4..15 seconds (string). Clamp, don't snap — unlike
    Veo's fixed 4/6/8 grid, any integer in range is valid."""
    try:
        v = int(round(float(value)))
    except (TypeError, ValueError):
        return default
    return max(4, min(15, v))


class FalSeedanceClient(FalVeoClient):
    """Seedance 2.0 on the shared fal queue plumbing.

    Inherits submit/poll/typed-error handling from FalVeoClient; only the
    endpoint + payload shape differ. `VeoResult.cost_usd` is filled with the
    Seedance rate by the caller-facing method below.
    """

    def generate_reference_to_video(
        self,
        *,
        prompt: str,
        image_urls: List[str],
        audio_urls: Optional[List[str]] = None,
        duration_s: int = 8,
        aspect_ratio: str = "16:9",
        resolution: str = "720p",
        generate_audio: bool = True,
    ) -> VeoResult:
        """One Seedance reference-to-video call. Blocking; raises VeoError
        subclasses on failure (same taxonomy as the Veo client).

        `image_urls` are referenced in the prompt as @Image1..N (order
        preserved); `audio_urls` as @Audio1..N. Per the schema, when audio
        is provided at least one image or video reference is REQUIRED —
        callers must pass a non-empty image_urls when feeding dialogue.
        """
        if not prompt or not prompt.strip():
            raise ValueError("generate_reference_to_video requires a non-empty prompt")
        if not image_urls:
            raise ValueError(
                "generate_reference_to_video requires at least one reference image "
                "(mandatory when audio_urls are provided)"
            )
        duration_s = clamp_seedance_duration_s(duration_s)
        payload: Dict[str, Any] = {
            "prompt": prompt.strip(),
            "image_urls": [str(u) for u in image_urls[:9]],
            "resolution": resolution,
            "duration": str(duration_s),
            "aspect_ratio": aspect_ratio,
            "generate_audio": bool(generate_audio),
        }
        if audio_urls:
            payload["audio_urls"] = [str(u) for u in audio_urls[:3]]
        result = self._run_sync(
            endpoint=_REFERENCE_TO_VIDEO_ENDPOINT,
            payload=payload,
            duration_s=duration_s,
            resolution=resolution,
            aspect_ratio=aspect_ratio,
            audio_on=bool(generate_audio),
        )
        # _run_sync prices with the Veo table; overwrite with the Seedance rate.
        try:
            result.cost_usd = seedance_price_per_call_usd(
                resolution=resolution, duration_s=duration_s
            )
        except Exception:
            pass
        return result

    def generate_image_to_video(
        self,
        *,
        prompt: str,
        image_url: str,
        end_image_url: Optional[str] = None,
        duration_s: int = 8,
        aspect_ratio: str = "16:9",
        resolution: str = "720p",
        generate_audio: bool = True,
    ) -> VeoResult:
        """Seedance 2.0 image-to-video: `image_url` becomes the LITERAL first
        frame — the only way to get a frame-perfect continuation from a
        previous clip's last frame (reference-to-video only approximates).

        No audio input exists on this endpoint, so callers must use it for
        SILENT scenes only — a speaking scene routed here would lose the
        TTS lip-sync voice lock. Same pricing/queue/error taxonomy as the
        reference path.
        """
        if not prompt or not prompt.strip():
            raise ValueError("generate_image_to_video requires a non-empty prompt")
        if not image_url:
            raise ValueError("generate_image_to_video requires image_url (the start frame)")
        duration_s = clamp_seedance_duration_s(duration_s)
        payload: Dict[str, Any] = {
            "prompt": prompt.strip(),
            "image_url": str(image_url),
            "resolution": resolution,
            "duration": str(duration_s),
            "aspect_ratio": aspect_ratio,
            "generate_audio": bool(generate_audio),
        }
        if end_image_url:
            payload["end_image_url"] = str(end_image_url)
        result = self._run_sync(
            endpoint=_IMAGE_TO_VIDEO_ENDPOINT,
            payload=payload,
            duration_s=duration_s,
            resolution=resolution,
            aspect_ratio=aspect_ratio,
            audio_on=bool(generate_audio),
        )
        try:
            result.cost_usd = seedance_price_per_call_usd(
                resolution=resolution, duration_s=duration_s
            )
        except Exception:
            pass
        return result
