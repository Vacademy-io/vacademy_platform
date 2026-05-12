"""
Phase 2c — LLM-driven Director.

Generates a list of `OverlaySpec`s for a reel: hook text, mid-clip micro-hook,
loop-back ending, plus optional emphasis overlays tied to specific spoken
phrases. Captions and the base SOURCE_CLIP entry stay deterministic (they're
tied to `word_importance` + the speaker_clip MP4); this module only produces
the **storytelling overlay track** that the deterministic director was
hand-coding before.

Falls back gracefully:
  * No OPENROUTER_API_KEY → returns empty list, director uses deterministic
    hook overlay (the Phase-1 behavior).
  * LLM transport / parsing / validation failure → returns empty list (same
    fallback).
  * Spec validation strips invalid entries individually before returning, so
    one bad overlay doesn't nuke the rest.

The director (`reels_director_service.py`) is responsible for translating each
`OverlaySpec` into a `_Shot` with HTML appropriate to its `type` and
`color_intent`. That keeps the LLM focused on *what to say where* and lets the
deterministic side own *how it looks*.
"""
from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass
from typing import Any, Optional

import httpx

from ..config import get_settings

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------

# Disable via env if the LLM is misbehaving — falls back to the deterministic
# hook overlay, captions still ship as normal.
_DISABLE_ENV = "REELS_LLM_DIRECTOR_DISABLED"

_LLM_TIMEOUT_S = 30.0
_LLM_MODEL_ENV = "REELS_DIRECTOR_LLM_MODEL"
_LLM_DEFAULT_MODEL = "anthropic/claude-3-5-haiku"

# Spec validation bounds — matches research §12.2/§12.3 rules.
HOOK_MAX_END_S = 2.6              # hook is the 0..~2.5s window
MIN_OVERLAY_DURATION_S = 0.5      # too short = unreadable
MAX_OVERLAY_DURATION_S = 4.0      # too long = stale on screen
MAX_OVERLAY_WORDS = 6             # short-form ceiling for readability
MAX_OVERLAY_CHARS = 60            # belt-and-suspenders against runaway text

# Verbal-CTA opener list — overlays that telegraph "please follow me" kill
# the loop-back effect (research §12.2). Reject overlays whose text matches
# any of these substrings (case-insensitive).
CTA_KILL_PHRASES = (
    "follow ", "subscribe", "like this", "like and ", "smash that",
    "drop a comment", "let me know", "share this", "tag someone",
    "link in bio", "check the link", "hit follow",
)

# Allowed types — keep tight; FE/Director needs to know how to render each.
_OVERLAY_TYPES = {"hook", "micro_hook", "loop_back", "emphasis"}
# Allowed color intents — match the caption palette so the look stays cohesive.
_COLOR_INTENTS = {"neutral", "important", "definition", "warning"}


# ---------------------------------------------------------------------------
# Spec
# ---------------------------------------------------------------------------

@dataclass
class OverlaySpec:
    """One overlay text the director will turn into a `_Shot` entry.

    All times are in REEL TIMELINE seconds (post-trim, post-atempo) — the
    LLM is fed remapped word timestamps so it operates entirely in reel
    coordinates and never has to think about the source video's clock.
    """
    type: str             # "hook" | "micro_hook" | "loop_back" | "emphasis"
    t_start: float
    t_end: float
    text: str
    color_intent: str = "neutral"   # "neutral" | "important" | "definition" | "warning"

    def to_dict(self) -> dict:
        return {
            "type": self.type,
            "t_start": round(self.t_start, 3),
            "t_end": round(self.t_end, 3),
            "text": self.text,
            "color_intent": self.color_intent,
        }


# ---------------------------------------------------------------------------
# Prompt
# ---------------------------------------------------------------------------

