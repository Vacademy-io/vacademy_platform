"""AI video orchestrator — bridges shot dicts to fal.ai Veo (Phase 3b).

Called from `automation_pipeline._shot_task` when shot_type=='AI_VIDEO_HERO'.
Single entry point `orchestrate_ai_video_shot(...)` does:
  1. Validate the shot has the required AI-video fields (`ai_video_prompt`,
     `ai_video_duration_s`)
  2. Charge the per-call cost against the run's circuit-breaker tally;
     bail with `CircuitBreakerExhausted` if the tally would exceed the cap
  3. Call the Veo client (text-to-video for Phase 3)
  4. Build minimal HTML wrapping the Veo MP4
  5. Return a result dict the caller can drop into the shot's entry

Failure modes (every one returns or raises something the caller can act on):
  - `VeoError` subclasses bubble up to caller for the regen-without-AI-video
    fallback path
  - `CircuitBreakerExhausted` bubbles up before any Veo call is made
  - Missing/invalid shot fields raise `AiVideoSpecError`

The orchestrator is intentionally a pure function over (shot, run_dir,
ctx, veo_client, cost_tracker) — no class state. This keeps the wiring
into `_shot_task` to a single function call, makes the orchestrator
testable in isolation, and avoids tangling Veo state into the pipeline
object.

Phase 4 will extend this for multi-segment chains (`ai_video_segments`)
via image-to-video. The current implementation handles only single-segment
(≤8s) shots; longer shots get truncated to the first 8s with a warning
logged. Phase 4 lifts that limit.
"""
from __future__ import annotations

import html as _html
import json
import logging
import threading
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Exceptions
# ---------------------------------------------------------------------------

class AiVideoSpecError(ValueError):
    """The shot dict is missing or has invalid AI-video fields. Programming
    error — the Director or upstream stage should have set these. Not the
    same as a Veo API failure (which is a VeoError subclass)."""


class CircuitBreakerExhausted(RuntimeError):
    """The per-video AI-video budget would be exceeded by this call. The
    caller MUST fall back to a non-AI shot type rather than retry — no
    amount of waiting unblocks this on the same run."""
    def __init__(self, *, current_usd: float, requested_usd: float, cap_usd: float):
        super().__init__(
            f"AI video budget exhausted: ${current_usd:.4f} spent + ${requested_usd:.4f} "
            f"requested > ${cap_usd:.4f} cap"
        )
        self.current_usd = current_usd
        self.requested_usd = requested_usd
        self.cap_usd = cap_usd


# ---------------------------------------------------------------------------
# Cost tracker — small thread-safe budget guard
# ---------------------------------------------------------------------------

