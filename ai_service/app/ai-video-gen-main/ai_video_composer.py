"""AI Video Composer — Phase 6.

Scans shot HTML for `<aivideo>` tags and substitutes a rendered `<video>`
element backed by a Veo MP4. Parallel to `skill_composer.py` in shape and
contract.

Why inline rather than full-canvas: composite shots (e.g. side-by-side
comparison, picture-in-picture) need AI-generated video embedded INSIDE
other HTML, not replacing the whole shot. AI_VIDEO_HERO is the full-canvas
variant; `<aivideo>` is the inline variant.

Tag syntax (the per-shot HTML LLM emits these; ai_video teaching block in
prompts.py explains it):

    <aivideo
      data-prompt="a coral reef teeming with fish"
      data-duration="6"
      data-audio="false"
      data-aspect="16:9"
    ></aivideo>

  - data-prompt   : required; visual description, third-person present tense
  - data-duration : 4 | 6 | 8 (snapped to nearest allowed)
  - data-audio    : "true"|"false"; only honored when run-level audio is on AND
                    audio_policy of the host shot is intrinsic_only
  - data-aspect   : "16:9"|"9:16"; inherits shot orientation when omitted

Composer ordering in `_shot_task`:
    clamp_animations → skill_compose → ai_video_compose → ensure_fonts → transition_picker

Important: skills can emit `<aivideo>` tags (resolved on the next pass);
`<aivideo>` cannot emit skills (we don't re-run the skill composer after
this stage to avoid recursion).

Cost behavior:
  - Each `<aivideo>` resolution is one Veo call, charged against the
    per-video circuit breaker via the shared `AiVideoCostTracker`
  - When the cap is exhausted mid-shot, remaining `<aivideo>` tags
    resolve to a CSS gradient placeholder and the shot logs
    `circuit_breaker_partial=true` for telemetry
  - On any Veo failure (safety block, timeout): same fallback — placeholder
    plus per-tag error logged
"""
from __future__ import annotations

import html as _html
import re
from decimal import Decimal
from typing import Any, Callable, Dict, List, Optional


def _load_ledger_insufficient_exc():
    """Lazy-load `AiVideoLedgerInsufficient`. See orchestrator for the same
    pattern — keeps the composer importable when the credit stack isn't
    on path (unit tests, standalone usage)."""
    try:
        from app.services.ai_video_ledger import AiVideoLedgerInsufficient
        return AiVideoLedgerInsufficient
    except ImportError:
        try:
            from ai_video_ledger import AiVideoLedgerInsufficient  # type: ignore[no-redef]
            return AiVideoLedgerInsufficient
        except ImportError:
            return None


# Regex that captures an <aivideo> tag with its data-* attributes.
# We don't require attribute order — instead we extract attrs separately
# via _parse_attrs below to be robust to attribute ordering.
_AIVIDEO_TAG_RE = re.compile(
    r"<aivideo\b([^>]*?)(?:/\s*>|>\s*</aivideo\s*>)",
    re.DOTALL | re.IGNORECASE,
)

# Per-attribute regex used to pull values out of an attribute string. Captures
# both single- and double-quoted values.
_ATTR_RE = re.compile(
    r"""data-([a-z0-9_-]+)\s*=\s*(['"])(.*?)\2""",
    re.DOTALL | re.IGNORECASE,
)

# Allowed values mirror fal_veo_client + ai_video_orchestrator. Duplicated
# here to avoid import cycles and to keep the composer self-contained.
_ALLOWED_DURATIONS_S = (4, 6, 8)
_ALLOWED_ASPECTS = ("16:9", "9:16")


def _parse_attrs(attr_str: str) -> Dict[str, str]:
    """Parse `data-*` attributes from a tag's attribute string into a flat
    dict, lower-casing keys but preserving values verbatim. Unknown attrs
    are kept too — caller decides what to do with them."""
    return {
        m.group(1).lower(): m.group(3)
        for m in _ATTR_RE.finditer(attr_str or "")
    }


