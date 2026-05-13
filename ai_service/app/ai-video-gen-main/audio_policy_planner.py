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
)

# Shot types where `intrinsic_only` is the only sensible policy when audio is on.
# AI_VIDEO_HERO with Veo audio is the canonical case (Phase 3 ships the shot type).
# SOURCE_CLIP can adopt this later when source-clip-with-VO support lands.
_INTRINSIC_AUDIO_CAPABLE_SHOT_TYPES: Tuple[str, ...] = (
    "AI_VIDEO_HERO",
    # "SOURCE_CLIP",  # future — uncomment when source-clip native VO ships
)


# ---------------------------------------------------------------------------
# Stub implementation (Phase 2)
# ---------------------------------------------------------------------------

def plan_audio_policy(
    shots: List[Dict[str, Any]],
    *,
    ai_video_audio_enabled: bool = False,
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
            counts[existing] = counts.get(existing, 0) + 1
            continue
        policy = _decide_policy(shot, ai_video_audio_enabled=ai_video_audio_enabled)
        shot["audio_policy"] = policy
        counts[policy] = counts.get(policy, 0) + 1
    if log_fn is not None:
        summary = ", ".join(f"{k}={v}" for k, v in counts.items() if v > 0)
        log_fn(f"🎚️  Audio policy: {summary}")
    return shots


def _decide_policy(shot: Dict[str, Any], *, ai_video_audio_enabled: bool) -> str:
    """Per-shot decision logic. Phase 2 stub: only ever returns
    `narration_only` or `intrinsic_only`.

    Promotion to `intrinsic_only` requires ALL of:
      - run-level `ai_video_audio_enabled` is True
      - shot_type is in the intrinsic-capable list (currently just AI_VIDEO_HERO)
      - the Director explicitly opted in via `ai_video_audio=True` on this shot
    """
    if not ai_video_audio_enabled:
        return "narration_only"
    shot_type = str(shot.get("shot_type") or "").strip().upper()
    if shot_type not in _INTRINSIC_AUDIO_CAPABLE_SHOT_TYPES:
        return "narration_only"
    if not shot.get("ai_video_audio"):
        return "narration_only"
    return "intrinsic_only"


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