class AiVideoCostTracker:
    """Per-run circuit-breaker tally with a hard cap.

    Thread-safe: incremented from per-shot tasks running on the pipeline's
    executor pool. `try_charge` reserves capacity BEFORE the Veo call so a
    burst of concurrent shots can't all sail past the cap together.

    Stored on the pipeline instance as `self._ai_video_cost_tracker`
    (constructed once in __init__). Phase 7 persists it into the run
    checkpoint so resume re-reads the tally.
    """

    def __init__(self, *, cap_usd: float):
        if cap_usd <= 0:
            raise ValueError(f"AiVideoCostTracker requires positive cap_usd, got {cap_usd!r}")
        self._cap_usd = float(cap_usd)
        self._spent_usd = 0.0
        self._lock = threading.Lock()
        # Telemetry — surfaced in the run summary
        self.shots_completed = 0
        self.shots_failed = 0
        self.shots_skipped_circuit_breaker = 0

    @property
    def cap_usd(self) -> float:
        return self._cap_usd

    @property
    def spent_usd(self) -> float:
        with self._lock:
            return self._spent_usd

    @property
    def remaining_usd(self) -> float:
        with self._lock:
            return max(0.0, self._cap_usd - self._spent_usd)

    def try_charge(self, amount_usd: float) -> None:
        """Reserve `amount_usd` of budget; raises CircuitBreakerExhausted
        if it would overshoot the cap. Caller calls this BEFORE the Veo
        call so a failed reservation prevents the network round-trip."""
        with self._lock:
            if self._spent_usd + amount_usd > self._cap_usd:
                self.shots_skipped_circuit_breaker += 1
                raise CircuitBreakerExhausted(
                    current_usd=self._spent_usd,
                    requested_usd=amount_usd,
                    cap_usd=self._cap_usd,
                )
            self._spent_usd += amount_usd

    def refund(self, amount_usd: float) -> None:
        """Return budget when a Veo call fails AFTER `try_charge` succeeded
        (e.g. safety block, timeout). Without refund, transient failures
        would slowly eat the budget. Bounded at 0."""
        with self._lock:
            self._spent_usd = max(0.0, self._spent_usd - amount_usd)

    def mark_completed(self) -> None:
        with self._lock:
            self.shots_completed += 1

    def mark_failed(self) -> None:
        with self._lock:
            self.shots_failed += 1

    def summary(self) -> Dict[str, Any]:
        with self._lock:
            return {
                "cap_usd": round(self._cap_usd, 4),
                "spent_usd": round(self._spent_usd, 4),
                "remaining_usd": round(max(0.0, self._cap_usd - self._spent_usd), 4),
                "shots_completed": self.shots_completed,
                "shots_failed": self.shots_failed,
                "shots_skipped_circuit_breaker": self.shots_skipped_circuit_breaker,
            }


# ---------------------------------------------------------------------------
# Result dataclass
# ---------------------------------------------------------------------------

@dataclass
class AiVideoShotResult:
    """Outcome of one AI_VIDEO_HERO shot. Mirrors the structural fields the
    caller drops into the shot's entry. `error` is None on success."""
    shot_idx: int
    html: str = ""
    video_url: str = ""
    request_id: str = ""
    duration_s: int = 0
    resolution: str = "720p"
    aspect_ratio: str = "16:9"
    audio_on: bool = False
    cost_usd: float = 0.0
    elapsed_s: float = 0.0
    error: Optional[str] = None
    error_class: Optional[str] = None  # exception class name for telemetry
    segments: List[Dict[str, Any]] = field(default_factory=list)
    skipped: bool = False  # True when circuit breaker tripped


# ---------------------------------------------------------------------------
# HTML wrapper
# ---------------------------------------------------------------------------

# Minimal HTML wrapping a Veo video URL. The wrapper:
#   - autoplay (browsers require muted for autoplay on most platforms)
#   - loop so a shot longer than the Veo clip duration doesn't show black
#     after the clip ends (Phase 4 chaining produces real length when needed)
#   - playsinline for mobile
#   - object-fit: cover to fill the canvas regardless of canvas aspect ratio
#     mismatch with the Veo aspect (we pick aspect_ratio per canvas, but the
#     cover behaviour is the safety net)
#
# When Phase 5 audio lands: `muted` becomes conditional on audio_policy.
# narration_only → muted (today); intrinsic_only → unmuted.
_AI_VIDEO_HTML_TEMPLATE = """<div id="shot-root" class="ai-video-shot" data-ai-video="{shot_idx}" data-shot-type="AI_VIDEO_HERO">
  <video
    class="ai-video-fill"
    src="{video_url_esc}"
    autoplay
    {muted_attr}
    loop
    playsinline
    preload="auto"
  ></video>
</div>
<style data-ai-video-css="{shot_idx}">
  .ai-video-shot {{ position: absolute; inset: 0; background: #000; overflow: hidden; }}
  .ai-video-fill {{
    position: absolute; inset: 0;
    width: 100%; height: 100%;
    object-fit: cover;
    pointer-events: none;
  }}
</style>"""


