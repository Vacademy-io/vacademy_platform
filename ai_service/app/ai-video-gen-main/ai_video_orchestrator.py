"""AI video orchestrator — bridges shot dicts to fal.ai Veo (Phase 3b + 4).

Two entry points:

  `orchestrate_ai_video_shot(...)` — Phase 3b single-segment path. Used when
  the shot is ≤8s and has no `ai_video_segments`. One text-to-video Veo
  call; returns immediately with the fal CDN URL embedded in HTML.

  `orchestrate_ai_video_chain(...)` — Phase 4 multi-segment path. Used when
  the shot has `ai_video_segments` with >1 entry OR `ai_video_duration_s` >8.
  First segment is text-to-video; each subsequent segment uses image-to-
  video conditioned on the ffmpeg-extracted last frame of the prior
  segment. Segments are downloaded, concatenated via ffmpeg, and the
  resulting MP4 is uploaded back (via caller-injected `upload_mp4_fn`)
  for a stable URL on the final HTML.

  `_shot_task` dispatches to the chain orchestrator when the shot's
  ai_video_segments / duration cross the single-segment threshold;
  otherwise the single-shot orchestrator handles it.

Failure modes (every one returns or raises something the caller can act on):
  - `VeoError` subclasses bubble up to caller for the regen-without-AI-video
    fallback path
  - `CircuitBreakerExhausted` bubbles up before any Veo call is made
  - Missing/invalid shot fields raise `AiVideoSpecError`
  - In the chain path: partial success (some segments completed, then a
    later one failed or cap-exhausted) returns an `AiVideoShotResult` with
    `error` populated AND the successfully-rendered prior segments listed
    on `segments` — the caller MAY salvage them via a downgrade-and-trim
    strategy if it wants. Phase 4 default: treat partial-chain failure as
    full failure and fall back to a non-AI shot (mirrors single-shot
    failure semantics).

Phase 5 will add audio policy gating (Veo's `generate_audio` per segment).
Phase 6 will add inline `<aivideo>` composer support.
Phase 7 polish: persist all segments to S3 (today only the concat output
goes through `upload_mp4_fn`; segments live on the fal CDN until then).
"""
from __future__ import annotations

import hashlib
import html as _html
import json
import logging
import subprocess
import threading
import time as _time
from dataclasses import dataclass, field
from decimal import Decimal
from pathlib import Path
from typing import TYPE_CHECKING, Any, Callable, Dict, List, Optional

if TYPE_CHECKING:
    # The ledger is duck-typed at runtime so this file stays importable
    # without a working DB/credit service on path (matches how
    # `veo_client: Any` is treated). The orchestrator only relies on the
    # `charge` / `refund` shape.
    from app.services.ai_video_ledger import AiVideoLedger as _LedgerType

logger = logging.getLogger(__name__)


