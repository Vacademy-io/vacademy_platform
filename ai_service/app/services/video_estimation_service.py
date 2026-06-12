"""
Video generation cost/credit estimator.

Used by the pre-generation preview to show users what their selections will cost
before they commit. Token / image / TTS-character counts are heuristic baselines
keyed by (quality_tier, duration_band); pricing is sourced from the ai_models DB
table (LLM rates, image_price_per_unit) plus a small TTS constant.

The baselines are seed values — refine after we have ≥10 completed videos per
bucket via `refresh_baselines_from_history()`.
"""
from __future__ import annotations

import logging
import re
from decimal import Decimal, ROUND_HALF_UP
from typing import Optional, Tuple, List, Dict, Any

from sqlalchemy import text
from sqlalchemy.orm import Session

from .ai_video_constants import AI_VIDEO_PER_VIDEO_COST_CAP_USD
from .credit_service import DEFAULT_PRICING
from .credit_rate_service import CreditRateService

logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Heuristic baselines: expected counts per (tier, duration_band)
# ---------------------------------------------------------------------------
# Numbers are medians from observed runs (seeded from the heart-anatomy
# super_ultra@2:21min run: 152K in / 192K out / 8 images / ~1500 TTS chars)
# and scaled by quality_tier and duration. Variance band: ±30% on tokens,
# ±20% on images, fixed TTS chars (audio length is deterministic).

DurationBand = str  # one of: "<1 minute", "1-2 minutes", "2-3 minutes", "3-5 minutes", "5+ minutes"
Tier = str          # one of: "free", "standard", "premium", "ultra", "super_ultra"


def _normalize_duration_band(target_duration: str) -> DurationBand:
    """Map free-form duration strings (e.g. '2-3 minutes', '5 minutes', '90 seconds')
    to one of the canonical bands used in the baseline table."""
    if not target_duration:
        return "2-3 minutes"
    s = target_duration.strip().lower()
    nums = [float(n) for n in re.findall(r"\d+(?:\.\d+)?", s)]
    if not nums:
        return "2-3 minutes"
    minutes = max(nums) if "second" not in s else max(nums) / 60.0
    if minutes < 1:
        return "<1 minute"
    if minutes <= 2:
        return "1-2 minutes"
    if minutes <= 3:
        return "2-3 minutes"
    if minutes <= 5:
        return "3-5 minutes"
    return "5+ minutes"


