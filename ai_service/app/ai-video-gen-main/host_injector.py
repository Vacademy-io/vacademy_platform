"""Post-hoc host_present injector — guarantees the user's host_pct target
is honored regardless of where the shot plan came from.

Why this exists
---------------
Three paths produce a shot plan today, and none of them reliably respect
host config:

  1. v3 ShotPlanner (`shot_planner.plan_shots`) — has NO host_pct
     parameter. Always emits shots without host_present markers.
  2. v2 Director (`_run_director`) — does see the HOST_DIRECTOR_EXTENSION,
     but the prompt's exclusion rules ("VIDEO_HERO / KINETIC_TITLE /
     diagrams stay host_present=false") can zero out host coverage for
     a video whose plan is dominated by those types.
  3. Resumed runs — the cached `shot_plan.json` or in-memory v3 plan
     skips Director entirely; if host config wasn't applied when the
     plan was first cached, it can't retroactively flow through Director.

The injector runs AFTER any of these paths produces shots. It:
  - Computes the target host count from host_pct
  - Selects which shots get host_present=true by priority (bookends,
    emphasis, then fill)
  - Stamps host_layout + host_image_prompt with sensible defaults derived
    from shot_type
  - Respects `user_authored_no_host_indices` (frames the user explicitly
    marked text-only)
  - Idempotent: counts existing host_present shots first; only TOPS UP
    when below target (Director-emitted host placements are preserved).

Why it's its own module
-----------------------
Director's host logic is intertwined with the prompt-building flow. v3
ShotPlanner's host integration would be a multi-week LLM-prompt project
(risk: regressing shot quality to teach the planner about host). This
module is a 200-LOC deterministic enforcer that guarantees the user
gets what they paid for without touching either planner's prompt.

Public API: `inject_host_presence(shots, host_pct, ...) -> int`
returns the number of shots newly marked host_present=true.
"""
from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Set

logger = logging.getLogger(__name__)


# Keywords that mean "no avatar/host on this frame" when present in a
# user-authored FRAME N block. Lowercased before matching.
_NO_HOST_KEYWORDS = (
    "no imagery", "no images", "no image",
    "text only", "text-only",
    "pure typography", "typography only",
    "graphics only", "no person", "no people",
    "no host", "no avatar", "no faces",
    "no photo", "no photographs",
)

# Matches `FRAME 1`, `FRAME 2 — 0:00 to 0:05`, etc. and captures the
# body until the next FRAME marker (or end-of-string).
_FRAME_BLOCK_RE = re.compile(
    r"FRAME\s+(\d+)[^\n]*\n((?:(?!FRAME\s+\d+).)*?)(?=FRAME\s+\d+|\Z)",
    re.IGNORECASE | re.DOTALL,
)


def compute_no_host_indices_from_prompt(base_prompt: str) -> List[int]:
    """Scan a user-authored frame-by-frame prompt for "no host on this
    frame" directives. Returns 0-indexed shot indices (user prompts are
    1-indexed; we shift). Returns [] when:
      - base_prompt is empty
      - prompt has no `FRAME N` blocks (i.e. wasn't user-authored)
      - no block contains a no-host keyword

    Shared helper extracted from `_run_director`'s host prep — both the
    v2 Director path AND the host_injector use it so v3 runs also honor
    the user's per-frame deny list.
    """
    if not base_prompt:
        return []
    found: List[int] = []
    try:
        blocks = _FRAME_BLOCK_RE.findall(base_prompt)
        for frame_num_s, body in blocks:
            body_lo = body.lower()
            if any(kw in body_lo for kw in _NO_HOST_KEYWORDS):
                try:
                    idx0 = int(frame_num_s) - 1
                    if idx0 >= 0:
                        found.append(idx0)
                except ValueError:
                    continue
    except Exception:
        # Scanning is best-effort. Bad regex on unusual content shouldn't
        # block the render — just return whatever we found so far.
        pass
    return sorted(set(found))


# Default host_image_prompt when none is on the shot. Generic but
# sufficient — the actual avatar generator (FalAvatarClient) treats this
# as a soft hint; the user's reference face image dominates. Keep this
# under 200 chars so the image-gen prompt stays focused.
_DEFAULT_HOST_IMAGE_PROMPT = (
    "Close-up portrait, host looking just past camera, "
    "soft blurred background suggesting an office, professional framing."
)

