"""Generate SFX via cassetteai/sound-effects-generator with label-driven
PROMPTs that describe the physical / on-screen event the cue is matched to.

Background — why this module exists in its current shape:

Original v1 generated SFX via fal-ai/elevenlabs/sound-effects-v2 with
role+mood prompts ("Smooth cinematic whoosh, warm uplifting, gentle
motion"). The output sounded synthetic / funny because the prompts were
adjective soup with no physical anchor.

Concurrently sound_planner was demolished (2026-05) — it no longer
emits cues for transitions or per-shot signatures. Cues come ONLY from:
  (A) The GSAP scanner — `entry["_sfx_events"]` with concrete event
      labels: "typewriter", "bar_grow", "counter_tick", "underline_draw",
      "slide_in", "pop_in", "element_appear", "pulse", "list_reveal".
  (B) Director sync_points with action text (mapped to a role + the
      action verb as label).

This module now:
  1. Reads each cue's `label` (event kind from scanner OR Director action).
  2. Looks up a PHYSICAL prompt in LABEL_TO_PROMPT — concrete source-
     material language ("mechanical typewriter keys clicking", "pen
     drawing on paper") that cassetteai's model adheres to tightly.
  3. Calls cassetteai once per (label, duration) combo; SHA256 cache
     means identical labels across cues reuse the same generation.
  4. Replaces cue.url with the generated audio URL (or local path).

Tier gating: `sfx_generation_enabled` flag in tier_config. Premium+ only.
Free/Standard renders fall through to static library URLs (no regression).

Graceful degradation: any failure (missing FAL_API_KEY, network error,
unmapped label) preserves the cue's static library URL.
"""
from __future__ import annotations

import logging
import re
from collections import defaultdict
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Tuple

_log = logging.getLogger(__name__)


# ──────────────────────────────────────────────────────────────────────
# Allowed mood values (kept for back-compat with callers and the
# Director's optional `audio_mood` field). Mood no longer drives prompt
# selection — prompts are physical-source-material based — but the
# audio_mixer still uses it for reverb selection downstream.
# ──────────────────────────────────────────────────────────────────────

ALLOWED_MOODS = ("default", "celebratory", "educational", "cinematic")