# Seed numbers — keep this table tight.
# free/standard use segment path (no Director): only "seg_in"/"seg_out" keys, no "dir_*".
# premium/ultra/super_ultra use Director path: "dir_in"/"dir_out" for the Director call,
# "seg_in"/"seg_out" for per-shot HTML generation. Director calls are more expensive
# (large system prompts, beat plans) but fewer; shot calls are many, shorter.
# {"dir_in", "dir_out", "seg_in", "seg_out", "img", "tts"}
_VIDEO_BASELINES: Dict[Tuple[Tier, DurationBand], Dict[str, int]] = {
    # free — segment path, no Director
    ("free",        "<1 minute"):    {"dir_in":     0, "dir_out":     0, "seg_in":  4000, "seg_out":  8000, "img": 0, "tts":  500},
    ("free",        "1-2 minutes"):  {"dir_in":     0, "dir_out":     0, "seg_in":  8000, "seg_out": 14000, "img": 1, "tts":  900},
    ("free",        "2-3 minutes"):  {"dir_in":     0, "dir_out":     0, "seg_in": 12000, "seg_out": 20000, "img": 1, "tts": 1500},
    ("free",        "3-5 minutes"):  {"dir_in":     0, "dir_out":     0, "seg_in": 18000, "seg_out": 30000, "img": 2, "tts": 2400},
    ("free",        "5+ minutes"):   {"dir_in":     0, "dir_out":     0, "seg_in": 28000, "seg_out": 46000, "img": 2, "tts": 3600},
    # standard — segment path, no Director
    ("standard",    "<1 minute"):    {"dir_in":     0, "dir_out":     0, "seg_in":  8000, "seg_out": 14000, "img": 1, "tts":  500},
    ("standard",    "1-2 minutes"):  {"dir_in":     0, "dir_out":     0, "seg_in": 16000, "seg_out": 26000, "img": 2, "tts":  900},
    ("standard",    "2-3 minutes"):  {"dir_in":     0, "dir_out":     0, "seg_in": 24000, "seg_out": 40000, "img": 2, "tts": 1500},
    ("standard",    "3-5 minutes"):  {"dir_in":     0, "dir_out":     0, "seg_in": 36000, "seg_out": 62000, "img": 3, "tts": 2400},
    ("standard",    "5+ minutes"):   {"dir_in":     0, "dir_out":     0, "seg_in": 56000, "seg_out": 94000, "img": 4, "tts": 3600},
    # premium — single-pass Director + per-shot generation
    ("premium",     "<1 minute"):    {"dir_in":  8000, "dir_out":  6000, "seg_in": 17000, "seg_out": 29000, "img": 2, "tts":  500},
    ("premium",     "1-2 minutes"):  {"dir_in": 14000, "dir_out": 10000, "seg_in": 36000, "seg_out": 60000, "img": 3, "tts":  900},
    ("premium",     "2-3 minutes"):  {"dir_in": 20000, "dir_out": 14000, "seg_in": 60000, "seg_out": 96000, "img": 4, "tts": 1500},
    ("premium",     "3-5 minutes"):  {"dir_in": 30000, "dir_out": 20000, "seg_in":100000, "seg_out":160000, "img": 6, "tts": 2400},
    ("premium",     "5+ minutes"):   {"dir_in": 46000, "dir_out": 30000, "seg_in":154000, "seg_out":250000, "img": 8, "tts": 3600},
    # ultra — Director + animation validator + emphasis map + per-shot generation
    ("ultra",       "<1 minute"):    {"dir_in": 14000, "dir_out": 10000, "seg_in": 31000, "seg_out": 50000, "img": 3, "tts":  500},
    ("ultra",       "1-2 minutes"):  {"dir_in": 24000, "dir_out": 16000, "seg_in": 66000, "seg_out": 99000, "img": 4, "tts":  900},
    ("ultra",       "2-3 minutes"):  {"dir_in": 36000, "dir_out": 24000, "seg_in":114000, "seg_out":166000, "img": 6, "tts": 1500},
    ("ultra",       "3-5 minutes"):  {"dir_in": 56000, "dir_out": 38000, "seg_in":184000, "seg_out":272000, "img":10, "tts": 2400},
    ("ultra",       "5+ minutes"):   {"dir_in": 86000, "dir_out": 58000, "seg_in":294000, "seg_out":422000, "img":14, "tts": 3600},
    # super_ultra — two-pass Director + motion bias + KINETIC_TEXT + per-shot generation
    ("super_ultra", "<1 minute"):    {"dir_in": 22000, "dir_out": 16000, "seg_in": 43000, "seg_out": 69000, "img": 4, "tts":  500},
    ("super_ultra", "1-2 minutes"):  {"dir_in": 38000, "dir_out": 26000, "seg_in": 92000, "seg_out":139000, "img": 6, "tts":  900},
    ("super_ultra", "2-3 minutes"):  {"dir_in": 56000, "dir_out": 38000, "seg_in":164000, "seg_out":242000, "img": 8, "tts": 1500},
    ("super_ultra", "3-5 minutes"):  {"dir_in": 86000, "dir_out": 58000, "seg_in":264000, "seg_out":392000, "img":13, "tts": 2400},
    ("super_ultra", "5+ minutes"):   {"dir_in":130000, "dir_out": 88000, "seg_in":420000, "seg_out":632000, "img":18, "tts": 3600},
}

# Tiers that run a Director pass before per-shot generation.
_DIRECTOR_TIERS = {"premium", "ultra", "super_ultra"}

