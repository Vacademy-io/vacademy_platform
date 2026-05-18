"""Generate a full fresh SFX palette via fal-ai/elevenlabs/sound-effects/v2.

Runs AFTER `sound_planner.plan_sound_cues` has populated each entry's
`sound_cues` list from the static library. This module then:

  1. Inspects every cue's `role` (transition_whoosh, transition_riser,
     ui_chime, ui_positive, ui_negative, ui_click, impact, data_reveal).
  2. For each distinct role, generates a small bank of variants via
     fal-elevenlabs using mood-aware prompts from `SFX_PROMPTS`.
  3. Rotates the variants across cue positions so consecutive same-role
     cues don't sound identical.
  4. Replaces each cue's `url` (static library) with the fresh fal URL
     (local path or S3).

This supersedes the previous `transition_stinger_planner.py` which only
handled transition cues. Background:

  The static 4176-entry sounds library is mood-blind — `ui_positive`
  resolves to "Door — FOLEY, HOTEL, DOOR" on a partnership-announcement
  video. Generating fresh per-video, mood-aware SFX via the same API
  used for stingers fixes the tone-mismatch problem at the source.

Tier gating: `sfx_generation_enabled` flag in tier_config. Premium+ only.
Free/Standard renders fall through to static library URLs (no regression).

Graceful degradation: any failure (missing FAL_API_KEY, network error,
unrecognized role) preserves the static library URL for that cue.
"""
from __future__ import annotations

import logging
import os
import random
import re
import time
from collections import defaultdict
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

_log = logging.getLogger(__name__)


# Hard cap on distinct variants per role per video. Cycle after this.
MAX_VARIANTS_PER_ROLE = 5

# Default fal-elevenlabs generation duration (seconds). Model floor is
# 0.5s. Different roles benefit from different lengths; per-role overrides
# live in `_ROLE_DEFAULT_DURATION_S`.
DEFAULT_DURATION_S = 0.55

_ROLE_DEFAULT_DURATION_S: Dict[str, float] = {
    "transition_whoosh": 0.55,
    "transition_riser":  0.80,
    "ui_chime":          0.70,
    "ui_positive":       0.80,
    "ui_negative":       0.70,
    "ui_click":          0.50,
    "impact":            0.65,
    "data_reveal":       0.60,
}

# Allowed mood values. Director may emit `audio_mood`; else inferred
# heuristically. Falls back to "default" when neither path resolves.
ALLOWED_MOODS = ("default", "celebratory", "educational", "cinematic")

# Per-role × per-mood prompt banks. Each list is rotated across cues so
# consecutive same-role cues don't sound identical.
SFX_PROMPTS: Dict[str, Dict[str, List[str]]] = {
    "transition_whoosh": {
        "default": [
            "Smooth cinematic whoosh, mid-frequency air movement, short and clean",
            "Subtle riser into a soft impact, warm tone, no high-frequency harshness",
            "Quick swoosh transition, airy, light reverb tail",
            "Brief tonal sweep, low-to-high, ascending pitch, energetic",
        ],
        "celebratory": [
            "Uplifting whoosh-sparkle, ascending, warm bright tone",
            "Bright swoosh with brief shimmer tail, encouraging",
        ],
        "cinematic": [
            "Deep airy swoosh, low-mid, dramatic tail",
            "Cinematic transition pass, sub-low rumble into clean tail",
        ],
        "educational": [
            "Soft clean swoosh, neutral mid-frequency, brief",
        ],
    },
    "transition_riser": {
        "default": [
            "Building riser, ascending pitch, 0.8s, no harsh peak",
            "Smooth ascending tonal sweep, soft tail, clean energy",
        ],
        "celebratory": [
            "Bright ascending sparkle riser, warm, anticipatory",
        ],
        "cinematic": [
            "Deep cinematic riser with sub-low foundation, dramatic",
        ],
    },
    "ui_chime": {
        "default": [
            "Warm bell tone, gentle reveal, brief reverb tail",
            "Soft glockenspiel hit, encouraging, mid-bright",
            "Clean tonal chime, single mallet strike, warm",
        ],
        "celebratory": [
            "Bright celebratory ding, slight vibrato, warm tail",
            "Triumphant short bell, ascending overtones",
        ],
        "educational": [
            "Soft confirmation chime, neutral, encouraging",
        ],
    },
    "ui_positive": {
        "default": [
            "Warm uplifting chime, soft mallet, brief reverb",
            "Gentle positive confirmation tone, mid-bright, no harshness",
            "Soft ascending two-note motif, warm, friendly",
        ],
        "celebratory": [
            "Triumphant short fanfare-chime, warm, no brass",
            "Bright sparkle reveal, ascending, uplifting",
        ],
        "educational": [
            "Soft positive tone, encouraging, clean and neutral",
        ],
    },
    "ui_negative": {
        "default": [
            "Soft descending tone, neutral, not harsh",
            "Gentle low chime, brief, non-alarming",
        ],
    },
    "ui_click": {
        "default": [
            "Crisp short click, neutral UI feel",
            "Soft tactile click, brief, modern",
        ],
    },
    "impact": {
        "default": [
            "Deep cinematic impact, full-spectrum thud, no metallic ring",
            "Soft punch impact, mid-low body, brief tail",
        ],
        "cinematic": [
            "Heavy sub-thud with brief air, no clang",
            "Deep cinematic boom with low-end emphasis, short decay",
        ],
        "celebratory": [
            "Warm impact with sparkle overtones, uplifting",
        ],
    },
    "data_reveal": {
        "default": [
            "Subtle tonal tick, encouraging, mid-frequency",
            "Soft data sparkle, ascending pitch, brief",
            "Clean reveal tone, single note, warm",
        ],
        "celebratory": [
            "Bright sparkle reveal, ascending shimmer, uplifting",
        ],
        "educational": [
            "Soft notification tone, neutral, encouraging",
        ],
    },
}


