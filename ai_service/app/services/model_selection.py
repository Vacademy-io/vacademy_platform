"""Shared model resolution for migrated AI features.

Resolves (primary_model, [fallback_models]) from the DB-backed registry
(`ai_model_defaults` / `/models/v2`), honoring an optional caller override only
when it's a known-active model. A registry read failure degrades to the hard
fallback rather than breaking generation — removing the "dead hardcoded model
id" failure mode is the whole point of the migration.
"""
from __future__ import annotations

import logging
from typing import List, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session

from .ai_models_service import AIModelsService

logger = logging.getLogger(__name__)

# Currently-valid OpenRouter id (NOT a dated -preview alias). Matches the Java
# AiModelConfig default.
DEFAULT_HARD_FALLBACK = "google/gemini-2.5-flash"


def resolve_models(
    db: Session,
    use_case: str,
    preferred_model: Optional[str] = None,
    hard_fallback: str = DEFAULT_HARD_FALLBACK,
) -> Tuple[str, List[str]]:
    """Return (primary_model, [fallback_models]). Precedence: valid+active
    preferred → use-case default → use-case fallback → hard fallback."""
    chain: List[str] = []

    if preferred_model:
        try:
            model = AIModelsService(db).get_model_by_id(preferred_model)
            if model and model.is_active:
                chain.append(preferred_model)
            else:
                logger.info(
                    "Preferred model '%s' not active in registry; using use-case default",
                    preferred_model,
                )
        except Exception as exc:  # noqa: BLE001
            logger.warning("Preferred-model lookup failed (%s); ignoring override", exc)

    default_id, fallback_id = _lookup_use_case_defaults(db, use_case)
    for candidate in (default_id, fallback_id, hard_fallback):
        if candidate and candidate not in chain:
            chain.append(candidate)

    primary, fallbacks = chain[0], chain[1:]
    logger.info("Model resolved for '%s': primary=%s fallbacks=%s", use_case, primary, fallbacks)
    return primary, fallbacks


def _lookup_use_case_defaults(db: Session, use_case: str) -> Tuple[Optional[str], Optional[str]]:
    """Single lightweight read of ai_model_defaults for a use case."""
    try:
        row = db.execute(
            text(
                "SELECT default_model_id, fallback_model_id "
                "FROM ai_model_defaults WHERE use_case = :uc"
            ),
            {"uc": use_case},
        ).fetchone()
        if row:
            return row.default_model_id, row.fallback_model_id
    except Exception as exc:  # noqa: BLE001
        logger.warning("Use-case default lookup failed for '%s' (%s); using hard fallback", use_case, exc)
    return None, None
