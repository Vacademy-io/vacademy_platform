"""AudioPolicyPlanner — Phase 2 stub, Phase 5 full implementation.

Decides per-shot `audio_policy` after the Director plans shots and BEFORE
per-shot TTS runs. The policy controls how master narration interacts with
each shot's intrinsic audio (Veo clip audio, source clip native VO, etc.).

Phase 2 ships only the STUB — every shot gets `narration_only` (today's
implicit behavior). The stage exists so the v2 pipeline order is correct;
the real per-shot decision logic lands in Phase 5 when AI video audio
becomes user-visible.

Why a stage instead of a per-Director decision: source clips, uploaded
videos, and future music-driven moments all need the same primitive
("narration silent here, intrinsic audio plays"). Centralizing the
decision keeps the Director focused on visual planning.

Public API
----------
- `plan_audio_policy(shots, *, ai_video_audio_enabled=False, ...)` —
  returns the input shots list with `audio_policy` set on each.
  Idempotent: if a shot already has `audio_policy`, the existing value is
  respected (Director may pre-emptively mark shots).
- `AUDIO_POLICIES`: enumeration of supported policy values.

Off-by-default — fires only inside the v2 pipeline branch (gated by
`tts_per_shot_enabled` + `beat_planner_enabled` flags on the tier).
"""
from __future__ import annotations

from typing import Any, Dict, List, Tuple


# ---------------------------------------------------------------------------
# Enumeration
# ---------------------------------------------------------------------------

# Phase 1-2 policies (the ones the stub assigns):
#   - narration_only:  master TTS plays; any intrinsic audio is muted (today's behavior)
#   - intrinsic_only:  master TTS silent in this window; intrinsic audio plays alone
#
# Phase 5+ policies (declared here so the enum is stable, but the stub never
# returns them):
#   - intrinsic_under_narration: master TTS full; intrinsic plays underneath at low volume
#   - narration_over_intrinsic:  master TTS full; intrinsic ducks during narration spans
AUDIO_POLICIES: Tuple[str, ...] = (
    "narration_only",
    "intrinsic_only",
    "intrinsic_under_narration",
    "narration_over_intrinsic",
    # Drama redesign: silent CHARACTER clip (cast acts, doesn't speak) with the
    # master narrator playing OVER it — the clip is muted. MUST be listed here
    # or plan_audio_policy's "respect an existing valid policy" guard fails and
    # resets it to narration_only, which would make _is_silent_character_scene
    # miss and demote the shot back to stock. Behaves like narration_only for
    # the mixer (narrator plays, no silent gap) — the muting happens in
    # build_ai_video_html + the per-shot TTS branch, keyed off the value.
    "narration_over_clip",
)

# Shot types whose audio comes from the shot's own video track (not master
# narration). When promoted to `intrinsic_only`, per-shot TTS skips them
# (silent gap in master) so the shot's native audio plays alone.
#
# - AI_VIDEO_HERO: Veo's `generate_audio=true` produced sound; orchestrator
#   emits `<video unmuted>` so the browser plays it during render capture.
# - SOURCE_CLIP: user-uploaded video has its own audio. Gated on the
#   run-level `mute_tts_on_source_clips` toggle to preserve legacy
#   behavior (TTS-plays-over-source is the default for marketing-style
#   videos).
_INTRINSIC_AUDIO_CAPABLE_SHOT_TYPES: Tuple[str, ...] = (
    "AI_VIDEO_HERO",
    "SOURCE_CLIP",
)


# ---------------------------------------------------------------------------
# Stub implementation (Phase 2)
# ---------------------------------------------------------------------------