# ──────────────────────────────────────────────────────────────────────
# Mood resolution
# ──────────────────────────────────────────────────────────────────────

_MOOD_KEYWORDS: List[tuple] = [
    ("celebratory", re.compile(
        r"\b(welcome|partnership|announce|celebrat|launch|introduc|joining|"
        r"family|congrat|exciting|proud|together)\b", re.IGNORECASE)),
    ("educational", re.compile(
        r"\b(tutorial|lesson|learn|explain|teach|guide|how to|step by step|"
        r"introduction to|fundamental)\b", re.IGNORECASE)),
    ("cinematic", re.compile(
        r"\b(dramatic|story|journey|epic|powerful|transform|revolution|"
        r"impact|breakthrough)\b", re.IGNORECASE)),
]


def _infer_mood(script: Any) -> str:
    """Heuristic mood inference from script title + brief text."""
    if not script:
        return "default"
    text_parts: List[str] = []
    if isinstance(script, dict):
        for key in ("audio_mood", "mood"):
            v = script.get(key)
            if isinstance(v, str) and v.strip().lower() in ALLOWED_MOODS:
                return v.strip().lower()
        for key in ("title", "video_title", "brief", "description",
                    "topic", "subject", "script_text", "narration"):
            v = script.get(key)
            if isinstance(v, str):
                text_parts.append(v)
        # Sweep narration/vo lines too.
        for key in ("segments", "shots", "scenes"):
            arr = script.get(key)
            if isinstance(arr, list):
                for item in arr[:10]:
                    if isinstance(item, dict):
                        for k in ("narration", "vo", "text", "title"):
                            v = item.get(k)
                            if isinstance(v, str):
                                text_parts.append(v)
    elif isinstance(script, str):
        text_parts.append(script)

    blob = " ".join(text_parts)[:4000]
    if not blob:
        return "default"
    for mood, pat in _MOOD_KEYWORDS:
        if pat.search(blob):
            return mood
    return "default"


def resolve_mood(script: Any = None, explicit: Optional[str] = None) -> str:
    """Public mood resolver. Priority: explicit param > script.audio_mood >
    heuristic > 'default'."""
    if explicit and explicit.strip().lower() in ALLOWED_MOODS:
        return explicit.strip().lower()
    return _infer_mood(script)


# ──────────────────────────────────────────────────────────────────────
# fal client loader
# ──────────────────────────────────────────────────────────────────────

