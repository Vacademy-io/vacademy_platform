"""
Platform-level AI runtime settings.

Which model serves the learner chatbot, which engine voices the voice call,
whether the voice socket demands a token — these used to be deployment
constants. They now live in `ai_platform_settings` (V493) and are edited from
the super-admin portal, so an operator can switch them without a rollout.

Design:
  * The set of valid keys, their types and defaults is declared HERE in
    SETTING_SPECS. The table only stores overrides; an absent row means "use the
    environment default", and resetting a setting deletes its row.
  * Reads go through a process-wide cache with a short TTL. Every request path
    that consults a setting calls `get_platform_setting`, which costs a dict
    lookup between refreshes and one small SELECT per TTL per replica.
  * The table may not exist yet on a replica that deploys ahead of the
    admin_core migration. That must never take the chatbot down, so a failed
    load falls back to defaults and is retried after the TTL.
"""
from __future__ import annotations

import json
import logging
import os
import threading
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Dict, List, Optional

from sqlalchemy import text
from sqlalchemy.orm import Session

from ..config import get_settings
from ..db import db_session

logger = logging.getLogger(__name__)

CACHE_TTL_SECONDS = 30.0


@dataclass(frozen=True)
class SettingSpec:
    key: str
    group: str
    label: str
    description: str
    # "model" (validated against ai_models), "enum" (validated against options),
    # "bool", "string", "number" (bounded by min_value / max_value).
    type: str
    default: Callable[[], Any]
    options: tuple = ()
    # A "model" setting may be blank, meaning "same as the text chatbot".
    nullable: bool = False
    # For "model" settings: which slice of ai_models the portal offers and the
    # server accepts — "llm" (chat-capable) or "image" (category = image).
    catalog: str = "llm"
    # What a blank value means, shown by the portal for nullable settings.
    blank_label: str = "Same as chatbot model"
    # Bounds for "number" settings.
    min_value: Optional[float] = None
    max_value: Optional[float] = None


def _env_bool(name: str, fallback: bool) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return fallback
    return raw.strip().lower() in ("1", "true", "yes", "on")