def build_ai_video_html(
    *,
    shot_idx: int,
    video_url: str,
    audio_policy: str = "narration_only",
) -> str:
    """Wrap a Veo MP4 URL in shot-root HTML.

    Pure function — no I/O. Lifted out of orchestrate() so the inline
    `<aivideo>` composer (Phase 6) and the editor regen path can reuse it.
    """
    # When audio_policy == "intrinsic_only" the Veo clip's audio plays
    # alone (Phase 5). For all other policies the <video> is muted so the
    # master narration is the only audio.
    muted_attr = "" if audio_policy == "intrinsic_only" else "muted"
    return _AI_VIDEO_HTML_TEMPLATE.format(
        shot_idx=int(shot_idx),
        video_url_esc=_html.escape(str(video_url), quote=True),
        muted_attr=muted_attr,
    )


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

# Allowed Veo durations — the only places this should live are here and
# fal_veo_client.ALLOWED_DURATIONS_S. We duplicate to avoid an import cycle
# at orchestrator load time.
_ALLOWED_DURATIONS_S = (4, 6, 8)


def _normalize_duration_s(value: Any, default: int = 8) -> int:
    """Snap an arbitrary duration to the nearest allowed Veo duration.

    Veo accepts only 4/6/8s. If the Director emits something else (e.g. 5),
    we snap to the closest allowed value rather than failing — the goal is
    to ship the shot, not to relitigate the Director's math.
    """
    try:
        if isinstance(value, bool):
            return default
        v = float(value) if value is not None else float(default)
    except (TypeError, ValueError):
        return default
    if v <= 0:
        return default
    # Pick the allowed value closest to `v`. Tie-break toward the larger
    # value so we get more visual content for the cost (a 5s request
    # becomes 6s, not 4s).
    return min(_ALLOWED_DURATIONS_S, key=lambda d: (abs(d - v), -d))


def _resolve_aspect_ratio(canvas: str) -> str:
    """Map canvas orientation to Veo's aspect_ratio enum."""
    if (canvas or "").strip().lower() == "portrait":
        return "9:16"
    return "16:9"


def _resolve_audio_flag(
    *,
    audio_policy: str,
    ai_video_audio: bool,
    run_audio_enabled: bool,
) -> bool:
    """Decide `generate_audio` for the Veo call.

    True only when ALL of:
      - the run has audio enabled (`ai_video_audio_enabled` on the request)
      - the shot's Director-set `ai_video_audio` is True
      - the resolved `audio_policy` is intrinsic_only

    Otherwise False — saves the $0.02/s premium on every shot we don't
    actually want audio for.
    """
    if not run_audio_enabled:
        return False
    if not ai_video_audio:
        return False
    if (audio_policy or "").strip().lower() != "intrinsic_only":
        return False
    return True