def _load_fal_client():
    """Lazy-import the fal_elevenlabs_client, with file-path fallback for
    runs where `app.services` isn't on sys.path."""
    try:
        from app.services.fal_elevenlabs_client import (  # type: ignore
            FalElevenLabsClient, get_fal_api_key_from_env,
        )
        return FalElevenLabsClient, get_fal_api_key_from_env
    except ImportError:
        pass
    import importlib.util as _ilu
    import sys as _sys
    services_dir = Path(__file__).resolve().parent.parent / "services"
    fal_path = services_dir / "fal_elevenlabs_client.py"
    if not fal_path.exists():
        return None, None
    spec = _ilu.spec_from_file_location("fal_elevenlabs_client", fal_path)
    mod = _ilu.module_from_spec(spec)  # type: ignore
    _sys.modules.setdefault("fal_elevenlabs_client", mod)
    spec.loader.exec_module(mod)  # type: ignore
    return mod.FalElevenLabsClient, mod.get_fal_api_key_from_env


# ──────────────────────────────────────────────────────────────────────
# Local persist helper
# ──────────────────────────────────────────────────────────────────────

def _persist_local(data: bytes, cache_dir: Optional[Path],
                   role: str, idx: int) -> Optional[str]:
    if cache_dir is None or not data:
        return None
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
        path = cache_dir / f"sfx_{role}_{idx:02d}.mp3"
        path.write_bytes(data)
        return str(path)
    except OSError as e:
        _log.warning("[sfx-palette] local persist failed: %s", e)
        return None


# ──────────────────────────────────────────────────────────────────────
# Variant generation (per role)
# ──────────────────────────────────────────────────────────────────────

def _generate_variants_for_role(
    *,
    role: str,
    mood: str,
    n_needed: int,
    duration_s: float,
    client: Any,
    cache_dir: Optional[Path],
    s3_uploader: Optional[Callable[[bytes, str], str]],
    video_id: str,
    cost_tracker: Any,
    rng: random.Random,
) -> List[str]:
    """Returns up to `n_needed` URLs/paths of fresh variants for `role`.
    Empty list on total failure (caller keeps static URLs)."""
    bank_for_role = SFX_PROMPTS.get(role) or {}
    # Mood lookup with fallback chain: requested → default → any available.
    prompts = (bank_for_role.get(mood)
               or bank_for_role.get("default")
               or next(iter(bank_for_role.values()), []))
    if not prompts:
        _log.info("[sfx-palette] no prompt bank for role=%s — skipping", role)
        return []

    if n_needed <= len(prompts):
        chosen_prompts = rng.sample(prompts, n_needed)
    else:
        chosen_prompts = list(prompts)
        while len(chosen_prompts) < n_needed:
            chosen_prompts.append(rng.choice(prompts))

    urls: List[str] = []
    for i, prompt in enumerate(chosen_prompts):
        try:
            result = client.submit(
                prompt,
                duration_s=duration_s,
                loop=False,
                prompt_influence=0.65,
                output_format="mp3_44100_128",
                proactively_download=True,
            )
        except Exception as e:
            _log.warning("[sfx-palette] gen failed role=%s i=%d: %s",
                         role, i, e)
            continue
        if not result.audio_bytes and not result.url:
            continue

        url_out: Optional[str] = None
        if s3_uploader is not None and result.audio_bytes:
            try:
                key = f"ai-videos/{video_id}/sfx/{role}_{i:02d}.mp3"
                url_out = s3_uploader(result.audio_bytes, key)
            except Exception as e:
                _log.warning("[sfx-palette] S3 upload failed role=%s i=%d: %s",
                             role, i, e)
        if url_out is None and result.audio_bytes:
            url_out = _persist_local(result.audio_bytes, cache_dir, role, i)
        if url_out is None:
            url_out = result.url
        if not url_out:
            continue
        urls.append(url_out)

        if cost_tracker is not None and not result.cache_hit:
            try:
                cost_tracker.record_sfx(
                    stage=f"sfx_palette_{role}",
                    model="fal-elevenlabs/sound-effects-v2",
                    duration_s=duration_s,
                    cost_usd=result.cost_usd,
                )
            except Exception:
                pass

    return urls


# ──────────────────────────────────────────────────────────────────────
# Public entry point
# ──────────────────────────────────────────────────────────────────────

