"""Generate fresh transition stingers via fal-ai/elevenlabs/sound-effects/v2.

Runs AFTER `sound_planner` has populated each entry's `sound_cues` list
with static-library transition_whoosh cues. This module's job:

  1. Pre-generate a small bank (3-5) of distinct fresh whoosh variants
     for THIS video, so consecutive transitions don't sound identical
     (which is the main artifact of the static library — same 159
     whoosh files reused across thousands of videos).

  2. Rotate the bank across the existing transition cue positions,
     replacing each cue's `url` with one of the freshly-generated S3
     URLs (uploaded by the caller pipeline).

  3. Skip silently when:
       - tier doesn't pay for fresh stingers
       - FAL_API_KEY isn't set
       - sound_planner emitted no transition cues
     In every skip case the static-library cues ship unchanged.

Why a separate module: sound_planner.py is already ~590 LOC of dense
cue-selection logic. Mixing fresh-generation, S3 upload, and cost
tracking into it would blow the file past readable. This is a strict
extension that operates on the planner's OUTPUT — never modifies the
planner itself.

Cost: ~6 generations × 0.5s each × $0.002/s ≈ $0.006 per video for
fresh stingers. Caps at FAL_STINGER_MAX_VARIANTS so a long video with
20 transitions doesn't multiply spend — variants cycle.
"""
from __future__ import annotations

import logging
import os
import random
import time
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Sequence

_log = logging.getLogger(__name__)


# Cap on how many distinct fresh stingers we generate per run. The mixer
# then rotates these across all transition cues so consecutive cuts
# don't sound identical. 5 variants gives perceptually-distinct cuts
# for videos up to ~20 shots while keeping cost predictable.
FAL_STINGER_MAX_VARIANTS = 5

# Default stinger duration. ElevenLabs sound-effects-v2 floors at 0.5s
# so we use that. Whooshes longer than 0.8s drag on cuts; shorter than
# 0.4s sound clicky.
DEFAULT_STINGER_DURATION_S = 0.55

# Rotation of stinger prompts. Each one targets a slightly different
# texture so variants don't all sound like the same sound. The mixer
# picks one per transition in order (then wraps around).
_STINGER_PROMPT_BANK: List[str] = [
    "Smooth cinematic whoosh, mid-frequency air movement, short and clean",
    "Subtle riser into a soft impact, warm tone, no high-frequency harshness",
    "Quick swoosh transition, airy, light reverb tail",
    "Brief tonal sweep, low-to-high, ascending pitch, energetic",
    "Soft transition hit, muted thud, no metallic ring",
    "Light breeze whoosh, naturally panning, brief duration",
]


def _resolve_role_url(cue: Dict[str, Any]) -> str:
    """Read the cue's URL — handles both legacy and current key names."""
    return (cue.get("url") or "").strip()


def _set_role_url(cue: Dict[str, Any], url: str) -> None:
    """Write back the URL to whichever key the cue uses."""
    cue["url"] = url