REEL_DIRECTOR_SYSTEM_PROMPT = """You direct overlay text for short-form reels built from interview footage.

The speaker's voice IS the narration — you do NOT write the script. Your job is to add a small number of bold caption-style overlays at specific moments that:
  1. Stop the scroll in the first 2.5 seconds (HOOK).
  2. Reinforce ONE key beat in the middle (MICRO_HOOK).
  3. Echo the hook in the final second so the reel loops cleanly (LOOP_BACK).
  4. Optionally punctuate up to 2 emphasis moments tied to specific spoken phrases.

You will receive:
  * The reel's total duration in seconds.
  * The full reel-time transcript with word-level timestamps.
  * The clip's working title and a one-line rationale.

Constraints — these are HARD rules:
  * Each overlay text is ≤6 words AND ≤60 characters.
  * HOOK must start at t_start ≤ 0.3 and end at t_end ≤ 2.6. It must reinforce or sharpen the speaker's opening claim — use a curiosity gap, a contrarian frame, or a concrete number. Avoid restating the speaker word-for-word.
  * MICRO_HOOK lands between 35% and 65% of the way through. 1-3s long. Should re-engage attention — a question, a stat, a "but here's the twist" beat.
  * LOOP_BACK is in the final 1.5 seconds, ≥0.5s long. 2-4 words. Should rhyme visually/thematically with the hook so a re-watch feels intentional.
  * EMPHASIS overlays (optional, max 2) are tied to specific spoken phrases — their t_start should align with the start of the phrase they reinforce.
  * Each overlay has duration ≥0.5s and ≤4.0s.
  * Overlays may NOT contain verbal-CTA language: no "follow me", "subscribe", "like this video", "drop a comment", "link in bio", "smash that like" or similar. Captions handle direct calls; the overlay track is for content.
  * ALL CAPS for hook / micro_hook / loop_back. Mixed case OK for emphasis.
  * Use "color_intent" to convey tone: "important" (yellow) for key claims/stats, "definition" (green) for definitions or aha moments, "warning" (red) for cautions or stakes, "neutral" (white) by default.

Output a single JSON object with this exact schema (no prose, no markdown, no commentary):
{
  "overlays": [
    {"type": "hook"|"micro_hook"|"loop_back"|"emphasis",
     "t_start": <float seconds>,
     "t_end":   <float seconds>,
     "text":    <string>,
     "color_intent": "neutral"|"important"|"definition"|"warning"}
  ]
}

If you can't produce a high-confidence hook + micro_hook + loop_back trio, prefer fewer overlays over weak ones. An empty array is acceptable.
"""


def _build_user_prompt(
    reel_duration_s: float,
    title: str,
    rationale: str,
    reel_time_transcript: str,
) -> str:
    return (
        f"Reel duration: {reel_duration_s:.2f}s.\n"
        f"Working title: {title}\n"
        f"Why this clip was picked: {rationale}\n\n"
        f"Reel-time transcript (seconds since reel start):\n{reel_time_transcript}\n\n"
        "Return the JSON object now."
    )


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------