# Roles that get layered composites (primary + sub-layer mixed locally
# via ffmpeg into a single mp3). These are the high-impact moments where
# pros never use a single sample — a transition is whoosh + sub-thump,
# a positive reveal is impact + chime, a data appearance is tick + swell.
_LAYERED_ROLES = {
    "transition_whoosh",
    "transition_riser",
    "ui_positive",
    "data_reveal",
    "impact",
}

# Sub-layer prompt bank — what gets added under the primary layer. Keyed
# by role. Each sub-layer is a complementary sound that fills a different
# frequency band than the primary (sub-bass thumps under mid-bright
# whooshes, sparkle highs over warm bell tones, etc.).
_SUB_LAYER_PROMPTS: Dict[str, List[str]] = {
    "transition_whoosh": [
        "Soft sub-bass thump, very brief, low-frequency body, no transient harshness",
        "Deep brief rumble underlay, sub-low, supportive bed for a transition",
    ],
    "transition_riser": [
        "Low rumble bed building underneath, sub-bass, supportive foundation",
    ],
    "ui_positive": [
        "Soft high-frequency sparkle tail, brief shimmer, complementary to a chime",
        "Gentle airy whoosh underlay, supportive, neutral",
    ],
    "data_reveal": [
        "Soft tonal swell underneath, mid-low, supportive bed",
        "Faint ambient pad swell, neutral, brief",
    ],
    "impact": [
        "Soft air whoosh into the impact, brief, mid-frequency lead-in",
        "Subtle pre-impact swell, building tension, very brief",
    ],
}

# Per-mood content-style modifiers — appended to every prompt so the
# generated sound matches the video's emotional tone.
_MOOD_MODIFIERS: Dict[str, str] = {
    "default":     "clean, broadcast-quality, no distortion, professional",
    "celebratory": "warm, uplifting, bright but never harsh, polished",
    "educational": "neutral, clear, focused, minimal reverb",
    "cinematic":   "wide, deep, atmospheric, lush reverb tail",
}


def _build_content_aware_prompt(
    *, role: str, mood: str, layer: str,
    context: Optional[Dict[str, Any]],
    base_prompt: str,
) -> str:
    """Stitch role-base + content cue + mood modifier into one prompt.

    `base_prompt` is the role+mood seed from SFX_PROMPTS (or
    _SUB_LAYER_PROMPTS for sub layers). We append: (a) a content cue
    derived from `context.text` if it's salient, and (b) the mood
    modifier.

    Result example: a `ui_positive` cue at "₹1 billion users joined" with
    mood=celebratory →

      "Warm uplifting chime, soft mallet, brief reverb — moment of milestone
       reveal — warm, uplifting, bright but never harsh, polished"

    Length is capped at ~400 chars (fal-elevenlabs accepts up to 2k but
    longer prompts dilute steering signal).
    """
    bits: List[str] = [base_prompt.strip()]

    # Content cue from the surrounding narration text.
    txt = ""
    if isinstance(context, dict):
        txt = str(context.get("text") or "").strip()
    cue_phrase = _content_phrase_for_role(role, txt, layer=layer)
    if cue_phrase:
        bits.append(cue_phrase)

    # Mood modifier.
    mood_mod = _MOOD_MODIFIERS.get(mood) or _MOOD_MODIFIERS["default"]
    bits.append(mood_mod)

    return " — ".join(bits)[:400]


# Keyword groups for content-phrase detection. Order matters: first match
# wins. Phrases are crafted to *steer* the model, not to read like English
# sentences — "for a milestone reveal" works because the model has heard
# "milestone" in similar SFX captions.
_CONTENT_KEYWORD_RULES: List[Tuple[re.Pattern, str]] = [
    (re.compile(r"\b(million|billion|crore|lakh|thousand|\d{3,})\b", re.IGNORECASE),
     "for a big number reveal"),
    (re.compile(r"\b(welcome|hello|hi everyone|namaste|greet)\b", re.IGNORECASE),
     "for a warm greeting moment"),
    (re.compile(r"\b(partnership|join|family|together|launch|announce)\b", re.IGNORECASE),
     "for a partnership/launch announcement"),
    (re.compile(r"\b(introduc|presenting|here is|meet)\b", re.IGNORECASE),
     "for an introduction beat"),
    (re.compile(r"\b(achieve|success|complete|done|finish|won|winner)\b", re.IGNORECASE),
     "for an achievement moment"),
    (re.compile(r"\b(question|why|how|what if|imagine)\b", re.IGNORECASE),
     "for a curiosity-inducing beat"),
    (re.compile(r"\b(important|key|critical|remember|note that)\b", re.IGNORECASE),
     "for a key-point emphasis"),
    (re.compile(r"\b(next|first|second|third|step|next up)\b", re.IGNORECASE),
     "for a step/section transition"),
    (re.compile(r"\b(result|outcome|finally|conclusion)\b", re.IGNORECASE),
     "for a result reveal"),
]