def _load_ledger_insufficient_exc():
    """Resolve `AiVideoLedgerInsufficient` lazily so the orchestrator can
    be unit-tested without the app DB on path. Returns `None` when the
    import path isn't available — in which case ledger.charge can't raise
    that specific exception either."""
    try:
        from app.services.ai_video_ledger import AiVideoLedgerInsufficient
        return AiVideoLedgerInsufficient
    except ImportError:
        try:
            from ai_video_ledger import AiVideoLedgerInsufficient  # type: ignore[no-redef]
            return AiVideoLedgerInsufficient
        except ImportError:
            return None


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

    def mark_skipped_circuit_breaker(self) -> None:
        """Increment the skip counter for a shot that was rejected AFTER
        try_charge succeeded — e.g. when the global credit ledger says
        insufficient balance and the cost-tracker reservation has just
        been rolled back."""
        with self._lock:
            self.shots_skipped_circuit_breaker += 1

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
    cost_credits: float = 0.0  # Credits actually deducted from the institute ledger
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
    ledger: Optional["_LedgerType"] = None,  # AiVideoLedger, duck-typed
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
            VeoError, VeoQuotaExceeded, VeoTimeout, VeoPollError,
            price_per_call_usd,
        )
    except ImportError:
        try:
            from fal_veo_client import (  # type: ignore[no-redef]
                VeoError, VeoQuotaExceeded, VeoTimeout, VeoPollError,
                price_per_call_usd,
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
        # DERIVE rather than fail. A shot can legitimately reach here with no
        # `ai_video_prompt`: the user flipped its shot_type to AI_VIDEO_HERO
        # on the assist plan card (the planner authored it as IMAGE_HERO, so
        # there was never an ai_video_prompt), or the planner emitted the
        # type without the field. Hard-failing turned an explicit user
        # request for AI footage into a silent demotion back to a still.
        # visual_description / narration_excerpt describe the same beat.
        _derived = " ".join(
            str(shot.get(k) or "").strip()
            for k in ("visual_description", "scene_description", "narration_excerpt")
        ).strip()
        if _derived:
            prompt = (
                f"Cinematic footage: {_derived[:400]}. Photorealistic, natural "
                "motion, shallow depth of field, no text or captions in frame."
            )
            _log(
                f"   🎬 AI_VIDEO_HERO shot {shot_idx}: no ai_video_prompt — derived "
                "one from the shot's visual description"
            )
        else:
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
    # Reserve at the SELECTED model's rate, not lite's — full Veo is ~7x
    # lite, so pricing the reservation at lite would let the cap overspend.
    _veo_model = getattr(veo_client, "_model", None)
    expected_cost = price_per_call_usd(
        resolution=resolution, duration_s=duration_s, audio_on=audio_on,
        model=_veo_model,
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

    # ── Credit ledger deduction ──────────────────────────────────────
    # The cost-tracker reservation is in-process only. The global credit
    # ledger is what actually bills the institute. We deduct BEFORE the
    # Veo call so a balance race (concurrent shots across runs) can never
    # let a Veo call ship without a matching USAGE_DEDUCTION row.
    #
    # On insufficient balance: roll back the tracker reservation, treat
    # exactly like CircuitBreakerExhausted (the per-shot fallback path).
    charged_credits: Decimal = Decimal("0")
    if ledger is not None and getattr(ledger, "enabled", False):
        _LedgerInsufficient = _load_ledger_insufficient_exc()
        try:
            charged_credits = ledger.charge(
                cost_usd=expected_cost,
                shot_idx=shot_idx,
                duration_s=duration_s,
                audio_on=audio_on,
            )
        except Exception as ledger_err:  # noqa: BLE001
            is_insufficient = (
                _LedgerInsufficient is not None
                and isinstance(ledger_err, _LedgerInsufficient)
            )
            if cost_tracker is not None:
                cost_tracker.refund(expected_cost)
                cost_tracker.mark_skipped_circuit_breaker()
            if is_insufficient:
                _log(
                    f"🛑 AI_VIDEO_HERO shot {shot_idx}: credit ledger said "
                    f"insufficient balance for ~${expected_cost:.2f}; falling back."
                )
                return AiVideoShotResult(
                    shot_idx=shot_idx,
                    duration_s=duration_s,
                    resolution=resolution,
                    aspect_ratio=aspect_ratio,
                    audio_on=audio_on,
                    cost_usd=0.0,
                    error=str(ledger_err),
                    error_class="CircuitBreakerExhausted",
                    skipped=True,
                )
            # Any other ledger exception is treated as "fail safely" — we
            # don't want a ledger transient (DB hiccup, etc.) to kill an
            # already-paid-up Veo call. Log and proceed without a ledger
            # row; pipeline-abort refund (refund_video_credits by batch_id)
            # will still net-zero if the whole pipeline rolls back.
            _log(
                f"⚠️  AI_VIDEO_HERO shot {shot_idx}: ledger.charge unexpectedly "
                f"raised {type(ledger_err).__name__}: {ledger_err}; proceeding "
                f"without ledger deduction."
            )

    # ── Veo call ─────────────────────────────────────────────────────
    _log(
        f"🎬 AI_VIDEO_HERO shot {shot_idx}: requesting Veo "
        f"({duration_s}s, {resolution}, audio={'on' if audio_on else 'off'}, "
        f"${expected_cost:.2f})"
    )
    negative_prompt = (shot.get("ai_video_negative_prompt") or "").strip() or None
    seed = shot.get("ai_video_seed")

    def _submit_once():
        return veo_client.generate_text_to_video(
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

    try:
        try:
            veo_result = _submit_once()
        except (VeoQuotaExceeded, VeoTimeout, VeoPollError) as _transient:
            # Retry ONCE on transient failures. AI-video runs submit up to 8
            # shots concurrently (the per-shot thread pool), which makes 429s
            # realistic — and without this a single transient error
            # PERMANENTLY demotes that beat to stock. Mirrors the dialogue
            # path. The budget reservation + ledger charge are held across
            # the retry; the except below refunds only on final failure.
            # Safety blocks stay no-retry (auto_fix already applied).
            _log(
                f"🔁 AI_VIDEO_HERO shot {shot_idx}: transient "
                f"{type(_transient).__name__} — retrying once in 45s…"
            )
            _time.sleep(45)
            veo_result = _submit_once()
    except VeoError as err:
        # Refund the reserved budget — failed calls shouldn't permanently
        # eat the cap. The pipeline retries via fallback regen, not via
        # the same call.
        if cost_tracker is not None:
            cost_tracker.refund(expected_cost)
            cost_tracker.mark_failed()
        if ledger is not None and charged_credits > 0:
            ledger.refund(
                credits=charged_credits,
                shot_idx=shot_idx,
                reason=type(err).__name__,
            )
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
        if ledger is not None and charged_credits > 0:
            ledger.refund(
                credits=charged_credits,
                shot_idx=shot_idx,
                reason=f"unexpected:{type(err).__name__}",
            )
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
        cost_credits=float(charged_credits),
        elapsed_s=veo_result.elapsed_s,
        segments=[{
            "seg_idx": 0,
            "video_url": veo_result.video_url,
            "duration_s": veo_result.duration_s,
            "request_id": veo_result.request_id,
        }],
    )


# ===========================================================================
# Phase 4 — multi-segment chain via image-to-video
# ===========================================================================

# ffmpeg subprocess defaults. Overridable via env so the same code runs in
# dev (homebrew ffmpeg on PATH) and in the container (pinned binary).
_FFMPEG_BIN = "ffmpeg"
_FFPROBE_BIN = "ffprobe"
_FFMPEG_TIMEOUT_S = 60.0
_FFMPEG_CONCAT_TIMEOUT_S = 180.0

# Per-segment chain budget caps. Beyond `MAX_CHAIN_SEGMENTS` the orchestrator
# refuses to schedule more segments — a runaway 30s shot at 4 segments × 8s
# would cost ~$1.00 alone, eating most of the per-video cap.
MAX_CHAIN_SEGMENTS = 6


def _ffmpeg_extract_last_frame(
    mp4_path: Path,
    out_png_path: Path,
    *,
    ffmpeg_bin: str = _FFMPEG_BIN,
    timeout_s: float = _FFMPEG_TIMEOUT_S,
) -> bool:
    """Extract the last frame of `mp4_path` as PNG at `out_png_path`.

    Uses ffmpeg's `-sseof -1` (seek 1 second from end) + `-vframes 1` to grab
    the final visible frame. Returns True on success. Returns False on
    timeout / non-zero exit / missing output file — caller treats as a
    chain-breaking error.

    Pure-ish: takes paths in, writes a file out, returns bool. No state.
    """
    out_png_path.parent.mkdir(parents=True, exist_ok=True)
    cmd = [
        ffmpeg_bin, "-y", "-loglevel", "error",
        "-sseof", "-1",
        "-i", str(mp4_path),
        "-update", "1",
        "-vframes", "1",
        "-f", "image2",
        str(out_png_path),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_s)
    except subprocess.TimeoutExpired:
        logger.warning(f"[Veo chain] ffmpeg last-frame extract timed out on {mp4_path}")
        return False
    except FileNotFoundError:
        logger.warning(f"[Veo chain] ffmpeg binary '{ffmpeg_bin}' not found")
        return False
    if proc.returncode != 0:
        logger.warning(
            f"[Veo chain] ffmpeg last-frame extract failed (rc={proc.returncode}): "
            f"{(proc.stderr or '').strip()[:200]}"
        )
        return False
    return out_png_path.exists() and out_png_path.stat().st_size > 0


def _ffmpeg_concat_mp4s(
    segment_paths: List[Path],
    out_mp4_path: Path,
    *,
    ffmpeg_bin: str = _FFMPEG_BIN,
    timeout_s: float = _FFMPEG_CONCAT_TIMEOUT_S,
) -> bool:
    """Concat the MP4s in `segment_paths` into `out_mp4_path` via ffmpeg's
    concat demuxer. Re-encodes to a uniform 720p/30fps/AAC stream so chained
    segments with slight encoding drift line up cleanly. Returns True on
    success, False on any ffmpeg failure (caller treats as chain failure).

    Mirrors the per-shot TTS concat pattern in `_concat_master_narration` —
    builds a concat list file, runs ffmpeg, checks the output. The
    re-encode is cheap (~3-5s per minute of footage) and worth it for the
    smooth transitions.
    """
    if not segment_paths:
        logger.warning("[Veo chain] concat called with empty segment list")
        return False
    out_mp4_path.parent.mkdir(parents=True, exist_ok=True)
    concat_list_path = out_mp4_path.with_suffix(".concat.txt")
    concat_lines = [f"file '{p.absolute()}'" for p in segment_paths if p.exists()]
    if not concat_lines:
        logger.warning("[Veo chain] concat — no input segments exist on disk")
        return False
    concat_list_path.write_text("\n".join(concat_lines), encoding="utf-8")
    cmd = [
        ffmpeg_bin, "-y", "-loglevel", "error",
        "-f", "concat", "-safe", "0",
        "-i", str(concat_list_path),
        # Re-encode video: H.264, CRF 23 (visually transparent for 720p),
        # explicit pixel format for compatibility, capped at 30fps to match
        # Veo's output and avoid framerate fights at concat boundaries.
        "-c:v", "libx264", "-preset", "fast", "-crf", "23",
        "-pix_fmt", "yuv420p", "-r", "30",
        # Re-encode audio when present, drop cleanly when not. AAC 128k is
        # the universal-compatibility default; segments with `generate_audio`
        # mixed across will all conform.
        "-c:a", "aac", "-b:a", "128k", "-ar", "44100",
        str(out_mp4_path),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_s)
    except subprocess.TimeoutExpired:
        logger.warning(f"[Veo chain] ffmpeg concat timed out")
        return False
    except FileNotFoundError:
        logger.warning(f"[Veo chain] ffmpeg binary '{ffmpeg_bin}' not found")
        return False
    if proc.returncode != 0:
        logger.warning(
            f"[Veo chain] ffmpeg concat failed (rc={proc.returncode}): "
            f"{(proc.stderr or '').strip()[:300]}"
        )
        return False
    return out_mp4_path.exists() and out_mp4_path.stat().st_size > 0


def _download_url_to_path(
    url: str,
    out_path: Path,
    *,
    timeout_s: float = 60.0,
) -> bool:
    """Download `url` to `out_path` via httpx.

    Returns True on success. Returns False on any HTTP / network / file-write
    failure — caller treats as chain-breaking (we can't proceed without the
    segment for last-frame extraction).
    """
    try:
        import httpx
    except ImportError:
        logger.warning("[Veo chain] httpx not available — cannot download segment")
        return False
    out_path.parent.mkdir(parents=True, exist_ok=True)
    try:
        with httpx.stream("GET", url, timeout=timeout_s, follow_redirects=True) as resp:
            if resp.status_code >= 400:
                logger.warning(
                    f"[Veo chain] download HTTP {resp.status_code} for {url[:80]}"
                )
                return False
            with open(out_path, "wb") as f:
                for chunk in resp.iter_bytes(chunk_size=1 << 16):
                    if chunk:
                        f.write(chunk)
    except Exception as err:
        logger.warning(f"[Veo chain] download failed: {type(err).__name__}: {err}")
        return False
    return out_path.exists() and out_path.stat().st_size > 0


def _resolve_segments(shot: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Normalize a shot's `ai_video_segments` field into a clean list of
    segment dicts {prompt, duration_s}.

    Two input shapes accepted:
      - Director-supplied `ai_video_segments` list — used verbatim after
        normalization
      - Single-prompt shot with `ai_video_prompt + ai_video_duration_s > 8`
        — auto-split into N segments of `_normalize_duration_s` length each,
        reusing the same prompt (so the chain stays on the same scene/character)

    Each segment's prompt defaults to the parent `ai_video_prompt` when
    blank — useful for Director plans that emit `ai_video_segments` with
    only durations.

    Returns at most MAX_CHAIN_SEGMENTS segments. Excess entries are
    truncated with a logged warning at the call site (this function returns
    the truncated list).
    """
    parent_prompt = (shot.get("ai_video_prompt") or "").strip()
    raw_segments = shot.get("ai_video_segments") or []
    out: List[Dict[str, Any]] = []

    if isinstance(raw_segments, list) and raw_segments:
        for raw in raw_segments:
            if not isinstance(raw, dict):
                continue
            prompt = (raw.get("prompt") or parent_prompt or "").strip()
            if not prompt:
                continue
            dur = _normalize_duration_s(raw.get("duration_s"))
            out.append({"prompt": prompt, "duration_s": dur})
    elif parent_prompt:
        # Auto-split path: single prompt, total duration > 8s.
        # Snap total duration to a multiple of 8s, capped at MAX_CHAIN_SEGMENTS * 8.
        total_req = 0.0
        try:
            total_req = float(shot.get("ai_video_duration_s") or 0.0)
        except (TypeError, ValueError):
            total_req = 0.0
        if total_req <= 8.0:
            out.append({"prompt": parent_prompt, "duration_s": _normalize_duration_s(total_req or 8)})
        else:
            # Split into 8s chunks, with the final chunk taking the remainder
            # snapped to the nearest allowed duration.
            full_chunks = int(total_req // 8)
            remainder = total_req - full_chunks * 8.0
            for _ in range(full_chunks):
                out.append({"prompt": parent_prompt, "duration_s": 8})
            if remainder >= 2.0:  # only bother with a remainder segment if substantial
                out.append({"prompt": parent_prompt, "duration_s": _normalize_duration_s(remainder)})

    return out[:MAX_CHAIN_SEGMENTS]


def _segment_cache_key(
    *, prompt: str, duration_s: int, resolution: str, aspect_ratio: str,
    audio_on: bool, seed: Optional[int], prev_seg_key: Optional[str],
) -> str:
    """Stable 12-char hex key for a single segment.

    A segment is cache-equivalent when prompt / duration / resolution /
    aspect / audio / seed all match AND the *content identity* of its
    starting frame matches. We can't use the start_frame's upload URL
    directly (URLs are regenerated each upload), so we derive identity
    from the previous segment's cache key — since segment N-1's cache
    key uniquely identifies its output content, using it transitively
    identifies segment N's start frame.

    Result: a chain re-run with the same inputs produces the same cache
    keys across every segment, so all of them hit cache on a retry.

    Stored at `<run_dir>/ai_video/seg_cache/<key>.mp4` and reused across
    retries.
    """
    payload = "|".join([
        prompt.strip(),
        str(int(duration_s)),
        resolution,
        aspect_ratio,
        "audio" if audio_on else "silent",
        str(int(seed)) if seed is not None else "noseed",
        prev_seg_key or "head",
    ])
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:12]


def _build_chain_html(
    *,
    shot_idx: int,
    video_url: str,
    audio_policy: str,
) -> str:
    """Shorthand — chain output gets the same HTML as a single-shot, since
    we concat all segments into one MP4 before this point."""
    return build_ai_video_html(
        shot_idx=shot_idx, video_url=video_url, audio_policy=audio_policy,
    )


def orchestrate_ai_video_chain(
    *,
    shot: Dict[str, Any],
    shot_idx: int,
    run_dir: Path,
    veo_client: Any,
    cost_tracker: Optional[AiVideoCostTracker],
    ledger: Optional["_LedgerType"] = None,  # AiVideoLedger, duck-typed
    upload_mp4_fn: Callable[[Path], Optional[str]],
    upload_frame_fn: Optional[Callable[[Path], Optional[str]]] = None,
    canvas: str = "landscape",
    run_audio_enabled: bool = False,
    safety_tolerance: str = "3",
    log_fn: Optional[Callable[[str], None]] = None,
) -> AiVideoShotResult:
    """Multi-segment AI video chain (Phase 4).

    Loops the Veo client across `_resolve_segments(shot)`. First segment is
    text-to-video; each subsequent segment downloads the prior MP4, extracts
    the last frame, uploads it (via `upload_frame_fn` or falls back to
    `upload_mp4_fn`), and submits an image-to-video Veo call. All segments
    are concatenated via ffmpeg into a single MP4 and uploaded via
    `upload_mp4_fn` for the final HTML.

    Dependency injection of the upload functions keeps this orchestrator
    free of S3 state. Tests pass a fake that returns predictable URLs;
    production passes the real S3 service wrapper.

    Cost behavior:
      - `try_charge` is called per-segment BEFORE that segment's Veo call.
        A cap exhaustion mid-chain returns the chain-so-far as an error
        result; partial output is NOT shipped because a truncated chain
        would shorten the shot below the planned duration.
      - On any failure, every segment's reservation is refunded (so a
        cap-tripped shot doesn't permanently eat budget).

    Returns AiVideoShotResult with `error=None` on success, populated
    error on any failure. NO exceptions leak.
    """
    def _log(msg: str) -> None:
        if log_fn is not None:
            try: log_fn(msg)
            except Exception: pass
        logger.info(msg)

    # Lazy import — same pattern as single-shot orchestrator
    try:
        from app.services.fal_veo_client import VeoError, price_per_call_usd
    except ImportError:
        try:
            from fal_veo_client import VeoError, price_per_call_usd  # type: ignore[no-redef]
        except ImportError as imp_err:
            return AiVideoShotResult(
                shot_idx=shot_idx,
                error=f"fal_veo_client import failed: {imp_err}",
                error_class="ImportError",
                skipped=True,
            )

    # ── 1. Resolve segments ──────────────────────────────────────────
    segments_spec = _resolve_segments(shot)
    if not segments_spec:
        return AiVideoShotResult(
            shot_idx=shot_idx,
            error="ai_video chain has no resolvable segments (missing ai_video_prompt or ai_video_segments)",
            error_class="AiVideoSpecError",
        )

    # Director may have requested more than MAX_CHAIN_SEGMENTS — warn so we
    # have a paper trail when a shot got truncated.
    requested = shot.get("ai_video_segments") or []
    if isinstance(requested, list) and len(requested) > MAX_CHAIN_SEGMENTS:
        _log(
            f"⚠️  AI_VIDEO_HERO shot {shot_idx}: chain truncated from "
            f"{len(requested)} to {MAX_CHAIN_SEGMENTS} segments (budget guard)"
        )

    # ── 2. Resolve common Veo params ──────────────────────────────────
    aspect_ratio = _resolve_aspect_ratio(canvas)
    resolution = "720p"
    audio_policy = (shot.get("audio_policy") or "narration_only").strip().lower()
    audio_on = _resolve_audio_flag(
        audio_policy=audio_policy,
        ai_video_audio=bool(shot.get("ai_video_audio")),
        run_audio_enabled=run_audio_enabled,
    )
    seed = shot.get("ai_video_seed")
    try:
        seed_int = int(seed) if seed is not None else None
    except (TypeError, ValueError):
        seed_int = None
    negative_prompt = (shot.get("ai_video_negative_prompt") or "").strip() or None

    # ── 3. Pre-flight cost check ─────────────────────────────────────
    # Total cost is fully known up-front (params determine price). Reserve
    # the whole budget atomically — if we can't, fail fast WITHOUT making
    # any Veo calls. This avoids the "half a chain shipped before cap
    # tripped" outcome.
    _chain_model = getattr(veo_client, "_model", None)
    per_seg_costs = [
        price_per_call_usd(
            resolution=resolution, duration_s=seg["duration_s"],
            audio_on=audio_on, model=_chain_model,
        )
        for seg in segments_spec
    ]
    total_cost = sum(per_seg_costs)
    if cost_tracker is not None:
        try:
            cost_tracker.try_charge(total_cost)
        except CircuitBreakerExhausted as cap_err:
            _log(
                f"🛑 AI_VIDEO_HERO chain shot {shot_idx}: chain total "
                f"${total_cost:.2f} would exceed cap "
                f"(${cost_tracker.spent_usd:.2f}/${cost_tracker.cap_usd:.2f}); "
                f"falling back."
            )
            return AiVideoShotResult(
                shot_idx=shot_idx,
                duration_s=sum(s["duration_s"] for s in segments_spec),
                resolution=resolution,
                aspect_ratio=aspect_ratio,
                audio_on=audio_on,
                cost_usd=0.0,
                error=str(cap_err),
                error_class="CircuitBreakerExhausted",
                skipped=True,
            )

    # Credit-ledger deduction mirrors the chain's all-or-nothing tracker
    # reservation: one charge for the whole chain. Per-segment refunds
    # (cache hits, mid-chain failures) prorate against this single
    # deduction. On insufficient balance: roll back the tracker reservation
    # and fall back exactly like CircuitBreakerExhausted.
    chain_charged_credits: Decimal = Decimal("0")
    # Per-segment credits — derived proportionally from chain_charged_credits.
    # `_refund_chain_ledger` uses them to refund the un-executed range.
    per_seg_credits: List[Decimal] = [Decimal("0")] * len(per_seg_costs)
    if ledger is not None and getattr(ledger, "enabled", False):
        _LedgerInsufficient = _load_ledger_insufficient_exc()
        try:
            chain_charged_credits = ledger.charge(
                cost_usd=total_cost,
                shot_idx=shot_idx,
                duration_s=sum(int(s["duration_s"]) for s in segments_spec),
                audio_on=audio_on,
            )
            # Allocate per-segment credits proportionally to USD costs so
            # mid-chain refunds use exact credit amounts (no rounding drift
            # versus the total). Last segment absorbs any rounding residue.
            if chain_charged_credits > 0 and total_cost > 0:
                allocated = Decimal("0")
                for i, sc in enumerate(per_seg_costs):
                    if i < len(per_seg_costs) - 1:
                        share = (
                            chain_charged_credits * Decimal(str(sc)) / Decimal(str(total_cost))
                        ).quantize(Decimal("0.0001"))
                        per_seg_credits[i] = share
                        allocated += share
                    else:
                        per_seg_credits[i] = chain_charged_credits - allocated
        except Exception as ledger_err:  # noqa: BLE001
            is_insufficient = (
                _LedgerInsufficient is not None
                and isinstance(ledger_err, _LedgerInsufficient)
            )
            if cost_tracker is not None:
                cost_tracker.refund(total_cost)
                cost_tracker.mark_skipped_circuit_breaker()
            if is_insufficient:
                _log(
                    f"🛑 AI_VIDEO_HERO chain shot {shot_idx}: credit ledger said "
                    f"insufficient balance for ~${total_cost:.2f}; falling back."
                )
                return AiVideoShotResult(
                    shot_idx=shot_idx,
                    duration_s=sum(s["duration_s"] for s in segments_spec),
                    resolution=resolution,
                    aspect_ratio=aspect_ratio,
                    audio_on=audio_on,
                    cost_usd=0.0,
                    error=str(ledger_err),
                    error_class="CircuitBreakerExhausted",
                    skipped=True,
                )
            # Transient ledger error: log and proceed without ledger
            # accounting (same policy as single-shot). Pipeline-abort
            # refund (refund_video_credits by batch_id) is the backstop.
            _log(
                f"⚠️  AI_VIDEO_HERO chain shot {shot_idx}: ledger.charge unexpectedly "
                f"raised {type(ledger_err).__name__}: {ledger_err}; proceeding "
                f"without ledger deduction."
            )

    # ── 4. Per-segment caching ───────────────────────────────────────
    seg_cache_dir = run_dir / "ai_video" / "seg_cache"
    seg_cache_dir.mkdir(parents=True, exist_ok=True)

    chain_dir = run_dir / "ai_video"
    chain_dir.mkdir(parents=True, exist_ok=True)

    # ── 5. Loop segments ─────────────────────────────────────────────
    rendered_segments: List[Dict[str, Any]] = []
    segment_paths: List[Path] = []
    prev_frame_url: Optional[str] = None
    prev_seg_key: Optional[str] = None  # cache key of the previous segment
    chain_start = _time.time()

    for seg_idx, seg_spec in enumerate(segments_spec):
        seg_prompt = seg_spec["prompt"]
        seg_dur = seg_spec["duration_s"]
        seg_start_frame_url: Optional[str] = prev_frame_url if seg_idx > 0 else None

        # Per-segment cache key. Uses `prev_seg_key` (NOT the volatile upload
        # URL) so a re-run with the same chain spec hits cache on every
        # segment — including those past the first.
        ck = _segment_cache_key(
            prompt=seg_prompt, duration_s=seg_dur, resolution=resolution,
            aspect_ratio=aspect_ratio, audio_on=audio_on, seed=seed_int,
            prev_seg_key=prev_seg_key,
        )
        cached_mp4 = seg_cache_dir / f"{ck}.mp4"
        cached_meta = seg_cache_dir / f"{ck}.json"

        if cached_mp4.exists() and cached_meta.exists():
            # Cache hit — reuse. Refund the budget reservation for this segment.
            try:
                meta = json.loads(cached_meta.read_text(encoding="utf-8"))
            except Exception:
                meta = {}
            if cost_tracker is not None:
                cost_tracker.refund(per_seg_costs[seg_idx])
            if ledger is not None and per_seg_credits[seg_idx] > 0:
                ledger.refund(
                    credits=per_seg_credits[seg_idx],
                    shot_idx=shot_idx,
                    segment_idx=seg_idx,
                    reason="cache hit",
                )
            video_url = meta.get("video_url") or ""
            req_id = meta.get("request_id") or f"cached_{ck}"
            _log(
                f"♻️  AI_VIDEO_HERO chain shot {shot_idx} seg {seg_idx}: "
                f"cache hit ({ck}, ${per_seg_costs[seg_idx]:.2f} refunded)"
            )
            segment_paths.append(cached_mp4)
            rendered_segments.append({
                "seg_idx": seg_idx,
                "video_url": video_url,
                "duration_s": seg_dur,
                "request_id": req_id,
                "cache_hit": True,
            })
            # NB: prev_frame_url is intentionally reset — even on cache hit we
            # must re-extract the last frame for the next segment, since the
            # uploaded frame URL from a previous run isn't preserved in cache.
            prev_frame_url = None
            # Cache-hit segments still need their last frame extracted +
            # uploaded for the next segment's image_url. Handle that the same
            # way as fresh segments (after this block) via the loop tail.
            if seg_idx < len(segments_spec) - 1:
                frame_path = chain_dir / f"shot_{shot_idx:03d}_seg{seg_idx:02d}_last.png"
                if not _ffmpeg_extract_last_frame(cached_mp4, frame_path):
                    _refund_chain(
                        cost_tracker, per_seg_costs, seg_idx + 1,
                        ledger=ledger, per_seg_credits=per_seg_credits,
                        shot_idx=shot_idx, reason="cached frame extract failed",
                    )
                    if cost_tracker is not None: cost_tracker.mark_failed()
                    return AiVideoShotResult(
                        shot_idx=shot_idx, duration_s=sum(s["duration_s"] for s in segments_spec),
                        resolution=resolution, aspect_ratio=aspect_ratio, audio_on=audio_on,
                        cost_usd=0.0,
                        error=f"last-frame extract failed on cached seg {seg_idx}",
                        error_class="FfmpegError",
                        segments=rendered_segments,
                    )
                uploader = upload_frame_fn or upload_mp4_fn
                uploaded_url = uploader(frame_path) if uploader else None
                if not uploaded_url:
                    _refund_chain(
                        cost_tracker, per_seg_costs, seg_idx + 1,
                        ledger=ledger, per_seg_credits=per_seg_credits,
                        shot_idx=shot_idx, reason="cached frame upload failed",
                    )
                    if cost_tracker is not None: cost_tracker.mark_failed()
                    return AiVideoShotResult(
                        shot_idx=shot_idx, duration_s=sum(s["duration_s"] for s in segments_spec),
                        resolution=resolution, aspect_ratio=aspect_ratio, audio_on=audio_on,
                        cost_usd=0.0,
                        error=f"frame upload returned no URL on cached seg {seg_idx}",
                        error_class="UploadError",
                        segments=rendered_segments,
                    )
                prev_frame_url = uploaded_url
            # Update prev_seg_key so the NEXT segment's cache key chains off
            # this one's identity, regardless of cache hit/miss.
            prev_seg_key = ck
            continue

        # Cache miss — call Veo
        _log(
            f"🎬 AI_VIDEO_HERO chain shot {shot_idx} seg {seg_idx + 1}/{len(segments_spec)}: "
            f"{seg_dur}s, ${per_seg_costs[seg_idx]:.2f}"
            + (f", start_frame={seg_start_frame_url[:60]}..." if seg_start_frame_url else "")
        )
        try:
            if seg_idx == 0:
                veo_result = veo_client.generate_text_to_video(
                    prompt=seg_prompt,
                    duration_s=seg_dur,
                    aspect_ratio=aspect_ratio,
                    resolution=resolution,
                    generate_audio=audio_on,
                    negative_prompt=negative_prompt,
                    seed=seed_int,
                    auto_fix=True,
                    safety_tolerance=safety_tolerance,
                )
            else:
                if not seg_start_frame_url:
                    raise RuntimeError(
                        f"chain segment {seg_idx} missing start_frame_url — last-frame "
                        f"extraction or upload failed on segment {seg_idx - 1}"
                    )
                veo_result = veo_client.generate_image_to_video(
                    prompt=seg_prompt,
                    image_url=seg_start_frame_url,
                    duration_s=seg_dur,
                    aspect_ratio=aspect_ratio,
                    resolution=resolution,
                    generate_audio=audio_on,
                    negative_prompt=negative_prompt,
                    seed=seed_int,
                    auto_fix=True,
                    safety_tolerance=safety_tolerance,
                )
        except VeoError as err:
            klass = type(err).__name__
            _refund_chain(
                cost_tracker, per_seg_costs, seg_idx,
                ledger=ledger, per_seg_credits=per_seg_credits,
                shot_idx=shot_idx, reason=klass,
            )
            if cost_tracker is not None: cost_tracker.mark_failed()
            _log(f"❌ AI_VIDEO_HERO chain shot {shot_idx} seg {seg_idx}: {klass}: {err}")
            return AiVideoShotResult(
                shot_idx=shot_idx, duration_s=sum(s["duration_s"] for s in segments_spec),
                resolution=resolution, aspect_ratio=aspect_ratio, audio_on=audio_on,
                cost_usd=0.0, error=str(err), error_class=klass,
                segments=rendered_segments,
            )
        except Exception as err:
            klass = type(err).__name__
            _refund_chain(
                cost_tracker, per_seg_costs, seg_idx,
                ledger=ledger, per_seg_credits=per_seg_credits,
                shot_idx=shot_idx, reason=f"unexpected:{klass}",
            )
            if cost_tracker is not None: cost_tracker.mark_failed()
            _log(f"❌ AI_VIDEO_HERO chain shot {shot_idx} seg {seg_idx}: unexpected {klass}: {err}")
            return AiVideoShotResult(
                shot_idx=shot_idx, duration_s=sum(s["duration_s"] for s in segments_spec),
                resolution=resolution, aspect_ratio=aspect_ratio, audio_on=audio_on,
                cost_usd=0.0, error=str(err), error_class=klass,
                segments=rendered_segments,
            )

        # Download the segment locally so we can a) extract last frame, b) concat.
        # (Per-segment Veo elapsed time is captured in the segment record but
        # not accumulated separately — the chain wall-clock from `chain_start`
        # already covers it for the run summary.)
        seg_local = seg_cache_dir / f"{ck}.mp4"
        if not _download_url_to_path(veo_result.video_url, seg_local):
            _refund_chain(
                cost_tracker, per_seg_costs, seg_idx + 1,
                ledger=ledger, per_seg_credits=per_seg_credits,
                shot_idx=shot_idx, reason="segment download failed",
            )
            if cost_tracker is not None: cost_tracker.mark_failed()
            return AiVideoShotResult(
                shot_idx=shot_idx, duration_s=sum(s["duration_s"] for s in segments_spec),
                resolution=resolution, aspect_ratio=aspect_ratio, audio_on=audio_on,
                cost_usd=0.0,
                error=f"segment {seg_idx} download failed from {veo_result.video_url[:80]}",
                error_class="VeoDownloadError",
                segments=rendered_segments,
            )
        # Persist cache metadata so re-runs can reuse this segment.
        try:
            cached_meta.write_text(json.dumps({
                "request_id": veo_result.request_id,
                "video_url": veo_result.video_url,
                "duration_s": veo_result.duration_s,
                "resolution": veo_result.resolution,
                "aspect_ratio": veo_result.aspect_ratio,
                "audio_on": veo_result.audio_on,
                "cost_usd": veo_result.cost_usd,
                "start_frame_url": seg_start_frame_url,
            }, indent=2), encoding="utf-8")
        except Exception as meta_err:
            _log(f"⚠️  AI_VIDEO_HERO chain shot {shot_idx} seg {seg_idx}: cache metadata write failed: {meta_err}")

        segment_paths.append(seg_local)
        rendered_segments.append({
            "seg_idx": seg_idx,
            "video_url": veo_result.video_url,
            "duration_s": veo_result.duration_s,
            "request_id": veo_result.request_id,
            "cache_hit": False,
        })

        # If this isn't the last segment, extract its last frame + upload it
        # so the next iteration can use it as image_url.
        if seg_idx < len(segments_spec) - 1:
            frame_path = chain_dir / f"shot_{shot_idx:03d}_seg{seg_idx:02d}_last.png"
            if not _ffmpeg_extract_last_frame(seg_local, frame_path):
                _refund_chain(
                    cost_tracker, per_seg_costs, seg_idx + 1,
                    ledger=ledger, per_seg_credits=per_seg_credits,
                    shot_idx=shot_idx, reason="frame extract failed",
                )
                if cost_tracker is not None: cost_tracker.mark_failed()
                return AiVideoShotResult(
                    shot_idx=shot_idx, duration_s=sum(s["duration_s"] for s in segments_spec),
                    resolution=resolution, aspect_ratio=aspect_ratio, audio_on=audio_on,
                    cost_usd=0.0,
                    error=f"last-frame extract failed on seg {seg_idx}",
                    error_class="FfmpegError",
                    segments=rendered_segments,
                )
            uploader = upload_frame_fn or upload_mp4_fn
            uploaded_url = uploader(frame_path) if uploader else None
            if not uploaded_url:
                _refund_chain(
                    cost_tracker, per_seg_costs, seg_idx + 1,
                    ledger=ledger, per_seg_credits=per_seg_credits,
                    shot_idx=shot_idx, reason="frame upload failed",
                )
                if cost_tracker is not None: cost_tracker.mark_failed()
                return AiVideoShotResult(
                    shot_idx=shot_idx, duration_s=sum(s["duration_s"] for s in segments_spec),
                    resolution=resolution, aspect_ratio=aspect_ratio, audio_on=audio_on,
                    cost_usd=0.0,
                    error=f"frame upload returned no URL on seg {seg_idx}",
                    error_class="UploadError",
                    segments=rendered_segments,
                )
            prev_frame_url = uploaded_url
        # Carry this segment's cache key forward so segment N+1 chains its
        # cache key off this one's stable identity (not the volatile URL).
        prev_seg_key = ck

    # ── 6. Concat all segments + upload final MP4 ────────────────────
    if cost_tracker is not None:
        cost_tracker.mark_completed()
    final_mp4 = chain_dir / f"shot_{shot_idx:03d}_chain.mp4"
    if not _ffmpeg_concat_mp4s(segment_paths, final_mp4):
        return AiVideoShotResult(
            shot_idx=shot_idx, duration_s=sum(s["duration_s"] for s in segments_spec),
            resolution=resolution, aspect_ratio=aspect_ratio, audio_on=audio_on,
            cost_usd=total_cost,
            error="ffmpeg concat failed at end of chain",
            error_class="FfmpegError",
            segments=rendered_segments,
        )
    final_url = upload_mp4_fn(final_mp4) if upload_mp4_fn else None
    if not final_url:
        return AiVideoShotResult(
            shot_idx=shot_idx, duration_s=sum(s["duration_s"] for s in segments_spec),
            resolution=resolution, aspect_ratio=aspect_ratio, audio_on=audio_on,
            cost_usd=total_cost,
            error="concat output upload returned no URL",
            error_class="UploadError",
            segments=rendered_segments,
        )

    # Persist top-level chain metadata
    try:
        (chain_dir / f"shot_{shot_idx:03d}.json").write_text(json.dumps({
            "shot_idx": shot_idx,
            "video_url": final_url,
            "duration_s": sum(s["duration_s"] for s in segments_spec),
            "resolution": resolution,
            "aspect_ratio": aspect_ratio,
            "audio_on": audio_on,
            "cost_usd": total_cost,
            "segments": rendered_segments,
            "elapsed_total_s": round(_time.time() - chain_start, 2),
        }, indent=2), encoding="utf-8")
    except Exception as meta_err:
        _log(f"⚠️  AI_VIDEO_HERO chain shot {shot_idx}: top-level meta write failed: {meta_err}")

    html = _build_chain_html(shot_idx=shot_idx, video_url=final_url, audio_policy=audio_policy)
    chain_elapsed = round(_time.time() - chain_start, 2)
    _log(
        f"✅ AI_VIDEO_HERO chain shot {shot_idx}: "
        f"{len(rendered_segments)} segments, {chain_elapsed:.1f}s wall, "
        f"${total_cost:.3f}, {final_url[:80]}"
    )
    # Net credit cost for this chain = sum of per-segment credits for
    # segments that actually billed (i.e. cache misses). Cache hits were
    # refunded mid-loop, so they don't count toward what the institute
    # paid. The cost-tracker's USD `spent` math mirrors this.
    net_credits = Decimal("0")
    if ledger is not None and getattr(ledger, "enabled", False):
        for i, seg in enumerate(rendered_segments):
            if not seg.get("cache_hit") and i < len(per_seg_credits):
                net_credits += per_seg_credits[i]
    return AiVideoShotResult(
        shot_idx=shot_idx,
        html=html,
        video_url=final_url,
        request_id=rendered_segments[-1]["request_id"] if rendered_segments else "",
        duration_s=sum(s["duration_s"] for s in segments_spec),
        resolution=resolution,
        aspect_ratio=aspect_ratio,
        audio_on=audio_on,
        cost_usd=total_cost,
        cost_credits=float(net_credits),
        elapsed_s=chain_elapsed,
        segments=rendered_segments,
    )


def _refund_chain(
    cost_tracker: Optional[AiVideoCostTracker],
    per_seg_costs: List[float],
    seg_idx_failed: int,
    *,
    ledger: Optional["_LedgerType"] = None,
    per_seg_credits: Optional[List[Decimal]] = None,
    shot_idx: int = -1,
    reason: str = "chain failure",
) -> None:
    """Refund unspent budget for segments not yet executed.

    Segments [0, seg_idx_failed) succeeded; segments [seg_idx_failed, end)
    will not run. Refund the latter range so a chain failure mid-way doesn't
    permanently consume budget for segments we never tried.

    When `ledger` is supplied (Phase 2 wiring), also issues REFUND rows
    against the global credit ledger for the same unexecuted range — the
    in-process tracker and the institute-level ledger stay in lockstep.
    """
    if cost_tracker is not None:
        refund_amount = sum(per_seg_costs[seg_idx_failed:])
        if refund_amount > 0:
            cost_tracker.refund(refund_amount)

    if ledger is not None and per_seg_credits is not None:
        refund_credits = sum(per_seg_credits[seg_idx_failed:], Decimal("0"))
        if refund_credits > 0:
            ledger.refund(
                credits=refund_credits,
                shot_idx=shot_idx,
                reason=reason,
            )


# ===========================================================================
# Phase 5 — master narration silencing for intrinsic_only shot windows
# ===========================================================================
#
# When a shot has audio_policy=intrinsic_only (the orchestrator sets this for
# AI_VIDEO_HERO + ai_video_audio=true + run audio enabled), TWO audio sources
# would play simultaneously in the final MP4 unless we intervene:
#   1. Master narration (covers the full video duration)
#   2. Veo audio embedded in the <video> element (the browser plays it during
#      that shot's window since the orchestrator emits the <video> unmuted)
#
# The render server's audio mix is: master narration + browser-captured audio.
# Without silencing master narration in the intrinsic_only window, the user
# hears narration AND Veo audio simultaneously — exactly the wrong mix.
#
# Fix: post-process master narration.mp3 to zero-volume the affected windows
# BEFORE render compose. The browser-rendered Veo audio fills the silence at
# render time, no further mixing needed.
#
# These helpers are deliberately pure (path-in/path-out, returns bool) so
# they're testable in isolation and slot into the pipeline as a single
# conditional call after master narration is finalized.


def collect_intrinsic_audio_ranges(
    entries: List[Dict[str, Any]],
) -> List[tuple[float, float]]:
    """Scan a timeline entry list and return [(start_s, end_s)] for every
    shot whose audio is intrinsic — i.e. where the master narration MUST be
    silenced so the shot's embedded audio plays alone.

    Identifies an intrinsic shot by EITHER:
      - `_ai_video_audio_on == True` on the entry (set by the orchestrator
        when audio_policy=intrinsic_only AND Veo's generate_audio fired), OR
      - explicit `_audio_policy == "intrinsic_only"` on the entry (future-
        proofs the helper against non-AI-video intrinsic sources like
        source-clip native VO when those land).

    Ranges are clamped to non-negative starts and merged when adjacent /
    overlapping. Empty input → empty output. Out-of-order entries are
    tolerated (we sort before merging).
    """
    raw_ranges: List[tuple[float, float]] = []
    for e in entries:
        if not isinstance(e, dict):
            continue
        is_intrinsic = bool(e.get("_ai_video_audio_on")) or (
            (e.get("_audio_policy") or "").lower() == "intrinsic_only"
        )
        if not is_intrinsic:
            continue
        try:
            start = max(0.0, float(e.get("start") or 0.0))
            end = max(start, float(e.get("end") or 0.0))
        except (TypeError, ValueError):
            continue
        if end > start:
            raw_ranges.append((start, end))
    if not raw_ranges:
        return []
    # Sort + merge overlaps so the ffmpeg expression stays compact.
    raw_ranges.sort()
    merged: List[tuple[float, float]] = [raw_ranges[0]]
    for s, e in raw_ranges[1:]:
        last_s, last_e = merged[-1]
        if s <= last_e:
            merged[-1] = (last_s, max(last_e, e))
        else:
            merged.append((s, e))
    return merged


def _make_silence_enable_expr(ranges_s: List[tuple[float, float]]) -> str:
    """Build the ffmpeg `enable=` expression that activates the volume=0
    filter ONLY during the given ranges. Multiple ranges are OR'd via `+`.

    Returns "0" (never-enable) for empty input — callers should skip the
    ffmpeg call entirely when this happens, but the safe default keeps the
    pipeline running if they don't.
    """
    parts = [f"between(t,{s:.3f},{e:.3f})" for s, e in ranges_s if e > s]
    return "+".join(parts) if parts else "0"


def silence_audio_ranges(
    input_audio_path: Path,
    output_audio_path: Path,
    ranges_s: List[tuple[float, float]],
    *,
    ffmpeg_bin: str = _FFMPEG_BIN,
    timeout_s: float = _FFMPEG_CONCAT_TIMEOUT_S,
) -> bool:
    """Produce `output_audio_path` = `input_audio_path` with audio zeroed in
    each `(start_s, end_s)` range.

    Uses ffmpeg's `volume` filter with a time-conditional `enable=`. Re-
    encodes at libmp3lame q=4 (matching the per-shot TTS encoder so the
    output blends cleanly downstream).

    Returns True on success, False on:
      - empty input ranges (caller would have called this for nothing)
      - missing input file
      - ffmpeg failure / timeout / binary missing

    Pure: path-in, path-out, no state. Caller decides whether to overwrite
    the master narration or write to a sidecar.
    """
    if not ranges_s:
        return False
    if not input_audio_path.exists():
        logger.warning(f"[Veo audio] silence: input missing {input_audio_path}")
        return False
    output_audio_path.parent.mkdir(parents=True, exist_ok=True)
    enable_expr = _make_silence_enable_expr(ranges_s)
    cmd = [
        ffmpeg_bin, "-y", "-loglevel", "error",
        "-i", str(input_audio_path),
        "-af", f"volume=0:enable='{enable_expr}'",
        "-c:a", "libmp3lame", "-q:a", "4",
        str(output_audio_path),
    ]
    try:
        proc = subprocess.run(cmd, capture_output=True, text=True, timeout=timeout_s)
    except subprocess.TimeoutExpired:
        logger.warning(f"[Veo audio] silence timed out on {input_audio_path}")
        return False
    except FileNotFoundError:
        logger.warning(f"[Veo audio] ffmpeg binary '{ffmpeg_bin}' not found")
        return False
    if proc.returncode != 0:
        logger.warning(
            f"[Veo audio] silence failed (rc={proc.returncode}): "
            f"{(proc.stderr or '').strip()[:200]}"
        )
        return False
    return output_audio_path.exists() and output_audio_path.stat().st_size > 0


def mute_master_narration_for_intrinsic_shots(
    entries: List[Dict[str, Any]],
    master_narration_path: Path,
    *,
    output_path: Optional[Path] = None,
    log_fn: Optional[Callable[[str], None]] = None,
) -> Dict[str, Any]:
    """One-call entry point for the pipeline.

    Scans `entries` for intrinsic_only shots; if any, post-processes
    `master_narration_path` so master narration is silent during those
    windows. Browser-rendered Veo audio fills the gap at render time.

    Returns a result dict the pipeline can use for telemetry:
      {
        "processed":  bool,      # True if we actually muted something
        "ranges":     [...],     # the merged ranges silenced
        "output":     Path,      # final narration path (input or muted)
        "in_place":   bool,      # True if we overwrote the master
        "error":      str|None,  # populated only on ffmpeg failure
      }

    When no intrinsic_only shots are present, returns `processed=False`
    with `output=master_narration_path` so the caller can use the same
    variable in either case.
    """
    def _log(msg: str) -> None:
        if log_fn is not None:
            try: log_fn(msg)
            except Exception: pass
        logger.info(msg)

    ranges = collect_intrinsic_audio_ranges(entries)
    if not ranges:
        return {
            "processed": False,
            "ranges": [],
            "output": master_narration_path,
            "in_place": False,
            "error": None,
        }

    # Default sidecar path: alongside the master narration so the input file
    # is preserved (useful for debugging and for the case where post-render
    # we want to inspect the original). The caller passes `output_path` when
    # they want a specific name (e.g. in-place overwrite via two-step swap).
    if output_path is None:
        output_path = master_narration_path.with_name(
            f"{master_narration_path.stem}_intrinsic_muted{master_narration_path.suffix}"
        )

    total_muted_s = sum(e - s for s, e in ranges)
    _log(
        f"🔇 Muting master narration in {len(ranges)} intrinsic_only window(s) "
        f"({total_muted_s:.1f}s total) for Veo-audio shots"
    )

    ok = silence_audio_ranges(master_narration_path, output_path, ranges)
    if not ok:
        return {
            "processed": False,
            "ranges": ranges,
            "output": master_narration_path,
            "in_place": False,
            "error": "ffmpeg silence failed (see prior log)",
        }
    return {
        "processed": True,
        "ranges": ranges,
        "output": output_path,
        "in_place": False,
        "error": None,
    }