class LLMDirector:
    """One LLM call → list of OverlaySpec. Stateless; instantiate per render."""

    def __init__(self) -> None:
        self._settings = get_settings()
        self._api_key = self._settings.openrouter_api_key
        self._llm_url = self._settings.llm_base_url
        self._model = os.getenv(_LLM_MODEL_ENV, "").strip() or _LLM_DEFAULT_MODEL

    @property
    def enabled(self) -> bool:
        if os.getenv(_DISABLE_ENV, "").strip().lower() in ("1", "true", "yes"):
            return False
        return bool(self._api_key)

    async def generate_overlays(
        self,
        *,
        reel_duration_s: float,
        title: str,
        rationale: str,
        word_importance_reel_time: list[dict],
    ) -> list[OverlaySpec]:
        """Returns validated OverlaySpec list, or empty on any failure.

        `word_importance_reel_time` should already be remapped through the
        trim_map — the LLM operates in reel-timeline coordinates only.
        """
        if not self.enabled:
            return []
        if reel_duration_s <= 1.0 or not word_importance_reel_time:
            return []

        transcript_block = _format_transcript_for_prompt(word_importance_reel_time)
        user = _build_user_prompt(
            reel_duration_s=reel_duration_s,
            title=title.strip() or "Watch this",
            rationale=rationale.strip() or "Strong engagement signals.",
            reel_time_transcript=transcript_block,
        )

        raw = await self._call_llm(user)
        if not raw:
            return []

        try:
            payload = _extract_json_object(raw)
        except ValueError as e:
            logger.warning(f"[LLMDirector] JSON parse failed: {e}; raw={raw[:300]!r}")
            return []

        candidates = payload.get("overlays")
        if not isinstance(candidates, list):
            logger.warning(f"[LLMDirector] no 'overlays' array in response: {raw[:300]!r}")
            return []

        valid: list[OverlaySpec] = []
        for entry in candidates:
            spec = _validate_overlay(entry, reel_duration_s)
            if spec is not None:
                valid.append(spec)

        valid = _enforce_structural_rules(valid, reel_duration_s)
        return valid

    async def _call_llm(self, user_prompt: str) -> Optional[str]:
        """Reuses the same multi-attempt pattern as ReelsPreviewService:
        response_format=json_object → plain → plain-retry. 5xx/timeout/429
        are transient; 4xx other than 400/408/429 are fatal.
        """
        payload = {
            "model": self._model,
            "messages": [
                {"role": "system", "content": REEL_DIRECTOR_SYSTEM_PROMPT},
                {"role": "user", "content": user_prompt},
            ],
            "temperature": 0.5,    # a little spice for varied hook phrasing
            "max_tokens": 800,
        }
        headers = {
            "Authorization": f"Bearer {self._api_key}",
            "Content-Type": "application/json",
        }

        attempts: list[dict] = [
            {**payload, "response_format": {"type": "json_object"}},
            payload,
            payload,
        ]
        last_err: Optional[str] = None
        try:
            async with httpx.AsyncClient(timeout=_LLM_TIMEOUT_S) as client:
                for attempt in attempts:
                    try:
                        resp = await client.post(self._llm_url, headers=headers, json=attempt)
                    except httpx.TimeoutException as e:
                        last_err = f"timeout: {e}"
                        continue
                    except httpx.HTTPError as e:
                        last_err = f"transport: {e}"
                        continue
                    if resp.status_code == 200:
                        try:
                            return resp.json()["choices"][0]["message"]["content"]
                        except Exception as e:
                            logger.warning(
                                f"[LLMDirector] unwrap failed: {e}; body={resp.text[:300]!r}"
                            )
                            return None
                    if resp.status_code == 400 and "response_format" in resp.text:
                        continue   # provider rejects the strict-json hint
                    if 500 <= resp.status_code < 600 or resp.status_code in (408, 429):
                        last_err = f"{resp.status_code}: {resp.text[:200]!r}"
                        continue
                    logger.warning(f"[LLMDirector] {resp.status_code}: {resp.text[:300]!r}")
                    return None
        except Exception as e:
            logger.warning(f"[LLMDirector] unexpected error: {e}")
            return None

        if last_err:
            logger.warning(f"[LLMDirector] gave up after retries: {last_err}")
        return None


# ---------------------------------------------------------------------------
# Helpers — transcript formatting, JSON extraction, validation
# ---------------------------------------------------------------------------

def _format_transcript_for_prompt(
    word_importance_reel_time: list[dict],
    max_chars: int = 6000,
) -> str:
    """Compact `[t_start-t_end] word` lines, capped so a long reel can't
    bloat the prompt past sensible token limits. 6000 chars ≈ 1500 tokens
    for English."""
    lines: list[str] = []
    used = 0
    for w in word_importance_reel_time:
        try:
            ts = float(w.get("t_start") or 0.0)
            te = float(w.get("t_end") or 0.0)
        except (TypeError, ValueError):
            continue
        txt = str(w.get("word") or "").strip()
        if not txt:
            continue
        line = f"[{ts:.2f}-{te:.2f}] {txt}"
        if used + len(line) + 1 > max_chars:
            lines.append("[…truncated…]")
            break
        lines.append(line)
        used += len(line) + 1
    return "\n".join(lines)


# Strict JSON object extractor — tolerates code-fence wrappers + leading prose,
# but rejects anything that isn't a single top-level object.
_FENCE_RE = re.compile(r"^```(?:json)?\s*(.*?)\s*```\s*$", re.DOTALL | re.IGNORECASE)