_MOOD_KEYWORDS: List[Tuple[str, re.Pattern]] = [
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
    """Heuristic mood inference from script title + brief text. Falls back
    to 'default' when no keyword matches. Director's explicit `audio_mood`
    field always wins over heuristic."""
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
    """Public mood resolver — explicit param > script.audio_mood > heuristic."""
    if explicit and explicit.strip().lower() in ALLOWED_MOODS:
        return explicit.strip().lower()
    return _infer_mood(script)


# ──────────────────────────────────────────────────────────────────────
# Label → physical-prompt map
# ──────────────────────────────────────────────────────────────────────
#
# Each entry describes WHAT IS HAPPENING ON SCREEN in physical-source-
# material terms. cassetteai/sound-effects-generator (and most modern
# SFX generators) respond best to:
#   - explicit source material ("mechanical typewriter", "paper sliding",
#     "pen on paper", "single bell strike")
#   - duration hint inside the prompt ("over 1.5 seconds")
#   - NO abstract adjectives ("cinematic", "celebratory", "warm")
#
# Each value: (prompt_text, target_duration_seconds, volume_mul)
# - duration is an int (cassetteai requires 1-30 seconds)
# - volume_mul tunes how prominent the SFX is in the mix (0.4 = subtle,
#   0.7 = noticeable, 0.9 = featured)

LabelDef = Tuple[str, int, float]


LABEL_TO_PROMPT: Dict[str, LabelDef] = {
    # ── Text / typography events ────────────────────────────────────
    "typewriter": (
        "Mechanical typewriter typing fast, multiple rapid key clicks, "
        "tactile keyboard clacks in sequence, no music, dry recording, "
        "ending on the final keystroke",
        2, 0.45,
    ),
    "type_in": (
        "Fast computer keyboard typing burst, soft mechanical key clicks, "
        "dry recording, no music",
        2, 0.40,
    ),
    "split_reveal": (
        "Soft paper rustle then settle, gentle reveal sound, dry recording",
        1, 0.50,
    ),

    # ── Data / numeric / chart events ───────────────────────────────
    "bar_grow": (
        "Ascending tonal sweep like a graph bar growing on screen, "
        "smooth rising pitch, ends on a soft tone, 1 second",
        1, 0.50,
    ),
    "counter_tick": (
        "Mechanical odometer counting up rapidly, soft rapid clicks, "
        "ends on a soft final tick, dry recording, 2 seconds",
        2, 0.55,
    ),
    "data_reveal": (
        "Soft tonal reveal sound, single warm note with brief decay, "
        "subtle and clean, no music",
        1, 0.55,
    ),
    "count up number": (
        "Mechanical counter ticking up, rapid sequence of soft clicks, "
        "ending on a final tick, 1.5 seconds",
        2, 0.55,
    ),
    "chart bars grow": (
        "Soft rising tonal sweep, like data bars growing, 1 second",
        1, 0.50,
    ),

    # ── UI / button / interaction events ────────────────────────────
    "button_appear": (
        "Soft pop, single tactile button press, brief and bouncy, "
        "dry recording, no music",
        1, 0.45,
    ),
    "element_appear": (
        "Single soft bell tone, gentle reveal, brief decay, dry recording",
        1, 0.45,
    ),
    "pop_in": (
        "Single soft pop, bouncy and brief, like a UI element appearing, "
        "dry recording",
        1, 0.55,
    ),
    "pulse": (
        "Single soft UI click, tactile button feedback, very brief, "
        "no decay tail",
        1, 0.40,
    ),
    "button": (
        "Single soft button click, tactile and warm, very brief",
        1, 0.45,
    ),
    "click": (
        "Single sharp UI click, button press, brief and clean",
        1, 0.45,
    ),

    # ── Slide / movement / reveal events ────────────────────────────
    "slide_in": (
        "Soft paper sliding sound, gentle whoosh, like a card sliding "
        "into place, brief, dry recording",
        1, 0.40,
    ),
    "list_reveal": (
        "Sequence of three soft bell tones in quick succession, "
        "gentle ascending pitch, dry recording",
        2, 0.45,
    ),
    "fadein": (
        "Single soft bell tone, very gentle, brief decay",
        1, 0.40,
    ),

    # ── Drawing / annotation events ─────────────────────────────────
    "underline_draw": (
        "Pen drawing a line on paper, soft graphite scratch, "
        "ending as the line completes, 1 second, dry recording",
        1, 0.50,
    ),
    "annotate": (
        "Pen on paper, soft drawing scratch, brief writing sound, "
        "dry recording",
        1, 0.50,
    ),
    "highlight": (
        "Soft highlighter marker stroke on paper, brief swoosh, dry recording",
        1, 0.50,
    ),
    "highlight callout": (
        "Single warm impact, soft and supportive, no metallic ring, "
        "brief decay, dry recording",
        1, 0.60,
    ),

    # ── Positive / confirmation events ──────────────────────────────
    "checkmark": (
        "Single warm bell tone, positive confirmation chime, brief tail, "
        "dry recording, no music",
        1, 0.55,
    ),
    "checkmark appear": (
        "Single warm bell tone, positive confirmation chime, dry recording",
        1, 0.55,
    ),
    "success": (
        "Two-note ascending bell motif, warm and positive, brief, "
        "dry recording, no music",
        1, 0.55,
    ),

    # ── Negative / error events ─────────────────────────────────────
    "error": (
        "Single low descending tone, gentle negative feedback, brief, "
        "not harsh, dry recording",
        1, 0.50,
    ),
    "warning": (
        "Single soft warning tone, mid-frequency, brief, not alarming",
        1, 0.45,
    ),
}


# Defaults when label is missing or unmapped — fall back by role.
ROLE_DEFAULT_PROMPT: Dict[str, LabelDef] = {
    "ui_click": (
        "Single soft UI button click, tactile feedback, very brief",
        1, 0.45,
    ),
    "ui_chime": (
        "Single soft bell tone, brief decay, gentle and clean",
        1, 0.45,
    ),
    "ui_positive": (
        "Single warm chime, positive confirmation, brief tail",
        1, 0.55,
    ),
    "ui_negative": (
        "Single low descending tone, gentle, brief, not harsh",
        1, 0.50,
    ),
    "data_reveal": (
        "Soft tonal reveal, single warm note, brief decay",
        1, 0.55,
    ),
    "impact": (
        "Single warm impact, soft and supportive, brief decay, "
        "dry recording, no metallic ring",
        1, 0.60,
    ),
    # Transitions are NO LONGER emitted by sound_planner — the entries
    # below exist only so a stray legacy cue doesn't crash the planner.
    "transition_whoosh": (
        "Soft paper rustle, brief and gentle, dry recording",
        1, 0.40,
    ),
    "transition_riser": (
        "Soft rising tone, gentle pitch sweep upward, 1 second",
        1, 0.45,
    ),
}


def _resolve_prompt_for_cue(cue: Dict[str, Any]) -> Optional[LabelDef]:
    """Find the cassetteai prompt + duration + volume for a cue.

    Priority:
      1. Exact `label` match in LABEL_TO_PROMPT (GSAP scanner label like
         "typewriter" or "bar_grow", or normalized Director action).
      2. Partial label match (e.g. "annotate title with underline" →
         starts with "annotate" → use annotate prompt).
      3. role fallback in ROLE_DEFAULT_PROMPT.
      4. None → caller keeps the cue's static library URL.
    """
    label = (cue.get("label") or "").strip().lower()
    role = (cue.get("role") or "").strip().lower()

    if label:
        # Exact match.
        if label in LABEL_TO_PROMPT:
            return LABEL_TO_PROMPT[label]
        # Prefix match — Director actions are free-form ("annotate title
        # with underline"). Try the first token / phrase.
        first_word = label.split()[0] if label.split() else ""
        if first_word and first_word in LABEL_TO_PROMPT:
            return LABEL_TO_PROMPT[first_word]
        # Substring match — last resort before role fallback.
        for key in LABEL_TO_PROMPT:
            if key in label or label.startswith(key.split()[0]):
                return LABEL_TO_PROMPT[key]

    if role and role in ROLE_DEFAULT_PROMPT:
        return ROLE_DEFAULT_PROMPT[role]
    return None


# ──────────────────────────────────────────────────────────────────────
# fal client loader — lazy + filesystem fallback
# ──────────────────────────────────────────────────────────────────────

def _load_fal_client():
    """Lazy-import the cassetteai client. Returns (ClientClass, api_key_fn)
    or (None, None) when the module isn't importable (e.g. test runs)."""
    try:
        from app.services.fal_cassetteai_client import (  # type: ignore
            FalCassetteAIClient, get_fal_api_key_from_env,
        )
        return FalCassetteAIClient, get_fal_api_key_from_env
    except ImportError:
        pass
    import importlib.util as _ilu
    import sys as _sys
    services_dir = Path(__file__).resolve().parent.parent / "services"
    fal_path = services_dir / "fal_cassetteai_client.py"
    if not fal_path.exists():
        return None, None
    spec = _ilu.spec_from_file_location("fal_cassetteai_client", fal_path)
    mod = _ilu.module_from_spec(spec)  # type: ignore
    _sys.modules.setdefault("fal_cassetteai_client", mod)
    spec.loader.exec_module(mod)  # type: ignore
    return mod.FalCassetteAIClient, mod.get_fal_api_key_from_env


# ──────────────────────────────────────────────────────────────────────
# Public entry point
# ──────────────────────────────────────────────────────────────────────

def enrich_cues(
    entries: List[Dict[str, Any]],
    *,
    mood: Optional[str] = None,          # noqa: ARG001  (reserved for future use)
    script: Any = None,                  # noqa: ARG001  (reserved for future use)
    tier_config: Optional[Dict[str, Any]] = None,
    cost_tracker: Any = None,
    run_dir: Optional[Path] = None,
    s3_uploader: Optional[Callable[[bytes, str], str]] = None,
    video_id: str = "",
    seed: Optional[int] = None,          # noqa: ARG001  (no rng needed for label-driven)
    max_variants_per_role: int = 5,      # noqa: ARG001  (legacy back-compat)
) -> Dict[str, int]:
    """Replace static-library URLs with cassetteai-generated SFX matched
    to each cue's `label` (event kind).

    Caching: identical (label, duration) generates ONCE per video. A
    typewriter event in shot 2 and another in shot 5 reuse the same audio.
    Cost: ~$0.01 × unique-labels-in-video. For a typical 6-event video
    that's $0.03-0.06.

    Returns {label: replaced_count} for observability.
    Returns {} silently when generation isn't applicable.
    """
    # ── Tier gate ───────────────────────────────────────────────────
    if tier_config is not None:
        if not tier_config.get("sound_enabled", True):
            _log.info("[sfx-palette] sound disabled by tier — keeping static")
            return {}
        if not tier_config.get("sfx_generation_enabled", False):
            _log.info("[sfx-palette] sfx_generation_enabled=False — static lib")
            return {}

    # ── Collect cues that have a resolvable prompt ─────────────────
    plan: List[Tuple[Dict[str, Any], LabelDef]] = []  # (cue, prompt_def)
    for entry in entries:
        for cue in entry.get("sound_cues") or []:
            pd = _resolve_prompt_for_cue(cue)
            if pd is not None:
                plan.append((cue, pd))
    if not plan:
        _log.info("[sfx-palette] no cues with resolvable prompts — skipping")
        return {}

    # ── Resolve fal client ─────────────────────────────────────────
    FalCassetteAIClient, get_fal_api_key_from_env = _load_fal_client()
    if FalCassetteAIClient is None:
        _log.info("[sfx-palette] cassetteai client unavailable — keeping static")
        return {}
    api_key = get_fal_api_key_from_env()
    if not api_key:
        _log.info("[sfx-palette] FAL_API_KEY not set — keeping static")
        return {}

    cache_dir = (run_dir / "_sfx_cache") if run_dir is not None else None
    client = FalCassetteAIClient(api_key=api_key, cache_dir=cache_dir)

    _log.info(
        "[sfx-palette] cassetteai gen for %d cues; unique labels=%d",
        len(plan),
        len({(p[1][0][:40], p[1][1]) for p in plan}),  # dedup by (prompt, duration)
    )

    # ── Generate (with in-run prompt-level dedup for cost control) ──
    # In addition to the disk SHA cache inside the client, dedup at THIS
    # call so two cues with the same prompt+duration share the same
    # AudioResult without two client.submit calls. The client's hash
    # cache would catch it too on the second call, but skipping the
    # network round-trip entirely is cheaper.
    by_request: Dict[Tuple[str, int], Any] = {}  # (prompt, duration) → AudioResult
    replaced: Dict[str, int] = defaultdict(int)

    # Track per-cue per-prompt failure so a failed (prompt, duration)
    # doesn't trigger N successive submit calls.
    failed_keys: set = set()
    dropped_count = 0

    for cue_idx, (cue, prompt_def) in enumerate(plan):
        prompt_text, duration_int, vol_mul = prompt_def
        cache_key_local = (prompt_text, duration_int)
        result = by_request.get(cache_key_local)

        if cache_key_local in failed_keys:
            # Previous cue with this exact prompt already failed — don't
            # retry; drop the cue so the mixer doesn't ship the
            # original library URL (which is the UI/mouse-button sound
            # we worked to escape from).
            cue["url"] = ""
            dropped_count += 1
            continue

        if result is None:
            try:
                result = client.submit(
                    prompt_text,
                    duration_s=float(duration_int),
                    proactively_download=True,
                )
            except Exception as e:
                _log.warning(
                    "[sfx-palette] cassetteai submit failed cue=%d label=%r: %s",
                    cue_idx, cue.get("label"), e,
                )
                # Drop the cue rather than keeping the static-library URL
                # — silence is correct when the intended fresh-gen failed.
                # Audio_mixer's download_cues_to_disk skips cues with no URL.
                cue["url"] = ""
                failed_keys.add(cache_key_local)
                dropped_count += 1
                continue
            by_request[cache_key_local] = result

        if not result.audio_bytes and not result.url:
            _log.warning(
                "[sfx-palette] cassetteai returned no audio cue=%d — dropping",
                cue_idx,
            )
            cue["url"] = ""
            failed_keys.add(cache_key_local)
            dropped_count += 1
            continue

        # Resolve a URL (or local path) the mixer can read.
        url_out: Optional[str] = None
        if s3_uploader is not None and result.audio_bytes:
            try:
                key = f"ai-videos/{video_id}/sfx/{cue.get('id', f'cue_{cue_idx}')}.wav"
                url_out = s3_uploader(result.audio_bytes, key)
            except Exception as e:
                _log.warning(
                    "[sfx-palette] S3 upload failed cue=%d: %s", cue_idx, e,
                )
        if url_out is None and result.audio_bytes and cache_dir is not None:
            try:
                cache_dir.mkdir(parents=True, exist_ok=True)
                local_path = cache_dir / f"sfx_{cue_idx:03d}_{cache_key_local[0][:30].replace(' ', '_')}.wav"
                local_path.write_bytes(result.audio_bytes)
                url_out = str(local_path)
            except OSError as e:
                _log.warning("[sfx-palette] local persist failed: %s", e)
        if url_out is None:
            url_out = result.url
        if not url_out:
            # Neither S3 upload, local persist, nor URL fell back —
            # drop the cue (silence > funny library URL).
            cue["url"] = ""
            dropped_count += 1
            continue

        cue["url"] = url_out
        # Reflect the cassetteai-prescribed volume so the mixer doesn't
        # use the sound_planner's library-tuned default.
        cue["volume"] = round(min(1.0, vol_mul), 3)
        # Tag the cue with the duration so the mixer can plan adelay tails.
        cue["duration"] = float(duration_int)

        label_key = (cue.get("label") or cue.get("role") or "unknown")
        replaced[str(label_key)] += 1

        if cost_tracker is not None and not result.cache_hit:
            try:
                cost_tracker.record_sfx(
                    stage=f"sfx_{label_key}",
                    model="cassetteai/sound-effects-generator",
                    duration_s=float(duration_int),
                    cost_usd=float(result.cost_usd or 0.01),
                )
            except Exception:
                pass

    total = sum(replaced.values())
    _log.info(
        "[sfx-palette] replaced %d cues across %d unique labels "
        "(api_calls=%d, dropped=%d)",
        total, len(replaced),
        sum(1 for r in by_request.values() if not r.cache_hit),
        dropped_count,
    )
    return dict(replaced)


# ──────────────────────────────────────────────────────────────────────
# Back-compat shim — old transition-stinger entry point. Now no-ops
# since transitions don't get auto-cues anymore. Kept so existing
# callers don't break.
# ──────────────────────────────────────────────────────────────────────

def enrich_transitions_with_fresh_stingers(
    entries: List[Dict[str, Any]],
    **kwargs: Any,
) -> int:
    """Legacy entrypoint. Transitions are no longer auto-emitted by the
    planner (2026-05 demolition), so this is a no-op kept for back-compat.
    Callers should migrate to `enrich_cues`."""
    return 0
