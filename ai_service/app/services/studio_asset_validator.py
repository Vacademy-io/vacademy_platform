"""
Shared validator for Studio projects' source asset references.

Studio projects reference N indexed input assets (videos + images). Before
creating/updating a project — and again before forking a build — we must
confirm each referenced asset:

  1. EXISTS in ai_input_assets
  2. BELONGS to the calling institute (no cross-tenant leakage)
  3. STATUS is COMPLETED (indexing produced consumable artifacts)
  4. KIND in the AssetRef matches the DB row's kind

The validator returns a structured result so callers can surface per-asset
failures to the FE rather than failing the whole request with a generic 400.

Used by:
  • POST /projects                          (router/studio_projects.py)
  • PATCH /projects/{id}                    (when source_asset_refs changes)
  • POST /projects/{id}/builds              (P4 — second-line check before build)
"""
from __future__ import annotations

import logging
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Sequence

from ..models.ai_input_asset import AiInputAsset
from ..repositories.ai_input_asset_repository import AiInputAssetRepository
from ..schemas.studio_projects import AssetRef

logger = logging.getLogger(__name__)


@dataclass
class AssetValidationFailure:
    """One per problematic asset reference. Order matches the input refs list."""
    handle: str
    asset_id: str
    reason: str  # 'not_found' | 'wrong_institute' | 'not_completed' | 'kind_mismatch'
    detail: Optional[str] = None


@dataclass
class AssetValidationResult:
    """Aggregate validation outcome.

    `ok` is True iff `failures` is empty. `assets` is the resolved ORM rows
    in the SAME order as the input refs, indexed by handle for easy lookup
    by downstream code.
    """
    ok: bool
    failures: List[AssetValidationFailure] = field(default_factory=list)
    assets: List[AiInputAsset] = field(default_factory=list)
    by_handle: Dict[str, AiInputAsset] = field(default_factory=dict)


def validate_asset_refs(
    refs: Sequence[AssetRef],
    institute_id: str,
    repo: Optional[AiInputAssetRepository] = None,
) -> AssetValidationResult:
    """Resolve + validate every AssetRef against ai_input_assets.

    One DB roundtrip total (via `get_by_ids` batch). Per-ref outcomes are
    accumulated into the result — never raises.
    """
    repo = repo or AiInputAssetRepository()
    if not refs:
        return AssetValidationResult(ok=False, failures=[
            AssetValidationFailure(
                handle="", asset_id="",
                reason="empty_refs",
                detail="at least one source asset is required",
            )
        ])

    asset_ids = [r.asset_id for r in refs]
    rows = repo.get_by_ids(asset_ids)
    by_id: Dict[str, AiInputAsset] = {str(r.id): r for r in rows}

    failures: List[AssetValidationFailure] = []
    resolved: List[AiInputAsset] = []
    by_handle: Dict[str, AiInputAsset] = {}

    for ref in refs:
        row = by_id.get(ref.asset_id)
        if row is None:
            failures.append(AssetValidationFailure(
                handle=ref.handle, asset_id=ref.asset_id, reason="not_found",
                detail=f"no ai_input_assets row with id {ref.asset_id}",
            ))
            continue
        if row.institute_id != institute_id:
            failures.append(AssetValidationFailure(
                handle=ref.handle, asset_id=ref.asset_id, reason="wrong_institute",
                detail="asset does not belong to the calling institute",
            ))
            continue
        if row.status != "COMPLETED":
            failures.append(AssetValidationFailure(
                handle=ref.handle, asset_id=ref.asset_id, reason="not_completed",
                detail=f"asset status is {row.status}; must be COMPLETED",
            ))
            continue
        if row.kind != ref.kind:
            failures.append(AssetValidationFailure(
                handle=ref.handle, asset_id=ref.asset_id, reason="kind_mismatch",
                detail=f"AssetRef.kind={ref.kind!r} but asset is kind={row.kind!r}",
            ))
            continue
        resolved.append(row)
        by_handle[ref.handle] = row

    return AssetValidationResult(
        ok=not failures,
        failures=failures,
        assets=resolved,
        by_handle=by_handle,
    )


def failures_to_http_detail(failures: Sequence[AssetValidationFailure]) -> Dict[str, object]:
    """Shape an HTTPException(400).detail body for asset-validation rejections.

    The shape lets the FE highlight per-asset problems in the picker UI
    rather than showing a single generic error.
    """
    return {
        "error": "invalid_source_assets",
        "message": (
            f"{len(failures)} source asset reference(s) failed validation. "
            "See `failures` for per-asset detail."
        ),
        "failures": [
            {
                "handle": f.handle,
                "asset_id": f.asset_id,
                "reason": f.reason,
                "detail": f.detail,
            }
            for f in failures
        ],
    }