def plan_audio_policy(
    shots: List[Dict[str, Any]],
    *,
    ai_video_audio_enabled: bool = False,
    mute_tts_on_source_clips: bool = False,
    log_fn=None,
) -> List[Dict[str, Any]]:
    """Assign `audio_policy` to every shot in-place and return the list.

    Phase 2 contract:
      - Every shot gets `audio_policy` set (default `narration_only`).
      - If a shot already carries `audio_policy` from the Director, it's
        respected (allows the Director to force a policy when it knows
        the audio intent).
      - When `ai_video_audio_enabled=True`, AI_VIDEO_HERO shots whose
        Director-emitted `ai_video_audio=True` get `intrinsic_only`.
        Otherwise they stay `narration_only` (Veo runs with
        `generate_audio=false`, cheaper $0.03/s tier).
      - When `mute_tts_on_source_clips=True`, SOURCE_CLIP shots get
        `intrinsic_only` so the user-uploaded video's native audio plays
        alone (per-shot TTS skips the shot; master narration is silent
        in that window). This unifies the legacy run-level mute flag
        with the v2 per-shot audio_policy system.
      - Empty `narration_text` on a shot (e.g. a moment beat) does NOT
        auto-promote to `intrinsic_only` — that's the Director's call,
        not this stage's. Silent narration with `narration_only` policy
        just means a silent gap in master narration during that shot.

    The function mutates each shot dict in place AND returns the list, so
    callers can use whichever style fits. The list reference is unchanged.

    `log_fn` (optional): a callable receiving a single string for telemetry.
    When None, no logging.
    """
    if not shots:
        return shots
    counts: Dict[str, int] = {p: 0 for p in AUDIO_POLICIES}
    for shot in shots:
        if not isinstance(shot, dict):
            continue
        existing = shot.get("audio_policy")
        if isinstance(existing, str) and existing in AUDIO_POLICIES:
            # DEAD-AIR GUARD: `intrinsic_only` promises the SHOT carries its
            # own audio. An AI_VIDEO_HERO shot can only do that when the run
            # generates Veo audio; with audio off the clip is rendered mute
            # AND per-shot TTS skips the window (narration_text is blanked
            # for intrinsic shots) → total silence for the shot's duration.
            # The planner is explicitly invited to pick intrinsic_only for
            # "pure visual moments", so this is reachable on any narrated
            # AI-video run. Demote to narration_only so the narrator plays.
            if (
                existing == "intrinsic_only"
                and not ai_video_audio_enabled
                and str(shot.get("shot_type") or "").upper() == "AI_VIDEO_HERO"
            ):
                shot["audio_policy"] = "narration_only"
                counts["narration_only"] = counts.get("narration_only", 0) + 1
                if log_fn:
                    log_fn(
                        f"   🔇→🗣 shot {shot.get('shot_index')}: AI_VIDEO_HERO asked for "
                        "intrinsic_only but run audio is OFF (clip would be silent) — "
                        "using narration_only"
                    )
                continue
            counts[existing] = counts.get(existing, 0) + 1
            continue
        policy = _decide_policy(
            shot,
            ai_video_audio_enabled=ai_video_audio_enabled,
            mute_tts_on_source_clips=mute_tts_on_source_clips,
        )
        shot["audio_policy"] = policy
        counts[policy] = counts.get(policy, 0) + 1
    if log_fn is not None:
        summary = ", ".join(f"{k}={v}" for k, v in counts.items() if v > 0)
        log_fn(f"🎚️  Audio policy: {summary}")
    return shots


def _decide_policy(
    shot: Dict[str, Any],
    *,
    ai_video_audio_enabled: bool,
    mute_tts_on_source_clips: bool = False,
) -> str:
    """Per-shot decision logic. Phase 2 stub: only ever returns
    `narration_only` or `intrinsic_only`.

    Promotion to `intrinsic_only` requires:
      - AI_VIDEO_HERO path: run-level `ai_video_audio_enabled=True` AND
        the Director opted in via `ai_video_audio=True` on this shot
      - SOURCE_CLIP path: run-level `mute_tts_on_source_clips=True`. All
        SOURCE_CLIP shots in such runs play their native audio alone
        (today this is a binary all-or-nothing run-level decision —
        Phase B+1 may add per-shot Director control)
    """
    shot_type = str(shot.get("shot_type") or "").strip().upper()
    if shot_type not in _INTRINSIC_AUDIO_CAPABLE_SHOT_TYPES:
        return "narration_only"
    if shot_type == "AI_VIDEO_HERO":
        if not ai_video_audio_enabled:
            return "narration_only"
        if not shot.get("ai_video_audio"):
            return "narration_only"
        return "intrinsic_only"
    if shot_type == "SOURCE_CLIP":
        if mute_tts_on_source_clips:
            return "intrinsic_only"
        return "narration_only"
    return "narration_only"


# ---------------------------------------------------------------------------
# Helpers exposed for tests / observability
# ---------------------------------------------------------------------------

def policy_summary(shots: List[Dict[str, Any]]) -> Dict[str, int]:
    """Return {policy: count} across a list of shots — useful for
    telemetry / log output without re-running the planner."""
    out: Dict[str, int] = {p: 0 for p in AUDIO_POLICIES}
    for s in shots:
        if not isinstance(s, dict):
            continue
        pol = s.get("audio_policy")
        if isinstance(pol, str):
            out[pol] = out.get(pol, 0) + 1
    return out


def shots_with_policy(
    shots: List[Dict[str, Any]], policy: str
) -> List[Dict[str, Any]]:
    """Filter to shots assigned `policy`. Useful for downstream stages
    (e.g. the concat helper wants to know which shots produce silent gaps
    so Veo audio can fill them)."""
    return [s for s in shots if isinstance(s, dict) and s.get("audio_policy") == policy]