def _content_phrase_for_role(role: str, text: str, *, layer: str) -> str:
    """Pick a short steering phrase that ties the sound to the on-screen
    content. Returns '' when nothing salient is found (planner falls back
    to pure role+mood prompt)."""
    if not text:
        return ""
    # Sub-layers are sweeteners — they don't need their own content cue,
    # they support the primary. Skip the steering phrase for them.
    if layer == "sub":
        return ""
    for pat, phrase in _CONTENT_KEYWORD_RULES:
        if pat.search(text):
            return phrase
    return ""


def _ffmpeg_mix_layers(
    layer_paths: List[Path],
    layer_volumes: List[float],
    out_path: Path,
) -> Optional[Path]:
    """Mix N local mp3 layers into a single mp3 via ffmpeg amix.

    Used to build composite cues: e.g. whoosh + sub-thump → one bedded
    transition sound. The mixer's final filter graph then treats the
    composite as a single cue (no extra amix work per cue at mix time).

    Returns the output path on success, None on failure. Failure is
    non-fatal — caller falls back to single-layer cue.
    """
    import subprocess
    if not layer_paths or len(layer_paths) != len(layer_volumes):
        return None
    if len(layer_paths) == 1:
        # Nothing to mix — copy the single source through (caller can
        # also just keep the source path; this branch keeps the contract
        # of "returns the path you can point a cue at").
        return layer_paths[0]
    try:
        out_path.parent.mkdir(parents=True, exist_ok=True)
    except OSError:
        return None

    cmd = ["ffmpeg", "-y", "-hide_banner", "-loglevel", "error"]
    for p in layer_paths:
        cmd.extend(["-i", str(p)])

    # Build filter: each input gets its volume scaler, then amix.
    filter_parts: List[str] = []
    inputs_for_amix: List[str] = []
    for i, vol in enumerate(layer_volumes):
        v = max(0.0, min(2.0, float(vol)))
        label = f"l{i}"
        filter_parts.append(f"[{i}:a] volume={v} [{label}]")
        inputs_for_amix.append(f"[{label}]")
    filter_parts.append(
        f"{''.join(inputs_for_amix)} amix=inputs={len(layer_paths)}:"
        f"duration=longest:normalize=0 [out]"
    )
    cmd.extend([
        "-filter_complex", "; ".join(filter_parts),
        "-map", "[out]",
        "-c:a", "libmp3lame",
        "-b:a", "192k",
        str(out_path),
    ])
    try:
        result = subprocess.run(cmd, capture_output=True, timeout=30)
    except (subprocess.TimeoutExpired, OSError) as e:
        _log.warning("[sfx-palette] composite mix failed: %s", e)
        return None
    if result.returncode != 0:
        _log.warning("[sfx-palette] composite mix ffmpeg returned %d: %s",
                     result.returncode, result.stderr[-300:].decode("utf-8", "ignore"))
        return None
    return out_path