def _coerce_duration(value: Any) -> int:
    """Snap an arbitrary duration to one of (4, 6, 8). Mirrors
    ai_video_orchestrator._normalize_duration_s with tie-break to larger
    (more visual for the same cost)."""
    try:
        v = float(value) if value not in (None, "") else 8.0
    except (TypeError, ValueError):
        return 8
    if v <= 0:
        return 8
    return min(_ALLOWED_DURATIONS_S, key=lambda d: (abs(d - v), -d))


def _coerce_aspect(value: Any, default: str) -> str:
    if isinstance(value, str) and value.strip() in _ALLOWED_ASPECTS:
        return value.strip()
    return default


def _coerce_bool(value: Any) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        return value.strip().lower() in ("true", "1", "yes")
    return False


def _placeholder_html(*, reason: str, prompt: str) -> str:
    """A minimal CSS gradient placeholder when a `<aivideo>` tag fails to
    resolve. Sized to fill its parent; carries an `aria-label` so the LLM /
    QA can identify it; opaque enough that it doesn't reveal anything below."""
    safe = _html.escape((prompt or "")[:80], quote=True)
    safe_reason = _html.escape(reason[:120], quote=True)
    return (
        f'<div class="aivideo-placeholder" role="img" '
        f'aria-label="AI video unavailable — {safe}" '
        f'data-fallback-reason="{safe_reason}" '
        'style="position:absolute;inset:0;'
        'background:linear-gradient(135deg,#1a1f2e 0%,#2d3748 50%,#1a1f2e 100%);'
        'overflow:hidden;"></div>'
    )


def _video_html(*, video_url: str, audio_on: bool) -> str:
    """Inline `<video>` element for a successfully-resolved tag.
    Always autoplay + loop + playsinline. `muted` is gated by audio_on —
    same rule as ai_video_orchestrator.build_ai_video_html."""
    src = _html.escape(video_url, quote=True)
    muted_attr = "" if audio_on else "muted"
    return (
        f'<video class="aivideo-inline" '
        f'src="{src}" autoplay {muted_attr} loop playsinline preload="auto" '
        'style="position:absolute;inset:0;width:100%;height:100%;'
        'object-fit:cover;pointer-events:none;"></video>'
    )