# Layout selection by shot_type. The choice is driven by what the shot's
# visual ALREADY commits to:
#   - centered     → host owns the full frame (no other visuals)
#   - free_left    → host on RIGHT, overlay graphics on LEFT half
#   - free_right   → host on LEFT, overlay graphics on RIGHT half
#   - free_top     → host on BOTTOM, banner / data on TOP
#   - free_bottom  → host on TOP, lower-third on BOTTOM
#
# Portrait orientation forces top/bottom layouts (left/right halves are
# too narrow on 1080-wide). Landscape can use any. The caller passes
# `is_portrait` so we pick the right vocabulary.
_LANDSCAPE_LAYOUT_BY_SHOT_TYPE: Dict[str, str] = {
    # Title / typography — host shares the frame with text on one side.
    "KINETIC_TITLE":    "free_right",
    "KINETIC_TEXT":     "free_right",
    # Hero / video / image — host overlays as a presenter in lower-third.
    # `free_bottom` keeps the hero image visible above while the host
    # sits in a smaller bottom strip — less competition than centered.
    "AI_VIDEO_HERO":    "free_bottom",
    "VIDEO_HERO":       "free_bottom",
    "IMAGE_HERO":       "free_bottom",
    "IMAGE_SPLIT":      "free_right",
    "SOURCE_CLIP":      "free_bottom",
    # Data / diagram — host on one side, content on the other half.
    "DATA_STORY":       "free_right",
    "EQUATION_BUILD":   "free_right",
    "PROCESS_STEPS":    "free_right",
    "TEXT_DIAGRAM":     "free_right",
    "INFOGRAPHIC_SVG":  "free_right",
    "ANNOTATION_MAP":   "free_right",
    "LOWER_THIRD":      "free_top",   # overlay sits on bottom by name
    "PRODUCT_HERO":     "free_bottom",
}

_PORTRAIT_LAYOUT_BY_SHOT_TYPE: Dict[str, str] = {
    "KINETIC_TITLE":    "free_top",
    "KINETIC_TEXT":     "free_top",
    "AI_VIDEO_HERO":    "free_bottom",
    "VIDEO_HERO":       "free_bottom",
    "IMAGE_HERO":       "free_bottom",
    "IMAGE_SPLIT":      "free_top",
    "SOURCE_CLIP":      "free_bottom",
    "DATA_STORY":       "free_top",
    "EQUATION_BUILD":   "free_top",
    "PROCESS_STEPS":    "free_top",
    "TEXT_DIAGRAM":     "free_top",
    "INFOGRAPHIC_SVG":  "free_top",
    "ANNOTATION_MAP":   "free_top",
    "LOWER_THIRD":      "free_top",
    "PRODUCT_HERO":     "free_bottom",
}

_FALLBACK_LANDSCAPE_LAYOUT = "free_right"
_FALLBACK_PORTRAIT_LAYOUT = "free_top"


def _resolve_layout(shot: Dict[str, Any], *, is_portrait: bool,
                    is_bookend: bool) -> str:
    """Pick host_layout for a shot.

    `is_bookend` (hook or final shot) forces `centered` since those beats
    are about the host themselves — no diagram should fight the moment.
    Otherwise we read shot_type and pick from the orientation-appropriate
    table, falling back to a safe default if shot_type is missing.
    """
    if is_bookend:
        return "centered"

    shot_type = (shot.get("shot_type") or "").strip().upper()
    table = (_PORTRAIT_LAYOUT_BY_SHOT_TYPE if is_portrait
             else _LANDSCAPE_LAYOUT_BY_SHOT_TYPE)
    fallback = (_FALLBACK_PORTRAIT_LAYOUT if is_portrait
                else _FALLBACK_LANDSCAPE_LAYOUT)
    return table.get(shot_type, fallback)


def _shot_emphasis_score(shot: Dict[str, Any]) -> float:
    """Higher = more important to have host on. Used to pick which shots
    get host coverage when host_pct < 100. Heuristic stack:

      +10 for high-emphasis sync_points (energy_spike words)
      + 5 for first-person / opinion language in the narration
      + 3 for non-diagram shot types (host fights less with the visual)
      + duration_s × 0.5 (longer shots — host more visible)
    """
    score = 0.0
    sp = shot.get("sync_points") or []
    if isinstance(sp, list):
        for p in sp:
            if not isinstance(p, dict):
                continue
            if (p.get("emphasis") or "").lower() in ("energy_spike", "high"):
                score += 10
                break

    narration = (shot.get("narration_excerpt") or shot.get("narration_text")
                 or shot.get("narration") or "")
    narration_lo = str(narration).lower()
    if any(p in narration_lo for p in
           ("i think", "i believe", "let me", "you'll see",
            "we're going", "we are going", "i'll show")):
        score += 5

    shot_type = (shot.get("shot_type") or "").upper()
    if shot_type not in {
        "DATA_STORY", "EQUATION_BUILD", "PROCESS_STEPS",
        "TEXT_DIAGRAM", "INFOGRAPHIC_SVG", "ANNOTATION_MAP",
    }:
        score += 3

    try:
        st = float(shot.get("start_time", 0) or 0)
        en = float(shot.get("end_time", 0) or 0)
        score += max(0.0, (en - st) * 0.5)
    except (TypeError, ValueError):
        pass

    return score