SETTING_SPECS: Dict[str, SettingSpec] = {
    s.key: s
    for s in (
        SettingSpec(
            key="chatbot.text.model",
            group="chatbot",
            label="Chatbot model",
            description=(
                "OpenRouter model that answers the learner text chatbot (and the voice call "
                "unless overridden below). Institutes that bring their own API key with a "
                "default model still win over this."
            ),
            type="model",
            default=lambda: get_settings().llm_default_model,
        ),
        SettingSpec(
            key="chatbot.llm.disable_reasoning",
            group="chatbot",
            label="Suppress reasoning tokens",
            description=(
                "Ask the provider not to spend hidden reasoning tokens on chatbot turns. "
                "Measured 4x faster and 7x cheaper on qwen3.7-flash with no answer-quality "
                "loss for typical 23-character learner messages."
            ),
            type="bool",
            default=lambda: get_settings().llm_disable_reasoning,
        ),
        SettingSpec(
            key="chatbot.voice.model",
            group="voice",
            label="Voice call model",
            description="Model for spoken turns. Leave blank to use the chatbot model.",
            type="model",
            default=lambda: None,
            nullable=True,
        ),
        SettingSpec(
            key="chatbot.voice.tts_provider",
            group="voice",
            label="Text-to-speech engine",
            description=(
                "Which engine speaks the agent's replies on the learner voice call. "
                "A failing engine falls back to Sarvam for that line rather than going silent."
            ),
            type="enum",
            default=lambda: "sarvam",
            options=("sarvam", "google", "edge"),
        ),
        SettingSpec(
            key="chatbot.voice.tts_voice",
            group="voice",
            label="Voice",
            description=(
                "Voice id for the selected engine (e.g. hi-IN-Chirp3-HD-Achird for Google, "
                "hi-IN-SwaraNeural for Edge). Blank picks a sensible default for the call's "
                "language. For Sarvam the institute's own voice setting is used instead."
            ),
            type="string",
            default=lambda: "",
        ),
        SettingSpec(
            key="chatbot.voice.stt_provider",
            group="voice",
            label="Speech-to-text engine",
            description="Engine that transcribes the student. Sarvam Saaras is the only one wired today.",
            type="enum",
            default=lambda: "sarvam",
            options=("sarvam",),
        ),
        SettingSpec(
            key="chatbot.voice.opening_turn",
            group="voice",
            label="Agent speaks first",
            description="Greet the student the moment the call connects, instead of waiting for them.",
            type="bool",
            default=lambda: True,
        ),
        SettingSpec(
            key="chatbot.voice.require_auth",
            group="rollout",
            label="Require a login token on the voice socket",
            description=(
                "Refuse voice sockets that don't present an access token. Turn on once every "
                "client is confirmed to send one — until then a token is verified when present "
                "but not demanded. Also settable via VOICE_REQUIRE_AUTH."
            ),
            type="bool",
            default=lambda: get_settings().voice_require_auth,
        ),
        SettingSpec(
            key="tutor.compile.model",
            group="tutor",
            label="Tutor compile model",
            description=(
                "OpenRouter model that compiles a slide into a Live AI Tutor teaching plan "
                "(topics, concepts, board, checks). Flash by default: under this platform's "
                "token pricing a single failed Pro compile cost 35 credits (2026-09-03). Raise "
                "it here when the economics allow; the compiler falls back to the institute "
                "default if the chosen model is rejected by the provider."
            ),
            type="model",
            default=lambda: os.environ.get("TUTOR_COMPILE_MODEL") or "google/gemini-2.5-flash",
        ),
        SettingSpec(
            key="tutor.live.model",
            group="tutor",
            label="Tutor live model",
            description=(
                "Model for the live teaching turns: grading the learner's answer, hints, doubts "
                "(~1.3k tokens per turn). Blank = the chatbot model. A course or institute "
                "'Live model' setting still wins over this."
            ),
            type="model",
            default=lambda: os.environ.get("TUTOR_LIVE_MODEL") or None,
            nullable=True,
        ),
        SettingSpec(
            key="tutor.image.model",
            group="tutor",
            label="Tutor board image model",
            description=(
                "Image model for AI pictures on whiteboards (up to 4 per slide, billed per image). "
                "Blank = the platform image model below. Dedicated image models (Qwen, Seedream, "
                "FLUX) take 30-70 s per image; Gemini image models a few seconds."
            ),
            type="model",
            default=lambda: os.environ.get("TUTOR_IMAGE_MODEL") or None,
            nullable=True,
            catalog="image",
            blank_label="Platform image model",
        ),
        SettingSpec(
            key="tutor.voice.provider",
            group="tutor",
            label="Tutor voice provider",
            description="TTS engine for the Live AI Tutor's browser sessions. Smallest.ai when its key is present, else Sarvam. Institutes and courses can override; a failing engine falls back to Sarvam per line.",
            type="enum",
            default=lambda: os.environ.get("TUTOR_TTS_PROVIDER") or ("smallest" if os.environ.get("SMALLEST_API_KEY") else "sarvam"),
            options=("smallest", "sarvam", "google", "edge"),
        ),
        SettingSpec(
            key="tutor.voice.voice",
            group="tutor",
            label="Tutor voice",
            description="Default (female) voice id for the tutor's provider. Blank = provider default. Hindi verb gender follows the voice.",
            type="string",
            default=lambda: os.environ.get("TUTOR_TTS_VOICE") or "",
            nullable=True,
        ),
        SettingSpec(
            key="tutor.live.preflight_minutes",
            group="tutor",
            label="Voice lesson: minutes of credit required to start",
            description=(
                "A voice lesson starts only if the institute can afford this many minutes at the "
                "tutor_live_minute rate (see Credits & pricing below). 0 disables the check."
            ),
            type="number",
            default=lambda: 5,
            min_value=0, max_value=60,
        ),
        SettingSpec(
            key="tutor.live.max_minutes",
            group="tutor",
            label="Voice/text lesson: maximum length (minutes)",
            description="A lesson is closed politely when it reaches this wall-clock length; the learner's place is saved.",
            type="number",
            default=lambda: 90,
            min_value=10, max_value=240,
        ),
        SettingSpec(
            key="image.model",
            group="images",
            label="Image generation model",
            description=(
                "Model behind every generated picture: course banners and previews, copilot slide "
                "images, question figures, tutor boards (unless overridden above). Dedicated image "
                "models (qwen/qwen-image-3, Seedream, FLUX) go through OpenRouter's images API; "
                "Gemini/GPT image models through chat completions — routing is automatic."
            ),
            type="model",
            default=lambda: os.environ.get("IMAGE_MODEL") or "qwen/qwen-image-3",
            catalog="image",
        ),
    )
}

GROUP_LABELS = {
    "chatbot": "Student chatbot",
    "voice": "Voice call",
    "tutor": "Live AI Tutor",
    "images": "Image generation",
    "rollout": "Rollout & safety",
}