def _extract_json_object(raw: str) -> dict:
    """Parse the LLM's response into a dict, tolerating common output noise.

    Strategy:
      1. Strip a single code-fence wrapper if present.
      2. Try `json.loads` on the whole thing.
      3. Fall back to scanning for the first top-level `{...}` block.
    """
    s = raw.strip()
    m = _FENCE_RE.match(s)
    if m:
        s = m.group(1).strip()
    try:
        obj = json.loads(s)
        if isinstance(obj, dict):
            return obj
    except json.JSONDecodeError:
        pass
    # Locate the first `{` … balanced `}` substring and try that.
    start = s.find("{")
    if start < 0:
        raise ValueError("no JSON object in response")
    depth = 0
    for i in range(start, len(s)):
        if s[i] == "{":
            depth += 1
        elif s[i] == "}":
            depth -= 1
            if depth == 0:
                try:
                    obj = json.loads(s[start:i + 1])
                except json.JSONDecodeError as e:
                    raise ValueError(f"balanced block did not parse: {e}")
                if isinstance(obj, dict):
                    return obj
                break
    raise ValueError("no balanced JSON object found")


def _validate_overlay(entry: Any, reel_duration_s: float) -> Optional[OverlaySpec]:
    """One overlay → OverlaySpec or None. None means "drop this entry"."""
    if not isinstance(entry, dict):
        return None
    typ = str(entry.get("type") or "").strip().lower()
    if typ not in _OVERLAY_TYPES:
        return None
    try:
        ts = float(entry.get("t_start"))
        te = float(entry.get("t_end"))
    except (TypeError, ValueError):
        return None
    text = str(entry.get("text") or "").strip()
    if not text:
        return None
    color = str(entry.get("color_intent") or "neutral").strip().lower()
    if color not in _COLOR_INTENTS:
        color = "neutral"

    # CTA filter — overlay text containing any kill phrase is dropped.
    text_lower = text.lower()
    if any(kp in text_lower for kp in CTA_KILL_PHRASES):
        return None

    # Length caps.
    word_count = len(text.split())
    if word_count > MAX_OVERLAY_WORDS or len(text) > MAX_OVERLAY_CHARS:
        return None

    # Timing.
    if not (0.0 <= ts < te <= reel_duration_s + 0.5):
        return None
    # Clamp the very end of the loop_back to reel_duration; LLM occasionally
    # over-shoots by a frame.
    te = min(te, reel_duration_s)
    duration = te - ts
    if duration < MIN_OVERLAY_DURATION_S or duration > MAX_OVERLAY_DURATION_S:
        return None

    # Type-specific timing windows.
    if typ == "hook":
        if ts > 0.3 or te > HOOK_MAX_END_S:
            return None
    elif typ == "loop_back":
        # last 1.5s; start in the back half and end ≤ reel_duration
        if ts < reel_duration_s - 1.5 - 0.25:
            return None
    elif typ == "micro_hook":
        mid_lo = 0.30 * reel_duration_s
        mid_hi = 0.70 * reel_duration_s
        if ts < mid_lo or ts > mid_hi:
            return None
    # emphasis: any time inside the reel, already gated by overall timing checks.

    return OverlaySpec(
        type=typ,
        t_start=ts,
        t_end=te,
        text=text,
        color_intent=color,
    )


def _enforce_structural_rules(
    specs: list[OverlaySpec],
    reel_duration_s: float,
) -> list[OverlaySpec]:
    """Apply post-validation invariants so the final set is well-formed:

    * At most one hook / micro_hook / loop_back — keep the earliest valid
      one for each type. (LLMs sometimes emit two "hooks".)
    * At most 2 emphasis overlays.
    * Drop emphasis overlays that overlap the hook or loop_back windows —
      stacking different overlays in the same band looks busy.
    * Sort the final list by t_start so downstream HTML generation can
      assume monotonic ordering.
    """
    seen_unique: dict[str, OverlaySpec] = {}
    emphases: list[OverlaySpec] = []
    for s in specs:
        if s.type in ("hook", "micro_hook", "loop_back"):
            if s.type not in seen_unique:
                seen_unique[s.type] = s
        elif s.type == "emphasis":
            emphases.append(s)

    # Cap emphasis at 2 and drop any that overlap structural windows.
    hook = seen_unique.get("hook")
    loop = seen_unique.get("loop_back")
    def _overlaps(a: OverlaySpec, b: Optional[OverlaySpec]) -> bool:
        if b is None:
            return False
        return a.t_start < b.t_end and b.t_start < a.t_end

    emphases = [e for e in emphases if not _overlaps(e, hook) and not _overlaps(e, loop)]
    emphases.sort(key=lambda x: x.t_start)
    emphases = emphases[:2]

    out = list(seen_unique.values()) + emphases
    out.sort(key=lambda x: x.t_start)
    return out