def _select_indices_for_host(
    shots: List[Dict[str, Any]],
    *,
    target_count: int,
    no_host_indices: Set[int],
) -> Set[int]:
    """Pick which shot indices to mark host_present=true.

    Priority (rewritten 2026-05 after the audit caught Director-choices
    being overridden by bookends):

      1. Existing Director-emitted host placements take precedence —
         Director already considered emphasis + hook/CTA rules when
         picking; we trust those choices.
      2. If Director's choices already MEET OR EXCEED the target, trim
         the lowest-emphasis ones down to target. Bookends are NOT
         force-added in this case (we respect Director's full plan).
      3. If Director's choices fall UNDER target, top up:
            a. Bookends (shot 0, shot n-1) — hook + CTA defaults
            b. Remaining slots filled by descending emphasis score
      4. Deny-listed indices never get selected.

    Returns the set of selected indices.
    """
    n = len(shots)
    if n == 0 or target_count <= 0:
        return set()

    eligible = set(range(n)) - no_host_indices
    existing_host = {i for i in eligible if shots[i].get("host_present")}

    # Case 1 & 2: Director already met/exceeded the target.
    if len(existing_host) >= target_count:
        if len(existing_host) == target_count:
            return existing_host
        # More than target — drop lowest-emphasis to fit. Director
        # over-allocated; trim from the bottom rather than from the
        # front/back so mid-video coverage stays balanced.
        scored = sorted(
            existing_host,
            key=lambda i: _shot_emphasis_score(shots[i]),
            reverse=True,
        )
        return set(scored[:target_count])

    # Case 3: under target. Keep Director's choices and top up.
    selected: Set[int] = set(existing_host)

    # 3a — bookends.
    if 0 in eligible and 0 not in selected:
        selected.add(0)
    if (n - 1) in eligible and (n - 1) not in selected:
        selected.add(n - 1)

    if len(selected) >= target_count:
        # Bookends pushed us to target — trim back to target by keeping
        # the highest-emphasis selection (still favors Director's choices
        # since they're in `selected`).
        if len(selected) > target_count:
            scored = sorted(
                selected, key=lambda i: _shot_emphasis_score(shots[i]),
                reverse=True,
            )
            return set(scored[:target_count])
        return selected

    # 3b — fill the remaining slots by descending emphasis.
    remaining = [
        (i, _shot_emphasis_score(shots[i]))
        for i in eligible
        if i not in selected
    ]
    remaining.sort(key=lambda x: x[1], reverse=True)
    for i, _ in remaining:
        if len(selected) >= target_count:
            break
        selected.add(i)
    return selected


def inject_host_presence(
    shots: List[Dict[str, Any]],
    *,
    host_pct: int,
    is_portrait: bool = False,
    no_host_indices: Optional[Set[int]] = None,
    default_host_image_prompt: Optional[str] = None,
) -> int:
    """Stamp host_present + host_layout + host_image_prompt on shots
    to meet the target host_pct. Returns the number of NEW host shots
    added (does not count shots that already had host_present=true).

    Idempotent — re-running on a plan that already meets target is a
    no-op (returns 0). Director-emitted placements are preserved.

    Args:
        shots: list of shot dicts. Mutated in place.
        host_pct: target percentage (0-100). Below 1 → no-op.
        is_portrait: orientation (drives layout vocabulary).
        no_host_indices: shot indices the caller explicitly forbids
            host on (from user-authored "no imagery" frames).
        default_host_image_prompt: override for the default prompt
            stamped on shots that don't already have one. When None,
            uses `_DEFAULT_HOST_IMAGE_PROMPT`.
    """
    if not shots:
        return 0
    pct = max(0, min(100, int(host_pct or 0)))
    if pct < 1:
        return 0

    deny = set(no_host_indices or [])
    n = len(shots)
    target = max(1, int(round(n * pct / 100.0)))
    # When pct is 100, ALL shots get host (subject only to deny-list).
    if pct >= 100:
        target = n - len(deny & set(range(n)))

    selected = _select_indices_for_host(
        shots,
        target_count=target,
        no_host_indices=deny,
    )

    image_prompt_default = default_host_image_prompt or _DEFAULT_HOST_IMAGE_PROMPT
    n_added = 0

    for i, shot in enumerate(shots):
        # Honor deny list — explicitly flip off if marked there.
        if i in deny:
            if shot.get("host_present"):
                shot["host_present"] = False
                shot.pop("host_layout", None)
                shot.pop("host_image_prompt", None)
            continue

        if i in selected:
            was_present = bool(shot.get("host_present"))
            shot["host_present"] = True
            # Resolve layout if missing OR if it's blank.
            layout = (shot.get("host_layout") or "").strip()
            if not layout:
                is_bookend = (i == 0 or i == n - 1)
                shot["host_layout"] = _resolve_layout(
                    shot, is_portrait=is_portrait, is_bookend=is_bookend,
                )
            # Fill image prompt if missing.
            if not (shot.get("host_image_prompt") or "").strip():
                shot["host_image_prompt"] = image_prompt_default
            if not was_present:
                n_added += 1
        else:
            # Not selected — make sure host fields are absent.
            if shot.get("host_present"):
                shot["host_present"] = False
                shot.pop("host_layout", None)
                shot.pop("host_image_prompt", None)

    logger.info(
        "[host_injector] target=%d/%d shots (pct=%d%%) → added %d, "
        "total host_present=%d (deny=%s)",
        target, n, pct, n_added,
        sum(1 for s in shots if s.get("host_present")),
        sorted(deny) or "[]",
    )
    return n_added