def enrich_transitions_with_fresh_stingers(
    entries: List[Dict[str, Any]],
    *,
    tier_config: Optional[Dict[str, Any]] = None,
    cost_tracker: Any = None,
    run_dir: Optional[Path] = None,
    s3_uploader: Optional[Callable[[bytes, str], str]] = None,
    video_id: str = "",
    max_variants: int = FAL_STINGER_MAX_VARIANTS,
    stinger_duration_s: float = DEFAULT_STINGER_DURATION_S,
    seed: Optional[int] = None,
) -> int:
    """Replace static transition_whoosh URLs with freshly-generated stingers.

    Returns the number of transition cues that got their URL replaced.
    Returns 0 silently when generation isn't applicable or fails (the
    static library cues remain in place).

    Args:
        entries: the entries list with `sound_cues` already populated
            by `sound_planner.plan_sound_cues`. Mutated in place.
        tier_config: optional dict for tier gating. When set and
            `transition_stingers_enabled` is False (or missing), this
            function no-ops. When None, defaults to ENABLED for callers
            that don't have a tier config (tests, ad-hoc usage).
        cost_tracker: optional `CostEventTracker` instance — when set,
            each fal generation records a `kind="sfx"` entry.
        run_dir: optional local dir; the fresh mp3s are also written
            under `run_dir/_stinger_cache/` for debugging.
        s3_uploader: callable `(bytes, key_suffix) → s3_url`. When None,
            stingers are kept as local file paths in cue URLs (which
            the audio_mixer accepts). When provided, the bytes are
            uploaded and the S3 URL is used (matches the music_generator
            pattern so render-worker concat sees a URL).
        video_id: used in S3 key prefix when uploading.
        max_variants: cap on number of distinct generations. Cycle if
            transitions exceed this.
        stinger_duration_s: target length for each variant. Clamped to
            [0.5, 1.0] internally.
        seed: optional RNG seed for stable variant ordering across reruns.
    """
    # ── Tier gate ───────────────────────────────────────────────────
    enabled = True
    if tier_config is not None:
        enabled = bool(tier_config.get("transition_stingers_enabled", True))
        # Reuse the existing sound_enabled key as a parent kill-switch:
        # if sounds are disabled entirely, stingers should be too.
        if not tier_config.get("sound_enabled", True):
            enabled = False
    if not enabled:
        _log.info("[stinger] tier disables fresh stingers — using static library")
        return 0

    # ── Find transition cues that exist today ──────────────────────
    transition_cues: List[Dict[str, Any]] = []
    for entry in entries:
        for cue in entry.get("sound_cues") or []:
            if (cue.get("role") or "").lower() == "transition_whoosh":
                transition_cues.append(cue)
    if not transition_cues:
        _log.info("[stinger] no transition cues to enrich — skipping")
        return 0

    # ── Resolve fal client (lazy import + graceful degradation) ────
    try:
        try:
            from app.services.fal_elevenlabs_client import (  # type: ignore
                FalElevenLabsClient, get_fal_api_key_from_env,
            )
        except ImportError:
            import importlib.util as _ilu
            import sys as _sys
            services_dir = Path(__file__).resolve().parent.parent / "services"
            fal_path = services_dir / "fal_elevenlabs_client.py"
            if not fal_path.exists():
                _log.info(
                    "[stinger] fal_elevenlabs_client not importable (path=%s) "
                    "— keeping static library", fal_path,
                )
                return 0
            spec = _ilu.spec_from_file_location("fal_elevenlabs_client", fal_path)
            mod = _ilu.module_from_spec(spec)  # type: ignore
            _sys.modules.setdefault("fal_elevenlabs_client", mod)
            spec.loader.exec_module(mod)  # type: ignore
            FalElevenLabsClient = mod.FalElevenLabsClient
            get_fal_api_key_from_env = mod.get_fal_api_key_from_env
    except Exception as e:
        _log.warning("[stinger] could not import fal client: %s", e)
        return 0

    api_key = get_fal_api_key_from_env()
    if not api_key:
        _log.info("[stinger] FAL_API_KEY not set — keeping static library")
        return 0

    # ── Pick how many variants to generate ─────────────────────────
    n_variants = min(len(transition_cues), max(1, int(max_variants)))
    rng = random.Random(seed if seed is not None else int(time.time()) % 100000)
    # Pick distinct prompts. If we need more than the bank size, allow
    # repetition (each gen is non-deterministic anyway, so two same-
    # prompt calls produce slightly different audio).
    if n_variants <= len(_STINGER_PROMPT_BANK):
        prompts = rng.sample(_STINGER_PROMPT_BANK, n_variants)
    else:
        prompts = list(_STINGER_PROMPT_BANK)
        while len(prompts) < n_variants:
            prompts.append(rng.choice(_STINGER_PROMPT_BANK))

    # ── Generate the variant bank ──────────────────────────────────
    cache_dir = (run_dir / "_stinger_cache") if run_dir is not None else None
    client = FalElevenLabsClient(api_key=api_key, cache_dir=cache_dir)
    dur = max(0.5, min(1.0, float(stinger_duration_s)))

    variant_urls: List[str] = []  # parallel to prompts
    variant_bytes_for_local: List[bytes] = []
    for i, prompt in enumerate(prompts):
        try:
            result = client.submit(
                prompt,
                duration_s=dur,
                loop=False,
                prompt_influence=0.65,
                output_format="mp3_44100_128",
                proactively_download=True,
            )
        except Exception as e:
            _log.warning("[stinger] variant %d generation failed: %s", i, e)
            continue
        if not result.audio_bytes and not result.url:
            continue

        # Decide local-path vs S3 upload mode. Local path is fine for
        # mixer-only renders; S3 is required when the timeline is shipped
        # to a remote worker for final assembly.
        if s3_uploader is not None and result.audio_bytes:
            try:
                key = f"ai-videos/{video_id}/stingers/variant_{i:02d}.mp3"
                uploaded_url = s3_uploader(result.audio_bytes, key)
                variant_urls.append(uploaded_url)
            except Exception as e:
                _log.warning("[stinger] S3 upload failed for variant %d: %s", i, e)
                # Fall through to local-path mode for this variant.
                variant_urls.append(_persist_local(
                    result.audio_bytes, cache_dir, i,
                ) or result.url)
        elif result.audio_bytes:
            local = _persist_local(result.audio_bytes, cache_dir, i)
            variant_urls.append(local or result.url)
        else:
            # Only the URL is available — the mixer can fetch it.
            variant_urls.append(result.url)

        # Cost-tracker entry (one per generation, library hits are $0).
        if cost_tracker is not None and not result.cache_hit:
            try:
                cost_tracker.record_sfx(
                    stage="transition_stinger",
                    model="fal-elevenlabs/sound-effects-v2",
                    duration_s=dur,
                    cost_usd=result.cost_usd,
                )
            except Exception:
                pass

    if not variant_urls:
        _log.warning("[stinger] no variants generated successfully — keeping static")
        return 0

    # ── Rotate variants across the existing transition cue positions ──
    replaced = 0
    for i, cue in enumerate(transition_cues):
        variant = variant_urls[i % len(variant_urls)]
        _set_role_url(cue, variant)
        replaced += 1

    _log.info(
        "[stinger] replaced %d transition URLs with %d fresh variants (cost $%.3f)",
        replaced, len(variant_urls),
        len(variant_urls) * dur * 0.002,  # rough total spend
    )
    return replaced


def _persist_local(data: bytes, cache_dir: Optional[Path], idx: int) -> Optional[str]:
    """Write bytes to `cache_dir/stinger_NN.mp3` and return the absolute
    path (or None on failure). Used when no S3 uploader is wired."""
    if cache_dir is None or not data:
        return None
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
        path = cache_dir / f"stinger_{idx:02d}.mp3"
        path.write_bytes(data)
        return str(path)
    except OSError as e:
        _log.warning("[stinger] local persist failed: %s", e)
        return None