# Variance multipliers for the low/high band.
_TOKEN_VARIANCE = 0.30
_IMAGE_VARIANCE = 0.20

# Constants for unit costs not represented as token rates.
_TTS_COST_PER_1K_CHARS_USD: float = 0.30  # ElevenLabs / premium baseline
_TTS_FREE_COST_PER_1K_CHARS_USD: float = 0.0  # Edge TTS (standard tier)
_IMAGE_COST_USD_FALLBACK: float = 0.04
_VIDEO_IMAGE_MODEL_ID: str = "bytedance-seed/seedream-4.5"
_BACKGROUND_MUSIC_FLAT_USD: float = 0.10  # Lyria call (rough)


# ---------------------------------------------------------------------------
# Pricing helpers
# ---------------------------------------------------------------------------
def _get_llm_pricing(db: Session, model: str) -> Optional[Tuple[float, float, bool]]:
    """Returns (input_per_1m, output_per_1m, is_free) or None if model not registered."""
    try:
        row = db.execute(
            text(
                "SELECT input_price_per_1m, output_price_per_1m, is_free "
                "FROM ai_models WHERE model_id = :m AND is_active = TRUE LIMIT 1"
            ),
            {"m": model},
        ).fetchone()
    except Exception as e:
        logger.warning(f"[VideoEstimation] LLM pricing lookup failed: {e}")
        return None
    if not row:
        return None
    return (
        float(row.input_price_per_1m or 0),
        float(row.output_price_per_1m or 0),
        bool(row.is_free),
    )


def _get_image_unit_price(db: Session, model_id: str = _VIDEO_IMAGE_MODEL_ID) -> float:
    try:
        row = db.execute(
            text(
                "SELECT image_price_per_unit FROM ai_models "
                "WHERE model_id = :m AND is_active = TRUE LIMIT 1"
            ),
            {"m": model_id},
        ).fetchone()
        if row and row.image_price_per_unit is not None:
            return float(row.image_price_per_unit)
    except Exception as e:
        logger.warning(f"[VideoEstimation] Image pricing lookup failed: {e}")
    return _IMAGE_COST_USD_FALLBACK


def _get_video_second_price(db: Session, model_id: str) -> Optional[float]:
    """Per-second USD cost for video models (avatar synthesis). NULL → not registered."""
    try:
        row = db.execute(
            text(
                "SELECT video_price_per_second FROM ai_models "
                "WHERE model_id = :m AND is_active = TRUE LIMIT 1"
            ),
            {"m": model_id},
        ).fetchone()
        if row and row.video_price_per_second is not None:
            return float(row.video_price_per_second)
    except Exception as e:
        logger.warning(f"[VideoEstimation] Video pricing lookup failed: {e}")
    return None


def _duration_seconds_from_band(band: str) -> float:
    """Median seconds for a duration band — used for host-cost extrapolation."""
    return {
        "<1 minute":   45.0,
        "1-2 minutes": 90.0,
        "2-3 minutes": 150.0,
        "3-5 minutes": 240.0,
        "5+ minutes":  360.0,
    }.get(band, 150.0)


def _resolve_default_video_model(db: Session) -> Optional[str]:
    """Same fallback chain video_generation_service uses."""
    try:
        from .ai_models_service import AIModelsService
        return AIModelsService(db).get_models_for_use_case("video").default_model.model_id
    except Exception as e:
        logger.warning(f"[VideoEstimation] default model lookup failed: {e}")
        return None


# ---------------------------------------------------------------------------
# Cost computation
# ---------------------------------------------------------------------------
def _llm_cost_usd(input_per_1m: float, output_per_1m: float, prompt_tokens: int, completion_tokens: int) -> float:
    return (prompt_tokens / 1_000_000) * input_per_1m + (completion_tokens / 1_000_000) * output_per_1m


