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
    # "bool", "string".
    type: str
    default: Callable[[], Any]
    options: tuple = ()
    # A "model" setting may be blank, meaning "same as the text chatbot".
    nullable: bool = False


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
    )
}

GROUP_LABELS = {
    "chatbot": "Student chatbot",
    "voice": "Voice call",
    "rollout": "Rollout & safety",
}


# --------------------------------------------------------------------------
# Cache
# --------------------------------------------------------------------------

@dataclass
class _Cache:
    values: Dict[str, Any] = field(default_factory=dict)
    loaded_at: float = 0.0
    load_failed: bool = False
    lock: threading.Lock = field(default_factory=threading.Lock)


_cache = _Cache()


def _load_overrides(db: Session) -> Dict[str, Any]:
    rows = db.execute(text("SELECT setting_key, setting_value FROM ai_platform_settings")).fetchall()
    out: Dict[str, Any] = {}
    for key, value in rows:
        if key in SETTING_SPECS:
            out[key] = value
    return out


def _refresh_if_stale() -> None:
    now = time.monotonic()
    if now - _cache.loaded_at < CACHE_TTL_SECONDS:
        return
    with _cache.lock:
        if now - _cache.loaded_at < CACHE_TTL_SECONDS:
            return
        try:
            with db_session() as db:
                _cache.values = _load_overrides(db)
            if _cache.load_failed:
                logger.info("ai_platform_settings loaded; overrides active again")
            _cache.load_failed = False
        except Exception:
            # Table not migrated yet, or DB blip: serve defaults and retry later.
            if not _cache.load_failed:
                logger.warning(
                    "ai_platform_settings unavailable; using environment defaults", exc_info=True
                )
            _cache.values = {}
            _cache.load_failed = True
        _cache.loaded_at = time.monotonic()


def invalidate_platform_settings_cache() -> None:
    _cache.loaded_at = 0.0


def get_platform_setting(key: str, default: Any = None) -> Any:
    """
    Current effective value: the portal override if set, else the spec default,
    else `default`. Safe to call on every request.
    """
    spec = SETTING_SPECS.get(key)
    if spec is None:
        raise KeyError(f"Unknown platform setting: {key}")
    _refresh_if_stale()
    if key in _cache.values:
        return _cache.values[key]
    try:
        value = spec.default()
    except Exception:
        value = None
    return default if value is None else value


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

    raise ValueError(f"Unsupported setting type {spec.type}")


def _model_exists(db: Session, model_id: str) -> bool:
    row = db.execute(
        text("SELECT 1 FROM ai_models WHERE model_id = :m AND is_active = TRUE LIMIT 1"),
        {"m": model_id},
    ).fetchone()
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
        out.append(
            {
                "key": spec.key,
                "group": spec.group,
                "group_label": GROUP_LABELS.get(spec.group, spec.group),
                "label": spec.label,
                "description": spec.description,
                "type": spec.type,
                "nullable": spec.nullable,
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
    if spec.type == "model" and coerced and not _model_exists(db, coerced):
        raise ValueError(f"{coerced} is not an active model in the ai_models registry")

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
    "invalidate_platform_settings_cache",
    "list_platform_settings",
    "set_platform_setting",
    "reset_platform_setting",
]