def _gen_single_layer(
    *,
    role: str, mood: str, layer: str, base_prompt: str,
    context: Optional[Dict[str, Any]],
    duration_s: float,
    client: Any,
    cache_dir: Optional[Path],
    file_stem: str,
    cost_tracker: Any,
) -> Optional[Tuple[Path, float, bool]]:
    """Generate one layer's audio via fal. Returns (local_path, cost, cache_hit)
    or None on failure."""
    prompt = _build_content_aware_prompt(
        role=role, mood=mood, layer=layer,
        context=context, base_prompt=base_prompt,
    )
    try:
        result = client.submit(
            prompt,
            duration_s=duration_s,
            loop=False,
            prompt_influence=0.70,
            output_format="mp3_44100_128",
            proactively_download=True,
        )
    except Exception as e:
        _log.warning("[sfx-palette] gen failed role=%s layer=%s: %s",
                     role, layer, e)
        return None
    if not result.audio_bytes:
        return None
    if cache_dir is None:
        return None
    try:
        cache_dir.mkdir(parents=True, exist_ok=True)
        local_path = cache_dir / f"{file_stem}.mp3"
        local_path.write_bytes(result.audio_bytes)
    except OSError as e:
        _log.warning("[sfx-palette] persist failed: %s", e)
        return None

    if cost_tracker is not None and not result.cache_hit:
        try:
            cost_tracker.record_sfx(
                stage=f"sfx_palette_{role}_{layer}",
                model="fal-elevenlabs/sound-effects-v2",
                duration_s=duration_s,
                cost_usd=result.cost_usd,
            )
        except Exception:
            pass

    return (local_path, float(result.cost_usd or 0.0), bool(result.cache_hit))