def _credits_from_usd(request_type: str, cost_usd: float, ratio: Decimal) -> Decimal:
    """Mirror credit_service.calculate_credits formula: max(min_charge, base_cost + usd × ratio).

    `ratio` is the live USD→credits multiplier (from `CreditRateService`).
    Pass the resolved ratio in once per estimation run rather than looking
    it up per line item.
    """
    pricing = DEFAULT_PRICING.get(request_type, DEFAULT_PRICING["content"])
    calculated = pricing["base_cost"] + (Decimal(str(cost_usd)) * ratio)
    result = max(pricing["min_charge"], calculated)
    return result.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _tts_request_type(tts_provider: str) -> str:
    return "tts_premium" if (tts_provider or "").lower() == "premium" else "tts"


def _tts_cost_per_1k(tts_provider: str) -> float:
    return _TTS_COST_PER_1K_CHARS_USD if (tts_provider or "").lower() == "premium" else _TTS_FREE_COST_PER_1K_CHARS_USD


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def estimate_video_generation(
    db: Session,
    *,
    institute_id: Optional[str],
    model: Optional[str],
    quality_tier: str,
    target_duration: str,
    target_audience: str,
    orientation: str,
    voice_gender: str,
    tts_provider: str,
    voice_id: Optional[str],
    language: str,
    generate_avatar: bool,
    background_music_enabled: Optional[bool],
    sound_effects_enabled: bool,
    content_type: str,
    visual_style: str,
    captions_enabled: bool,
    html_quality: str,
    review_mode: bool,
    attachments_count: int,
    host: Optional[Dict[str, Any]] = None,
    # Opt-in: when True (and tier is ultra/super_ultra) the estimator adds
    # an AI video upper-bound row to the breakdown so the pre-submit
    # preview surfaces the worst-case Veo spend. Mirrors the runtime
    # `ai_video_enabled` flag — the runtime cap is the per-video circuit
    # breaker in QUALITY_TIERS, not a per-shot guess.
    ai_video_enabled: bool = False,
    ai_video_audio_enabled: bool = False,
) -> Dict[str, Any]:
    """
    Estimate credits and USD cost for a video generation request, plus echo back
    the resolved selections so the FE confirmation modal can display them.
    """
    # Resolve effective model (mirror the runtime resolution chain).
    effective_model = model or _resolve_default_video_model(db) or ""
    duration_band = _normalize_duration_band(target_duration)

    # Resolve the live USD→credits ratio once per estimation. Per-line-item
    # lookups would hammer the cache for no benefit — the value is stable
    # for the duration of one estimate call.
    rate_ratio = CreditRateService(db).get_effective_ratio()

    baseline = _VIDEO_BASELINES.get((quality_tier, duration_band))
    if not baseline:
        # Unknown tier — fall back to ultra of the same band, then ultra/2-3
        baseline = (
            _VIDEO_BASELINES.get(("ultra", duration_band))
            or _VIDEO_BASELINES["ultra", "2-3 minutes"]
        )

    uses_director = quality_tier in _DIRECTOR_TIERS
    dir_in_tokens  = baseline["dir_in"]
    dir_out_tokens = baseline["dir_out"]
    seg_in_tokens  = baseline["seg_in"]
    seg_out_tokens = baseline["seg_out"]
    image_count    = baseline["img"]
    tts_chars      = baseline["tts"]

    # Lyria background music defaults: on for ultra/super_ultra unless explicitly disabled.
    bg_music_on = (
        background_music_enabled
        if background_music_enabled is not None
        else quality_tier in ("ultra", "super_ultra")
    )

    # --- Cost components -------------------------------------------------
    llm_pricing = _get_llm_pricing(db, effective_model) if effective_model else None
    if llm_pricing:
        in_rate, out_rate, is_free = llm_pricing
        if is_free:
            in_rate = out_rate = 0.0
    else:
        # Model not registered — flag it; use 0 rates so estimate is conservative-low
        in_rate = out_rate = 0.0

    image_unit = _get_image_unit_price(db)
    tts_per_1k = _tts_cost_per_1k(tts_provider)

    # Host (avatar) cost: per-second × estimated host-on-screen seconds.
    # host_in_video_percentage of the median duration for the band yields the
    # rough seconds we'll bill at the avatar model's per-second rate. Only
    # priced for avatar host on ultra/super_ultra (matches feature gating).
    host_cost_row: Optional[Dict[str, Any]] = None
    host_extra_image_count = 0
    host_extra_image_usd = 0.0
    if (
        isinstance(host, dict)
        and host.get("type") == "avatar"
        and quality_tier in ("ultra", "super_ultra")
    ):
        avatar_cfg = host.get("avatar") or {}
        host_model = avatar_cfg.get("avatar_model") or "fal-ai/kling-video/ai-avatar/v2/standard"
        host_pct = max(0, min(100, int(host.get("host_in_video_percentage", 100))))
        approx_seconds = _duration_seconds_from_band(duration_band) * (host_pct / 100.0)

        # Resolve saved_avatar_id → provider + name for a friendly preview
        # label. Cost numbers stay on the Kling rate (we accepted overpayment
        # up front rather than reshape pricing tables). The detail string
        # used to expose the fal.ai endpoint slug
        # (`fal-ai/kling-video/ai-avatar/v2/standard`), which is misleading
        # for users who picked a built-in catalog avatar — they see Kling
        # despite Argil being the actual route.
        saved_avatar_id = avatar_cfg.get("saved_avatar_id")
        host_provider = "custom"
        avatar_name: Optional[str] = None
        if saved_avatar_id and institute_id:
            try:
                from .vimotion_resolver import resolve_studio_avatar
                _resolved = resolve_studio_avatar(saved_avatar_id, institute_id)
                if _resolved:
                    host_provider = (_resolved.get("provider") or "custom").lower()
                    avatar_name = (_resolved.get("name") or "").strip() or None
            except Exception as _re:
                logger.warning(
                    f"[Estimation] saved_avatar_id={saved_avatar_id!r} resolve "
                    f"failed for display ({_re}); falling back to generic label."
                )

        # Friendly label: "Custom avatar — Matteo" / "Preset avatar — Matteo".
        # Falls back to a bare label when the avatar wasn't resolved (e.g.
        # admin's free-form face upload — no studio_avatar row to read a
        # name from).
        if host_provider in ("argil", "veed"):
            host_detail = (
                f"Preset avatar — {avatar_name}" if avatar_name else "Preset avatar"
            )
        else:
            host_detail = (
                f"Custom avatar — {avatar_name}" if avatar_name else "Custom avatar"
            )

        if host_model == "fal-ai/ltx-2.3-quality/audio-to-video":
            # LTX 2.3 is priced PER-MEGAPIXEL of generated video
            # (width × height × frames × $0.0024075/MP), not per-second. Derive an
            # effective per-second from the chosen quality (resolution proxy) × fps
            # so the estimate stays in the per-second shape the rest of this
            # function expects. Approximate: the actual output sizes to the host
            # image's aspect (resolution="auto"); 480p/720p are stand-ins here.
            _ltx_fps = int(avatar_cfg.get("avatar_fps") or 24)
            _ltx_w, _ltx_h = (1280, 720) if (avatar_cfg.get("quality") == "720p") else (854, 480)
            host_per_sec = round(0.0024075 * (_ltx_w * _ltx_h * _ltx_fps) / 1_000_000.0, 6)
        else:
            host_per_sec = _get_video_second_price(db, host_model)
        if host_per_sec is not None and approx_seconds > 0:
            host_usd = approx_seconds * host_per_sec
            host_cost_row = {
                "component": "Avatar video synthesis (host)",
                "detail": host_detail,
                "cost_usd": round(host_usd, 4),
                "credits": float(_credits_from_usd("video", host_usd, rate_ratio)),
            }
            # Per-shot avatar reference image gen (Seedream image-to-image).
            # Built-in catalog providers (argil/veed) skip Seedream entirely
            # — identity is locked to the catalog enum, no per-shot host
            # image is rendered. Suppress that line item for them.
            if host_provider == "custom":
                host_extra_image_count = max(1, int(approx_seconds / 6.0))
                host_extra_image_usd = host_extra_image_count * image_unit

    def _components(
        d_in: int, d_out: int, s_in: int, s_out: int, imgs: int
    ) -> List[Dict[str, Any]]:
        img_usd = imgs * image_unit
        tts_usd = (tts_chars / 1000.0) * tts_per_1k
        bg_usd = _BACKGROUND_MUSIC_FLAT_USD if bg_music_on else 0.0

        rows: List[Dict[str, Any]] = []
        if uses_director and (d_in or d_out):
            dir_usd = _llm_cost_usd(in_rate, out_rate, d_in, d_out)
            rows.append({
                "component": "LLM — Director pass",
                "detail": f"~{d_in:,} in / ~{d_out:,} out tokens · {effective_model or 'default model'}",
                "cost_usd": round(dir_usd, 4),
                "credits": float(_credits_from_usd("video", dir_usd, rate_ratio)),
            })

        seg_label = "LLM — per-shot generation" if uses_director else "LLM — script + segment shots"
        seg_usd = _llm_cost_usd(in_rate, out_rate, s_in, s_out)
        rows.append({
            "component": seg_label,
            "detail": f"~{s_in:,} in / ~{s_out:,} out tokens · {effective_model or 'default model'}",
            "cost_usd": round(seg_usd, 4),
            "credits": float(_credits_from_usd("video", seg_usd, rate_ratio)),
        })

        rows += [
            {
                "component": "Image generation",
                "detail": f"~{imgs} images · seedream-4.5",
                "cost_usd": round(img_usd, 4),
                "credits": float(_credits_from_usd("image", img_usd, rate_ratio)),
            },
            {
                "component": f"TTS ({tts_provider})",
                "detail": f"~{tts_chars:,} characters",
                "cost_usd": round(tts_usd, 4),
                "credits": float(_credits_from_usd(_tts_request_type(tts_provider), tts_usd, rate_ratio)),
            },
        ]
        if bg_music_on:
            rows.append({
                "component": "Background music (Lyria)",
                "detail": "auto-generated track",
                "cost_usd": round(bg_usd, 4),
                "credits": float(_credits_from_usd("video", bg_usd, rate_ratio)),
            })
        # Host (avatar) cost — appended last so the FE can render it as a
        # distinct line item below the standard breakdown.
        if host_cost_row:
            rows.append(host_cost_row)
            if host_extra_image_count > 0 and host_extra_image_usd > 0:
                rows.append({
                    "component": "Avatar reference images (host)",
                    "detail": f"~{host_extra_image_count} images · seedream-4.5 (per-shot identity)",
                    "cost_usd": round(host_extra_image_usd, 4),
                    "credits": float(_credits_from_usd("image", host_extra_image_usd, rate_ratio)),
                })

        # AI video (Veo) upper-bound row — present only when the user
        # opted-in AND the tier supports it. Veo spend is unpredictable
        # (Director picks AI_VIDEO_HERO shots at runtime), so we surface
        # the per-video circuit-breaker cap as the worst case. Same
        # number across low/expected/high — variance doesn't apply here
        # since the cap is fixed.
        if ai_video_enabled and quality_tier in ("ultra", "super_ultra"):
            _av_cap_usd = AI_VIDEO_PER_VIDEO_COST_CAP_USD
            rows.append({
                "component": "AI video (worst case)",
                "detail": (
                    "fal.ai Veo · upper bound = per-video cap. Actual spend "
                    "depends on Director's per-shot decisions."
                    + (
                        " Veo audio enabled (≈+67% per second)."
                        if ai_video_audio_enabled
                        else ""
                    )
                ),
                "cost_usd": round(_av_cap_usd, 4),
                "credits": float(_credits_from_usd("ai_video", _av_cap_usd, rate_ratio)),
            })
        return rows

    def _scale(v: int, factor: float) -> int:
        return max(0, int(round(v * factor)))

    expected = _components(dir_in_tokens, dir_out_tokens, seg_in_tokens, seg_out_tokens, image_count)
    low = _components(
        _scale(dir_in_tokens, 1 - _TOKEN_VARIANCE),
        _scale(dir_out_tokens, 1 - _TOKEN_VARIANCE),
        _scale(seg_in_tokens, 1 - _TOKEN_VARIANCE),
        _scale(seg_out_tokens, 1 - _TOKEN_VARIANCE),
        _scale(image_count, 1 - _IMAGE_VARIANCE),
    )
    high = _components(
        _scale(dir_in_tokens, 1 + _TOKEN_VARIANCE),
        _scale(dir_out_tokens, 1 + _TOKEN_VARIANCE),
        _scale(seg_in_tokens, 1 + _TOKEN_VARIANCE),
        _scale(seg_out_tokens, 1 + _TOKEN_VARIANCE),
        _scale(image_count, 1 + _IMAGE_VARIANCE),
    )

    def _sum(rows: List[Dict[str, Any]], k: str) -> float:
        return round(sum(float(r[k]) for r in rows), 4)

    expected_credits = _sum(expected, "credits")
    expected_cost_usd = _sum(expected, "cost_usd")

    estimate = {
        "expected_credits": expected_credits,
        "low_credits": _sum(low, "credits"),
        "high_credits": _sum(high, "credits"),
        "expected_cost_usd": expected_cost_usd,
        "low_cost_usd": _sum(low, "cost_usd"),
        "high_cost_usd": _sum(high, "cost_usd"),
        "breakdown": expected,
        "duration_band": duration_band,
        "assumptions": [
            f"Baseline counts are medians for {quality_tier} @ {duration_band} videos.",
            (
                "Includes Director pass (shot planning) + per-shot HTML generation."
                if uses_director
                else "Uses segment-based shot generation (no Director pass)."
            ),
            f"Range reflects ±{int(_TOKEN_VARIANCE * 100)}% variance on tokens, ±{int(_IMAGE_VARIANCE * 100)}% on image count.",
            f"Current rate: $1 USD → {rate_ratio:.0f} credits (DB-driven, see credit_rate_config).",
        ],
        "model_registered": llm_pricing is not None,
    }
    if not estimate["model_registered"] and effective_model:
        estimate["assumptions"].append(
            f"Model '{effective_model}' is not in ai_models — LLM cost shown as $0. Add it to get an accurate estimate."
        )

    selections = {
        "quality_tier": quality_tier,
        "model": effective_model or None,
        "target_duration": target_duration,
        "duration_band": duration_band,
        "target_audience": target_audience,
        "orientation": orientation,
        "visual_style": visual_style,
        "voice": {"gender": voice_gender, "provider": tts_provider, "voice_id": voice_id},
        "language": language,
        "generate_avatar": generate_avatar,
        "background_music_enabled": bg_music_on,
        "sound_effects_enabled": sound_effects_enabled,
        "content_type": content_type,
        "captions_enabled": captions_enabled,
        "html_quality": html_quality,
        "review_mode": review_mode,
        "attachments_count": attachments_count,
        "host": host if isinstance(host, dict) else None,
    }

    # --- Balance lookup --------------------------------------------------
    balance: Dict[str, Any] = {
        "current": None,
        "after_expected": None,
        "after_high": None,
        "sufficient": True,
        "sufficient_for_high": True,
    }
    if institute_id:
        try:
            from .credit_service import CreditService
            bal = CreditService(db).get_balance(institute_id)
            if bal:
                current = float(bal.current_balance)
                balance["current"] = current
                balance["after_expected"] = round(current - expected_credits, 2)
                balance["after_high"] = round(current - estimate["high_credits"], 2)
                balance["sufficient"] = current >= expected_credits
                balance["sufficient_for_high"] = current >= estimate["high_credits"]
        except Exception as e:
            logger.warning(f"[VideoEstimation] balance lookup failed: {e}")

    return {"selections": selections, "estimate": estimate, "balance": balance}
