"""
Vimotion entity resolver — looks up saved studio avatars and brand kits in
admin-core-service's Postgres so generation requests can carry just an id and
have the rest hydrated server-side.

Uses the existing `db.db_session()` context (admin-core-service Postgres) and
issues raw SQL because we don't have ORM models for these tables in ai_service.
The schemas live in admin_core_service/.../db/migration/V227__... and V228__...

Both lookups are scoped by institute_id so a request can never resolve another
institute's avatar/kit by guessing an id.
"""
from __future__ import annotations

import logging
from typing import Any, Dict, Optional

from sqlalchemy import text

from ..db import db_session
from ..schemas.video_generation import AvatarProviderLiteral

logger = logging.getLogger(__name__)


# Derive from the schema's Literal so the resolver allow-list cannot drift
# behind HostAvatarPlan.provider (which used to be a separately-maintained
# inline Literal in schemas/routing.py).
_ALLOWED_PROVIDERS = set(AvatarProviderLiteral.__args__)


def resolve_studio_avatar(
    avatar_id: str,
    institute_id: str,
) -> Optional[Dict[str, Any]]:
    """Fetch a saved studio avatar by id, scoped to institute_id.

    Returns a dict with the row's fields, or None if not found / mismatched
    institute. Caller is responsible for translating this into request fields.

    Provider is normalised to one of {'custom','argil','veed'}; unknown
    providers (e.g. legacy rows or DB drift) are coerced to 'custom' with a
    warning so we never dispatch to an undefined fal.ai endpoint.
    """
    if not avatar_id or not institute_id:
        return None
    sql = text(
        """
        SELECT id, institute_id, name, face_image_url, description,
               provider, external_avatar_id, preview_image_url,
               voice_id, voice_provider, voice_language, voice_gender
        FROM studio_avatar
        WHERE id = :avatar_id AND institute_id = :institute_id
        LIMIT 1
        """
    )
    try:
        with db_session() as session:
            row = session.execute(
                sql, {"avatar_id": avatar_id, "institute_id": institute_id}
            ).mappings().first()
    except Exception as e:
        logger.warning(
            f"[vimotion_resolver] studio_avatar lookup failed "
            f"(avatar_id={avatar_id!r}, institute_id={institute_id!r}): {e}"
        )
        return None

    if row is None:
        return None

    data = dict(row)
    provider = (data.get("provider") or "custom").strip().lower()
    if provider not in _ALLOWED_PROVIDERS:
        logger.warning(
            f"[vimotion_resolver] unknown provider {provider!r} on avatar "
            f"{avatar_id!r} — coercing to 'custom'"
        )
        provider = "custom"
    data["provider"] = provider
    return data


def resolve_brand_kit(
    brand_kit_id: str,
    institute_id: str,
) -> Optional[Dict[str, Any]]:
    """Fetch a saved brand kit by id, scoped to institute_id.

    Returns a dict shaped roughly like the FE BrandKit DTO. Caller maps it onto
    VideoStyleConfig + VideoBrandingConfig — see video_generation_service for
    how this replaces the per-institute defaults entirely (not merged).
    """
    if not brand_kit_id or not institute_id:
        return None

    # Columns that have existed since V227. `system_prompt` ships in V338 — kept
    # separate so a partial deploy (ai_service ahead of admin_core's Flyway) can
    # fall back to the pre-V338 column set instead of dropping the ENTIRE kit
    # (palette/branding included) when the new column doesn't exist yet.
    base_cols = (
        "id, institute_id, name, is_default, "
        "background_type, palette_json, heading_font, body_font, "
        "layout_theme, logo_file_id, "
        "intro_json, outro_json, watermark_json"
    )
    where = (
        "FROM brand_kit "
        "WHERE id = :brand_kit_id AND institute_id = :institute_id LIMIT 1"
    )
    params = {"brand_kit_id": brand_kit_id, "institute_id": institute_id}

    def _run(cols: str) -> Optional[Dict[str, Any]]:
        with db_session() as session:
            row = session.execute(text(f"SELECT {cols} {where}"), params).mappings().first()
        return dict(row) if row is not None else None

    try:
        return _run(base_cols + ", system_prompt")
    except Exception as e:
        # Most likely cause in prod: brand_kit.system_prompt doesn't exist yet
        # (V338 not run). Retry without it so the kit still resolves — palette /
        # fonts / intro / outro / watermark intact, just no brand system_prompt.
        logger.warning(
            f"[vimotion_resolver] brand_kit lookup with system_prompt failed "
            f"(brand_kit_id={brand_kit_id!r}, institute_id={institute_id!r}): {e}; "
            f"retrying without system_prompt (pre-V338 fallback)"
        )
        try:
            return _run(base_cols)
        except Exception as e2:
            logger.warning(
                f"[vimotion_resolver] brand_kit lookup failed "
                f"(brand_kit_id={brand_kit_id!r}, institute_id={institute_id!r}): {e2}"
            )
            return None


__all__ = ["resolve_studio_avatar", "resolve_brand_kit"]