# --------------------------------------------------------------------------
# Cache
# --------------------------------------------------------------------------

@dataclass
class _Cache:
    values: Dict[str, Any] = field(default_factory=dict)
    # None = never loaded. (A 0.0 sentinel compared against time.monotonic()
    # reads as "loaded just now" wherever the monotonic clock starts near zero.)
    loaded_at: Optional[float] = None
    loaded_wall: Optional[datetime] = None
    load_failed: bool = False
    last_error: Optional[str] = None
    lock: threading.Lock = field(default_factory=threading.Lock)


_cache = _Cache()


def _load_overrides(db: Session) -> Dict[str, Any]:
    rows = db.execute(text("SELECT setting_key, setting_value FROM ai_platform_settings")).fetchall()
    out: Dict[str, Any] = {}
    for key, value in rows:
        if key in SETTING_SPECS:
            out[key] = value
    return out


def _is_fresh(now: float) -> bool:
    return _cache.loaded_at is not None and (now - _cache.loaded_at) < CACHE_TTL_SECONDS


def _refresh_if_stale(db: Optional[Session] = None) -> None:
    """
    Reload the overrides once per TTL.

    Prefer the caller's session: the chatbot and the voice socket call this
    while already holding a pooled connection, and opening a second one from
    inside that request is how a busy pool turns a saved setting into a silent
    env default. Only fall back to a fresh session when no caller session exists.
    """
    now = time.monotonic()
    if _is_fresh(now):
        return
    with _cache.lock:
        if _is_fresh(now):
            return
        try:
            if db is not None:
                values = _load_overrides(db)
            else:
                with db_session() as fresh:
                    values = _load_overrides(fresh)
            _cache.values = values
            if _cache.load_failed:
                logger.info("ai_platform_settings loaded; overrides active again")
            _cache.load_failed = False
            _cache.last_error = None
            _cache.loaded_wall = datetime.utcnow()
        except Exception as exc:
            # Table not migrated yet, pool busy, DB blip: serve defaults, retry
            # after the TTL, and say so EVERY time — a one-off warning at pod
            # start is not enough to notice a setting that never takes effect.
            _cache.values = {}
            _cache.load_failed = True
            _cache.last_error = f"{type(exc).__name__}: {str(exc)[:200]}"
            logger.warning(
                "ai_platform_settings unavailable; using environment defaults (%s)",
                _cache.last_error,
            )
        _cache.loaded_at = time.monotonic()


def invalidate_platform_settings_cache() -> None:
    _cache.loaded_at = None


def get_platform_setting(key: str, default: Any = None, db: Optional[Session] = None) -> Any:
    """
    Current effective value: the portal override if set, else the spec default,
    else `default`. Pass the request's `db` session when you have one.
    """
    spec = SETTING_SPECS.get(key)
    if spec is None:
        raise KeyError(f"Unknown platform setting: {key}")
    _refresh_if_stale(db)
    if key in _cache.values:
        return _cache.values[key]
    try:
        value = spec.default()
    except Exception:
        value = None
    return default if value is None else value


def get_cache_status() -> Dict[str, Any]:
    """What this process is serving from — for the portal's 'effective' view."""
    age = None if _cache.loaded_at is None else round(time.monotonic() - _cache.loaded_at, 1)
    return {
        "loaded": _cache.loaded_at is not None and not _cache.load_failed,
        "load_failed": _cache.load_failed,
        "last_error": _cache.last_error,
        "age_seconds": age,
        "loaded_at": _cache.loaded_wall.isoformat() + "Z" if _cache.loaded_wall else None,
        "ttl_seconds": CACHE_TTL_SECONDS,
        "override_keys": sorted(_cache.values.keys()),
    }


# --------------------------------------------------------------------------
# Admin API support
# --------------------------------------------------------------------------

def _coerce(spec: SettingSpec, value: Any) -> Any:
    """Validate and normalise an incoming value for `spec`, or raise ValueError."""
    if value is None or (isinstance(value, str) and value.strip() == ""):
        if spec.nullable or spec.type == "string":
            return "" if spec.type == "string" else None
        raise ValueError(f"{spec.key} cannot be empty")

    if spec.type == "bool":
        if isinstance(value, bool):
            return value
        if isinstance(value, str) and value.strip().lower() in ("true", "false"):
            return value.strip().lower() == "true"
        raise ValueError(f"{spec.key} must be true or false")

    if spec.type == "enum":
        v = str(value).strip().lower()
        if v not in spec.options:
            raise ValueError(f"{spec.key} must be one of {', '.join(spec.options)}")
        return v

    if spec.type in ("model", "string"):
        v = str(value).strip()
        if len(v) > 200:
            raise ValueError(f"{spec.key} is too long")
        return v

    if spec.type == "number":
        try:
            n = float(value)
        except (TypeError, ValueError):
            raise ValueError(f"{spec.key} must be a number")
        if spec.min_value is not None and n < spec.min_value:
            raise ValueError(f"{spec.key} must be at least {spec.min_value:g}")
        if spec.max_value is not None and n > spec.max_value:
            raise ValueError(f"{spec.key} must be at most {spec.max_value:g}")
        return int(n) if n.is_integer() else n

    raise ValueError(f"Unsupported setting type {spec.type}")


