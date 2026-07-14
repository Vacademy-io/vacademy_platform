"""fal.ai Gemini Omni Flash client — reference-to-video, SELF-VOICED.

The cheaper alternative to Seedance 2.0 for DIALOGUE_SCENE clips
(~$0.13/s of 720p output vs Seedance's $0.3034/s). The critical trade-off:
Omni has NO audio input — it cannot lip-sync to our per-character TTS, so
there is no voice lock. Instead the model SPEAKS the dialogue lines itself
(prompt-driven), inventing a voice per clip. Character voice may drift
between scenes/videos; faces stay consistent via reference images.

Reference syntax differs from Seedance: images are bound with inline
<IMAGE_REF_0>..<IMAGE_REF_N> tags (ZERO-indexed), not @Image1..N.

Endpoint: POST https://queue.fal.run/google/gemini-omni-flash/reference-to-video
Contract per https://fal.ai/models/google/gemini-omni-flash/reference-to-video/llms.txt
(prompt + image_urls required; duration 3..10 int seconds, default 8;
aspect_ratio 16:9|9:16; output = single muxed video with generated speech,
music and SFX; token-priced ≈ $0.13 per second of 720p output).

Reuses FalVeoClient's queue submit→poll machinery + typed VeoError taxonomy —
callers keep their existing `except VeoError` branches.
"""
from __future__ import annotations

from typing import Any, Dict, List

from .fal_veo_client import FalVeoClient, VeoResult

_REFERENCE_TO_VIDEO_ENDPOINT = "google/gemini-omni-flash/reference-to-video"

# Token-priced upstream ($1.875/M in, $21.875/M out); fal's own docs peg the
# effective rate at ~$0.13 per second of 720p output. We meter per-second like
# Seedance so both models share one budget/ledger discipline.
_PRICE_PER_S = 0.13


def omni_price_per_call_usd(*, duration_s: int) -> float:
    """Expected cost of one Omni reference-to-video call (720p effective rate)."""
    return round(_PRICE_PER_S * max(1, int(duration_s)), 4)


def clamp_omni_duration_s(value: Any, default: int = 8) -> int:
    """Omni accepts 3..10 integer seconds. Clamp, don't snap."""
    try:
        v = int(round(float(value)))
    except (TypeError, ValueError):
        return default
    return max(3, min(10, v))


class FalOmniClient(FalVeoClient):
    """Gemini Omni Flash on the shared fal queue plumbing.

    Inherits submit/poll/typed-error handling from FalVeoClient; only the
    endpoint + payload shape differ. `VeoResult.cost_usd` is filled with the
    Omni per-second rate by the caller-facing method below.
    """

    def generate_reference_to_video(
        self,
        *,
        prompt: str,
        image_urls: List[str],
        duration_s: int = 8,
        aspect_ratio: str = "16:9",
    ) -> VeoResult:
        """One Omni reference-to-video call. Blocking; raises VeoError
        subclasses on failure (same taxonomy as the Veo/Seedance clients).

        `image_urls[i]` must be referenced in the prompt as <IMAGE_REF_i>
        (zero-indexed). No audio input exists — dialogue to be spoken goes
        in the prompt text and the model voices it itself.
        """
        if not prompt or not prompt.strip():
            raise ValueError("generate_reference_to_video requires a non-empty prompt")
        if not image_urls:
            raise ValueError("generate_reference_to_video requires at least one reference image")
        duration_s = clamp_omni_duration_s(duration_s)
        payload: Dict[str, Any] = {
            "prompt": prompt.strip(),
            "image_urls": [str(u) for u in image_urls[:9]],
            "duration": duration_s,
            "aspect_ratio": aspect_ratio if aspect_ratio in ("16:9", "9:16") else "16:9",
        }
        result = self._run_sync(
            endpoint=_REFERENCE_TO_VIDEO_ENDPOINT,
            payload=payload,
            duration_s=duration_s,
            resolution="720p",
            aspect_ratio=aspect_ratio,
            audio_on=True,
        )
        # _run_sync prices with the Veo table; overwrite with the Omni rate.
        try:
            result.cost_usd = omni_price_per_call_usd(duration_s=duration_s)
        except Exception:
            pass
        return result