def orchestrate_ai_video_shot(
    *,
    shot: Dict[str, Any],
    shot_idx: int,
    run_dir: Path,
    veo_client: Any,                         # FalVeoClient, duck-typed
    cost_tracker: Optional[AiVideoCostTracker],
    canvas: str = "landscape",
    run_audio_enabled: bool = False,
    safety_tolerance: str = "3",
    log_fn: Optional[Callable[[str], None]] = None,
) -> AiVideoShotResult:
    """Generate one AI_VIDEO_HERO shot end-to-end.

    Caller (`_shot_task` AI_VIDEO_HERO branch) handles the fallback path
    when this returns an error / raises — typically by re-running the
    per-shot LLM with AI_VIDEO_HERO forbidden from the allowed shot types.

    Returns AiVideoShotResult with `error=None` on success. On
    CircuitBreakerExhausted, returns a result with `skipped=True` and the
    cap exhaustion in `error`. Other Veo failures populate `error` +
    `error_class` and let the caller decide.

    NO EXCEPTIONS LEAK from this function — every failure becomes an
    AiVideoShotResult with `error` populated. The caller's branch becomes
    a simple `if result.error: <fallback>` check.
    """
    def _log(msg: str) -> None:
        if log_fn is not None:
            try:
                log_fn(msg)
            except Exception:
                pass
        logger.info(msg)

    # Lazy import so HTML / cost-tracker helpers can be imported and tested
    # without httpx on the path. Two equally-valid resolutions:
    #   - `app.services.fal_veo_client` when running under the FastAPI server
    #     (which has `ai_service/` as cwd so `app/` is a top-level package)
    #   - `fal_veo_client` directly when the test harness or a standalone
    #     entry point has put `app/services/` on sys.path
    # On a true import failure we return a typed result rather than raising —
    # callers can keep their single `if result.error: <fallback>` branch.
    try:
        from app.services.fal_veo_client import (
            VeoError, price_per_call_usd,
        )
    except ImportError:
        try:
            from fal_veo_client import (  # type: ignore[no-redef]
                VeoError, price_per_call_usd,
            )
        except ImportError as imp_err:
            return AiVideoShotResult(
                shot_idx=shot_idx,
                error=f"fal_veo_client import failed: {imp_err}",
                error_class="ImportError",
                skipped=True,
            )

    # ── Validate shot spec ────────────────────────────────────────────
    prompt = (shot.get("ai_video_prompt") or "").strip()
    if not prompt:
        return AiVideoShotResult(
            shot_idx=shot_idx,
            error="AI_VIDEO_HERO shot missing required ai_video_prompt",
            error_class="AiVideoSpecError",
        )

    duration_s = _normalize_duration_s(shot.get("ai_video_duration_s"))
    aspect_ratio = _resolve_aspect_ratio(canvas)
    resolution = "720p"  # plan-locked
    audio_policy = (shot.get("audio_policy") or "narration_only").strip().lower()
    audio_on = _resolve_audio_flag(
        audio_policy=audio_policy,
        ai_video_audio=bool(shot.get("ai_video_audio")),
        run_audio_enabled=run_audio_enabled,
    )

    # Phase 4 will read `ai_video_segments`; Phase 3 ships single-segment
    # only and warns if a longer chain was requested.
    segments_req = shot.get("ai_video_segments") or []
    if isinstance(segments_req, list) and len(segments_req) > 1:
        _log(
            f"⚠️  AI_VIDEO_HERO shot {shot_idx}: ai_video_segments has "
            f"{len(segments_req)} entries but Phase 3 supports only 1. "
            f"Truncating to first segment (Phase 4 will chain)."
        )

    # ── Circuit-breaker reservation ──────────────────────────────────
    expected_cost = price_per_call_usd(
        resolution=resolution, duration_s=duration_s, audio_on=audio_on,
    )
    if cost_tracker is not None:
        try:
            cost_tracker.try_charge(expected_cost)
        except CircuitBreakerExhausted as cap_err:
            _log(
                f"🛑 AI_VIDEO_HERO shot {shot_idx}: budget exhausted "
                f"(${cost_tracker.spent_usd:.2f}/${cost_tracker.cap_usd:.2f}); "
                f"falling back."
            )
            return AiVideoShotResult(
                shot_idx=shot_idx,
                duration_s=duration_s,
                resolution=resolution,
                aspect_ratio=aspect_ratio,
                audio_on=audio_on,
                cost_usd=0.0,
                error=str(cap_err),
                error_class="CircuitBreakerExhausted",
                skipped=True,
            )

    # ── Veo call ─────────────────────────────────────────────────────
    _log(
        f"🎬 AI_VIDEO_HERO shot {shot_idx}: requesting Veo "
        f"({duration_s}s, {resolution}, audio={'on' if audio_on else 'off'}, "
        f"${expected_cost:.2f})"
    )
    negative_prompt = (shot.get("ai_video_negative_prompt") or "").strip() or None
    seed = shot.get("ai_video_seed")
    try:
        veo_result = veo_client.generate_text_to_video(
            prompt=prompt,
            duration_s=duration_s,
            aspect_ratio=aspect_ratio,
            resolution=resolution,
            generate_audio=audio_on,
            negative_prompt=negative_prompt,
            seed=int(seed) if seed is not None else None,
            auto_fix=True,
            safety_tolerance=safety_tolerance,
        )
    except VeoError as err:
        # Refund the reserved budget — failed calls shouldn't permanently
        # eat the cap. The pipeline retries via fallback regen, not via
        # the same call.
        if cost_tracker is not None:
            cost_tracker.refund(expected_cost)
            cost_tracker.mark_failed()
        klass = type(err).__name__
        _log(f"❌ AI_VIDEO_HERO shot {shot_idx}: {klass}: {err}")
        return AiVideoShotResult(
            shot_idx=shot_idx,
            duration_s=duration_s,
            resolution=resolution,
            aspect_ratio=aspect_ratio,
            audio_on=audio_on,
            cost_usd=0.0,
            error=str(err),
            error_class=klass,
        )
    except Exception as err:
        # Defensive: anything not in the Veo exception hierarchy is an
        # unexpected condition. Refund budget, log, and signal the caller
        # to fall back. We never want a stray exception to bubble out of
        # an orchestrator method into `_shot_task`'s thread pool.
        if cost_tracker is not None:
            cost_tracker.refund(expected_cost)
            cost_tracker.mark_failed()
        klass = type(err).__name__
        _log(f"❌ AI_VIDEO_HERO shot {shot_idx}: unexpected {klass}: {err}")
        return AiVideoShotResult(
            shot_idx=shot_idx,
            duration_s=duration_s,
            resolution=resolution,
            aspect_ratio=aspect_ratio,
            audio_on=audio_on,
            cost_usd=0.0,
            error=str(err),
            error_class=klass,
        )

    # ── Persist artifact metadata for resume/debug ───────────────────
    # The MP4 itself stays on fal's CDN (URLs are valid for hours/days).
    # Phase 7 polish: mirror to S3 for permanence + editor regen support.
    try:
        ai_video_dir = run_dir / "ai_video"
        ai_video_dir.mkdir(parents=True, exist_ok=True)
        meta_path = ai_video_dir / f"shot_{shot_idx:03d}.json"
        meta_path.write_text(json.dumps({
            "shot_idx": shot_idx,
            "request_id": veo_result.request_id,
            "video_url": veo_result.video_url,
            "duration_s": veo_result.duration_s,
            "resolution": veo_result.resolution,
            "aspect_ratio": veo_result.aspect_ratio,
            "audio_on": veo_result.audio_on,
            "cost_usd": veo_result.cost_usd,
            "elapsed_s": veo_result.elapsed_s,
            "endpoint": veo_result.endpoint,
            "prompt": prompt,
        }, indent=2), encoding="utf-8")
    except Exception as meta_err:
        # Non-fatal — metadata is observability, not load-bearing for render
        _log(f"⚠️  AI_VIDEO_HERO shot {shot_idx}: metadata write failed: {meta_err}")

    if cost_tracker is not None:
        cost_tracker.mark_completed()

    html = build_ai_video_html(
        shot_idx=shot_idx,
        video_url=veo_result.video_url,
        audio_policy=audio_policy,
    )

    _log(
        f"✅ AI_VIDEO_HERO shot {shot_idx}: {veo_result.elapsed_s:.1f}s, "
        f"${veo_result.cost_usd:.3f}, {veo_result.video_url[:80]}"
    )
    return AiVideoShotResult(
        shot_idx=shot_idx,
        html=html,
        video_url=veo_result.video_url,
        request_id=veo_result.request_id,
        duration_s=veo_result.duration_s,
        resolution=veo_result.resolution,
        aspect_ratio=veo_result.aspect_ratio,
        audio_on=veo_result.audio_on,
        cost_usd=veo_result.cost_usd,
        elapsed_s=veo_result.elapsed_s,
        segments=[{
            "seg_idx": 0,
            "video_url": veo_result.video_url,
            "duration_s": veo_result.duration_s,
            "request_id": veo_result.request_id,
        }],
    )