def compose(
    shot_html: str,
    ctx: Dict[str, Any],
    *,
    veo_client: Any,
    cost_tracker: Optional[Any] = None,
    ledger: Optional[Any] = None,  # AiVideoLedger, duck-typed
    run_audio_enabled: bool = False,
    safety_tolerance: str = "3",
    log_fn: Optional[Callable[[str], None]] = None,
) -> Dict[str, Any]:
    """Replace every `<aivideo>` tag in `shot_html` with a `<video>` element.

    Args:
      shot_html: Raw HTML from the per-shot LLM. May contain zero or more
                 `<aivideo>` tags.
      ctx: Rendering context — at minimum `shot_index`, `canvas` ("portrait"
           or "landscape"), and `audio_policy` (the host shot's policy —
           inline `<aivideo>` audio inherits the policy of the containing
           shot, never independently elevates).
      veo_client: A FalVeoClient (or duck-typed equivalent with
                  `.generate_text_to_video(**kw) -> VeoResult`).
      cost_tracker: Optional `AiVideoCostTracker`. When provided, each
                    resolved tag is charged; when the cap trips, remaining
                    tags get the CSS placeholder.
      run_audio_enabled: Run-level toggle. When False, `data-audio="true"`
                         on an inline tag is silently overridden to False.
      safety_tolerance: Veo's `safety_tolerance` param, default "3".
      log_fn: Optional logger; defaults to print.

    Returns:
      dict with keys:
        - html: rewritten HTML
        - invocations: list per tag — {ok, prompt, duration_s, video_url|None,
                       cost_usd, error|None, error_class|None}
        - succeeded: int — count of resolved tags
        - failed: int — count of placeholder fallbacks
        - cost_usd: float — total spent on this shot's inline tags
        - circuit_breaker_partial: bool — True if cap tripped mid-shot

    No exceptions leak — every failure becomes a placeholder + an
    invocation record. The caller can treat composer output as
    drop-in-replaceable HTML.
    """
    def _log(msg: str) -> None:
        if log_fn is not None:
            try: log_fn(msg)
            except Exception: pass

    if not shot_html or "<aivideo" not in shot_html.lower():
        return {
            "html": shot_html or "",
            "invocations": [],
            "succeeded": 0,
            "failed": 0,
            "cost_usd": 0.0,
            "cost_credits": 0.0,
            "circuit_breaker_partial": False,
        }

    # Lazy import — keeps the composer importable for unit tests that don't
    # need the Veo client.
    try:
        from app.services.fal_veo_client import VeoError, price_per_call_usd
    except ImportError:
        try:
            from fal_veo_client import VeoError, price_per_call_usd  # type: ignore[no-redef]
        except ImportError as imp_err:
            return {
                "html": shot_html,
                "invocations": [{"ok": False, "error": f"fal_veo_client import failed: {imp_err}",
                                 "error_class": "ImportError"}],
                "succeeded": 0,
                "failed": 1,
                "cost_usd": 0.0,
                "cost_credits": 0.0,
                "circuit_breaker_partial": False,
            }

    shot_idx = int(ctx.get("shot_index") or 0)
    canvas = str(ctx.get("canvas") or "landscape").lower()
    default_aspect = "9:16" if canvas == "portrait" else "16:9"
    host_audio_policy = str(ctx.get("audio_policy") or "narration_only").lower()

    invocations: List[Dict[str, Any]] = []
    total_cost = 0.0
    total_credits = Decimal("0")
    succeeded = 0
    failed = 0
    cap_tripped = [False]  # mutable to write from inner _replace
    _LedgerInsufficient = _load_ledger_insufficient_exc()

    def _replace(match: re.Match) -> str:
        nonlocal total_cost, total_credits, succeeded, failed
        attrs = _parse_attrs(match.group(1))
        prompt = (attrs.get("prompt") or "").strip()

        # Missing prompt → placeholder. We don't bill anything for malformed
        # tags — they're an LLM mistake, not a Veo cost.
        if not prompt:
            failed += 1
            invocations.append({
                "ok": False, "prompt": "", "duration_s": 0, "video_url": None,
                "cost_usd": 0.0,
                "error": "missing data-prompt", "error_class": "AiVideoSpecError",
            })
            return _placeholder_html(reason="missing data-prompt", prompt="")

        duration_s = _coerce_duration(attrs.get("duration"))
        aspect = _coerce_aspect(attrs.get("aspect"), default_aspect)
        # Inline tag audio gating: it requires BOTH run-level audio AND the
        # host shot's audio_policy being intrinsic_only. Otherwise muted.
        # This mirrors the orchestrator's audio gate so inline tags can't
        # bypass the global rule.
        tag_audio_req = _coerce_bool(attrs.get("audio"))
        audio_on = (
            tag_audio_req
            and run_audio_enabled
            and host_audio_policy == "intrinsic_only"
        )

        if cap_tripped[0]:
            failed += 1
            invocations.append({
                "ok": False, "prompt": prompt, "duration_s": duration_s,
                "video_url": None, "cost_usd": 0.0,
                "error": "circuit breaker exhausted earlier in this shot",
                "error_class": "CircuitBreakerExhausted",
            })
            return _placeholder_html(
                reason="cost cap reached", prompt=prompt,
            )

        # Reserve budget before the Veo call.
        expected_cost = price_per_call_usd(
            resolution="720p", duration_s=duration_s, audio_on=audio_on,
        )
        if cost_tracker is not None:
            try:
                cost_tracker.try_charge(expected_cost)
            except Exception:
                # Tracker.try_charge raises CircuitBreakerExhausted; from the
                # outside it's just an exception with a known marker. Mark
                # cap tripped so subsequent tags skip straight to placeholder.
                cap_tripped[0] = True
                failed += 1
                invocations.append({
                    "ok": False, "prompt": prompt, "duration_s": duration_s,
                    "video_url": None, "cost_usd": 0.0,
                    "error": "circuit breaker tripped",
                    "error_class": "CircuitBreakerExhausted",
                })
                return _placeholder_html(reason="cost cap reached", prompt=prompt)

        # Credit ledger deduction — mirrors the orchestrator single-shot
        # behavior. On insufficient balance: roll back tracker, mark the
        # cap tripped for the rest of this shot, fall back to placeholder.
        tag_credits = Decimal("0")
        if ledger is not None and getattr(ledger, "enabled", False):
            try:
                tag_credits = ledger.charge(
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
                if is_insufficient:
                    cap_tripped[0] = True
                    failed += 1
                    invocations.append({
                        "ok": False, "prompt": prompt, "duration_s": duration_s,
                        "video_url": None, "cost_usd": 0.0,
                        "error": "credit ledger insufficient",
                        "error_class": "CircuitBreakerExhausted",
                    })
                    return _placeholder_html(reason="credit cap reached", prompt=prompt)
                # Transient ledger error — log and proceed (mirrors
                # orchestrator policy). tag_credits stays at 0; the run
                # summary's USD figure is still authoritative.
                _log(
                    f"⚠️  inline <aivideo> shot {shot_idx}: ledger.charge raised "
                    f"{type(ledger_err).__name__}: {ledger_err}; proceeding without ledger row."
                )

        _log(
            f"🎬 inline <aivideo> shot {shot_idx}: {duration_s}s, "
            f"audio={'on' if audio_on else 'off'}, ${expected_cost:.2f} — {prompt[:50]}..."
        )
        try:
            veo_result = veo_client.generate_text_to_video(
                prompt=prompt,
                duration_s=duration_s,
                aspect_ratio=aspect,
                resolution="720p",
                generate_audio=audio_on,
                auto_fix=True,
                safety_tolerance=safety_tolerance,
            )
        except VeoError as err:
            if cost_tracker is not None:
                cost_tracker.refund(expected_cost)
            if ledger is not None and tag_credits > 0:
                ledger.refund(
                    credits=tag_credits,
                    shot_idx=shot_idx,
                    reason=type(err).__name__,
                )
            klass = type(err).__name__
            _log(f"❌ inline <aivideo> shot {shot_idx}: {klass}: {err}")
            failed += 1
            invocations.append({
                "ok": False, "prompt": prompt, "duration_s": duration_s,
                "video_url": None, "cost_usd": 0.0,
                "error": str(err), "error_class": klass,
            })
            return _placeholder_html(reason=f"{klass}: {str(err)[:80]}", prompt=prompt)
        except Exception as err:
            if cost_tracker is not None:
                cost_tracker.refund(expected_cost)
            if ledger is not None and tag_credits > 0:
                ledger.refund(
                    credits=tag_credits,
                    shot_idx=shot_idx,
                    reason=f"unexpected:{type(err).__name__}",
                )
            klass = type(err).__name__
            _log(f"❌ inline <aivideo> shot {shot_idx}: unexpected {klass}: {err}")
            failed += 1
            invocations.append({
                "ok": False, "prompt": prompt, "duration_s": duration_s,
                "video_url": None, "cost_usd": 0.0,
                "error": str(err), "error_class": klass,
            })
            return _placeholder_html(reason=f"{klass}: {str(err)[:80]}", prompt=prompt)

        succeeded += 1
        total_cost += veo_result.cost_usd
        total_credits += tag_credits
        invocations.append({
            "ok": True,
            "prompt": prompt,
            "duration_s": veo_result.duration_s,
            "video_url": veo_result.video_url,
            "request_id": veo_result.request_id,
            "cost_usd": veo_result.cost_usd,
            "cost_credits": float(tag_credits),
            "audio_on": veo_result.audio_on,
            "aspect_ratio": veo_result.aspect_ratio,
            "error": None,
            "error_class": None,
        })
        return _video_html(video_url=veo_result.video_url, audio_on=veo_result.audio_on)

    new_html = _AIVIDEO_TAG_RE.sub(_replace, shot_html)
    return {
        "html": new_html,
        "invocations": invocations,
        "succeeded": succeeded,
        "failed": failed,
        "cost_usd": round(total_cost, 4),
        "cost_credits": float(total_credits),
        "circuit_breaker_partial": cap_tripped[0] and succeeded > 0,
    }