def _model_exists(db: Session, model_id: str, catalog: str = "llm") -> bool:
    if catalog == "image":
        sql = "SELECT 1 FROM ai_models WHERE model_id = :m AND is_active = TRUE AND category = 'image' LIMIT 1"
    else:
        sql = ("SELECT 1 FROM ai_models WHERE model_id = :m AND is_active = TRUE "
               "AND category NOT IN ('embedding', 'image', 'tts', 'video') LIMIT 1")
    row = db.execute(text(sql), {"m": model_id}).fetchone()
    return row is not None


def list_platform_settings(db: Session) -> List[Dict[str, Any]]:
    """Every declared setting with its effective value and where it came from."""
    rows = db.execute(
        text("SELECT setting_key, setting_value, updated_by, updated_at FROM ai_platform_settings")
    ).fetchall()
    overrides = {r[0]: (r[1], r[2], r[3]) for r in rows}

    out: List[Dict[str, Any]] = []
    for spec in SETTING_SPECS.values():
        try:
            default = spec.default()
        except Exception:
            default = None
        if spec.key in overrides:
            value, updated_by, updated_at = overrides[spec.key]
            source = "portal"
        else:
            value, updated_by, updated_at = default, None, None
            source = "default"
        # What THIS process resolves right now (via its cache) — differs from
        # `value` when the cache could not load or is still within its TTL.
        try:
            effective = get_platform_setting(spec.key, db=db)
        except Exception:
            effective = None
        out.append(
            {
                "key": spec.key,
                "effective": effective,
                "group": spec.group,
                "group_label": GROUP_LABELS.get(spec.group, spec.group),
                "label": spec.label,
                "description": spec.description,
                "type": spec.type,
                "nullable": spec.nullable,
                "catalog": spec.catalog,
                "blank_label": spec.blank_label,
                "min_value": spec.min_value,
                "max_value": spec.max_value,
                "options": list(spec.options),
                "value": value,
                "default": default,
                "source": source,
                "updated_by": updated_by,
                "updated_at": updated_at.isoformat() if isinstance(updated_at, datetime) else updated_at,
            }
        )
    return out


def set_platform_setting(db: Session, key: str, value: Any, updated_by: Optional[str]) -> None:
    """Validate and upsert one setting, then drop the cache so it applies at once."""
    spec = SETTING_SPECS.get(key)
    if spec is None:
        raise KeyError(f"Unknown platform setting: {key}")
    coerced = _coerce(spec, value)
    if spec.type == "model" and coerced and not _model_exists(db, coerced, spec.catalog):
        what = "an active image model" if spec.catalog == "image" else "an active chat model"
        raise ValueError(f"{coerced} is not {what} in the ai_models registry")

    db.execute(
        text(
            """
            INSERT INTO ai_platform_settings (setting_key, setting_value, updated_by, updated_at)
            VALUES (:k, CAST(:v AS JSONB), :u, now())
            ON CONFLICT (setting_key)
            DO UPDATE SET setting_value = EXCLUDED.setting_value,
                          updated_by = EXCLUDED.updated_by,
                          updated_at = now()
            """
        ),
        {"k": key, "v": json.dumps(coerced), "u": updated_by},
    )
    db.commit()
    invalidate_platform_settings_cache()


def reset_platform_setting(db: Session, key: str) -> None:
    """Remove the override so the environment default applies again."""
    if key not in SETTING_SPECS:
        raise KeyError(f"Unknown platform setting: {key}")
    db.execute(text("DELETE FROM ai_platform_settings WHERE setting_key = :k"), {"k": key})
    db.commit()
    invalidate_platform_settings_cache()


__all__ = [
    "SETTING_SPECS",
    "GROUP_LABELS",
    "get_platform_setting",
    "get_cache_status",
    "invalidate_platform_settings_cache",
    "list_platform_settings",
    "set_platform_setting",
    "reset_platform_setting",
]