def enrich_cues(
    entries: List[Dict[str, Any]],
    *,
    mood: Optional[str] = None,
    script: Any = None,
    tier_config: Optional[Dict[str, Any]] = None,
    cost_tracker: Any = None,
    run_dir: Optional[Path] = None,
    s3_uploader: Optional[Callable[[bytes, str], str]] = None,
    video_id: str = "",
    max_variants_per_role: int = MAX_VARIANTS_PER_ROLE,
    seed: Optional[int] = None,
) -> Dict[str, int]:
    """Replace static-library URLs with content-aware, optionally-layered
    fresh fal generations.

    Each cue gets its OWN generation (not a rotation of shared variants),
    keyed by (role, mood, content-context). The fal client's SHA256 cache
    means identical (role, mood, content) across cues collapses back into
    a single API call automatically — no wasted spend, but every distinct
    moment in the video gets a purpose-built sound.

    High-impact roles in `_LAYERED_ROLES` get a 2-layer composite (primary
    + complementary sub-layer mixed locally via ffmpeg into one mp3).
    This is the "designed, not stocked" feel — single-sample cues sound
    thin even when fresh-generated.

    Returns {role: replaced_count}. Returns {} silently when generation
    isn't applicable (no regression).
    """
    # ── Tier gate ───────────────────────────────────────────────────
    if tier_config is not None:
        if not tier_config.get("sound_enabled", True):
            _log.info("[sfx-palette] sound disabled by tier — keeping static")
            return {}
        if not tier_config.get("sfx_generation_enabled", False):
            _log.info("[sfx-palette] sfx_generation_enabled=False — static lib")
            return {}

    # ── Collect all eligible cues (role in SFX_PROMPTS) ────────────
    eligible: List[Tuple[Dict[str, Any], str]] = []  # (cue, role)
    for entry in entries:
        for cue in entry.get("sound_cues") or []:
            role = (cue.get("role") or "").strip().lower()
            if role and role in SFX_PROMPTS:
                eligible.append((cue, role))
    if not eligible:
        _log.info("[sfx-palette] no cues to enrich — skipping")
        return {}

    # ── Resolve fal client ─────────────────────────────────────────
    FalElevenLabsClient, get_fal_api_key_from_env = _load_fal_client()
    if FalElevenLabsClient is None:
        _log.info("[sfx-palette] fal client unavailable — keeping static")
        return {}
    api_key = get_fal_api_key_from_env()
    if not api_key:
        _log.info("[sfx-palette] FAL_API_KEY not set — keeping static")
        return {}

    # ── Mood + client setup ───────────────────────────────────────
    resolved_mood = resolve_mood(script=script, explicit=mood)
    cache_dir = (run_dir / "_sfx_palette_cache") if run_dir is not None else None
    composite_dir = (run_dir / "_sfx_composite") if run_dir is not None else None
    client = FalElevenLabsClient(api_key=api_key, cache_dir=cache_dir)
    rng = random.Random(seed if seed is not None else int(time.time()) % 100000)

    _log.info("[sfx-palette] mood=%s cues=%d layered_roles=%s",
              resolved_mood, len(eligible), sorted(_LAYERED_ROLES))

    # ── Per-cue generation (cache makes identical content cheap) ──
    replaced: Dict[str, int] = defaultdict(int)
    for cue_idx, (cue, role) in enumerate(eligible):
        ctx = cue.get("context") if isinstance(cue, dict) else None
        duration_s = _ROLE_DEFAULT_DURATION_S.get(role, DEFAULT_DURATION_S)
        # Pick the primary prompt seed: mood bank → default → first available.
        bank = SFX_PROMPTS.get(role) or {}
        primary_seeds = (bank.get(resolved_mood)
                         or bank.get("default")
                         or next(iter(bank.values()), []))
        if not primary_seeds:
            continue
        primary_base = rng.choice(primary_seeds)

        # Primary layer.
        primary = _gen_single_layer(
            role=role, mood=resolved_mood, layer="primary",
            base_prompt=primary_base,
            context=ctx, duration_s=duration_s,
            client=client, cache_dir=cache_dir,
            file_stem=f"primary_{role}_{cue_idx:02d}",
            cost_tracker=cost_tracker,
        )
        if primary is None:
            continue

        # Optional sub-layer for high-impact roles.
        composite_path: Optional[Path] = None
        if role in _LAYERED_ROLES and composite_dir is not None:
            sub_bank = _SUB_LAYER_PROMPTS.get(role) or []
            if sub_bank:
                sub_base = rng.choice(sub_bank)
                sub_dur = max(0.4, duration_s * 0.9)  # sub-layer slightly shorter
                sub = _gen_single_layer(
                    role=role, mood=resolved_mood, layer="sub",
                    base_prompt=sub_base,
                    context=ctx, duration_s=sub_dur,
                    client=client, cache_dir=cache_dir,
                    file_stem=f"sub_{role}_{cue_idx:02d}",
                    cost_tracker=cost_tracker,
                )
                if sub is not None:
                    # Mix primary (full) + sub (60% level) into a single mp3.
                    composite_out = composite_dir / f"composite_{role}_{cue_idx:02d}.mp3"
                    composite_path = _ffmpeg_mix_layers(
                        [primary[0], sub[0]],
                        [1.0, 0.60],
                        composite_out,
                    )

        final_path = composite_path or primary[0]

        # Upload to S3 if a uploader is wired; else keep local path.
        url_out: Optional[str] = None
        if s3_uploader is not None:
            try:
                with open(final_path, "rb") as f:
                    audio_bytes = f.read()
                key = f"ai-videos/{video_id}/sfx/{role}_{cue_idx:02d}.mp3"
                url_out = s3_uploader(audio_bytes, key)
            except Exception as e:
                _log.warning("[sfx-palette] S3 upload failed cue=%d: %s",
                             cue_idx, e)
        if url_out is None:
            url_out = str(final_path)

        cue["url"] = url_out
        replaced[role] += 1

    total = sum(replaced.values())
    _log.info("[sfx-palette] replaced %d cues (mood=%s, composites=%d)",
              total, resolved_mood,
              sum(1 for _, r in eligible if r in _LAYERED_ROLES))
    return dict(replaced)


# ──────────────────────────────────────────────────────────────────────
# Backwards-compatibility shim
# ──────────────────────────────────────────────────────────────────────

def enrich_transitions_with_fresh_stingers(
    entries: List[Dict[str, Any]],
    *,
    tier_config: Optional[Dict[str, Any]] = None,
    cost_tracker: Any = None,
    run_dir: Optional[Path] = None,
    s3_uploader: Optional[Callable[[bytes, str], str]] = None,
    video_id: str = "",
    max_variants: int = MAX_VARIANTS_PER_ROLE,
    stinger_duration_s: float = 0.55,
    seed: Optional[int] = None,
    mood: Optional[str] = None,
    script: Any = None,
) -> int:
    """Legacy entrypoint — now delegates to `enrich_cues` for transition
    roles only. Kept so existing callers don't break during the rename."""
    counts = enrich_cues(
        entries,
        mood=mood,
        script=script,
        tier_config=tier_config,
        cost_tracker=cost_tracker,
        run_dir=run_dir,
        s3_uploader=s3_uploader,
        video_id=video_id,
        max_variants_per_role=max_variants,
        seed=seed,
    )
    return counts.get("transition_whoosh", 0) + counts.get("transition_riser", 0)
