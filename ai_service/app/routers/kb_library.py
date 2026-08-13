"""The knowledge base library — catalogue, publishing, and unlocking (V445).

Client institutes browse published libraries and unlock one permanently with a
single credit charge:

    GET  /library/catalogue          browse, with facet filters
    GET  /library/facets             the filter values that actually exist
    GET  /library/{kb_id}            one listing, with unlock state
    POST /library/{kb_id}/unlock     pay once, keep forever

Publishing happens inside ONE internal institute, set by KB_PUBLISHER_INSTITUTE_ID:

    GET  /library/publisher/listings
    PUT  /library/{kb_id}/listing
    POST /library/{kb_id}/listing/status

Reading a listing is open to every institute — that is the shop window. The
right to GENERATE from the corpus is a separate check, `_require_usable` in
knowledge_base.py, backed by KbRepository.is_usable.
"""
from __future__ import annotations

import logging
import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session

from ..db import db_dependency
from ..models.ai_token_usage import RequestType
from ..services.ai_billing import preflight_tool_credits, record_tool_billing
from ..services.kb import library as kb_library
from ..services.kb.repository import KbRepository
from .knowledge_base import Caller, get_caller

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/knowledge-base/v1", tags=["knowledge-base-library"])

UNLOCK_TOOL_KEY = "kb_library_unlock"

# Which institute may publish. Configurable so staging can point somewhere
# harmless rather than at the real catalogue.
PUBLISHER_INSTITUTE_ID = os.getenv(
    "KB_PUBLISHER_INSTITUTE_ID", "6b600940-2134-40ec-93ed-b61e403c5a87"
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------

class ListingUpsert(BaseModel):
    title: str = Field(..., min_length=1, max_length=200)
    # Capped to match the column, so a card never has to truncate mid-sentence.
    summary: str = Field(..., min_length=1, max_length=280)
    description: Optional[str] = None
    cover_file_id: Optional[str] = None
    cover_alt: Optional[str] = Field(None, max_length=300)
    subject: Optional[str] = Field(None, max_length=100)
    level: Optional[str] = Field(None, max_length=100)
    board: Optional[str] = Field(None, max_length=100)
    language: Optional[str] = Field(None, max_length=50)
    tags: List[str] = Field(default_factory=list)
    sort_weight: int = 0
    institute_id: Optional[str] = None


class StatusChange(BaseModel):
    status: str
    institute_id: Optional[str] = None


class UnlockRequest(BaseModel):
    institute_id: Optional[str] = None


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _require_publisher(institute_id: str) -> None:
    """Only the publisher institute may describe or publish a library."""
    if institute_id != PUBLISHER_INSTITUTE_ID:
        raise HTTPException(403, "This institute cannot publish to the library")


def _listing_or_404(db: Session, kb_id: str, institute_id: str) -> Dict[str, Any]:
    listing = kb_library.get_listing(db, kb_id, institute_id)
    if not listing:
        raise HTTPException(404, "Library not found")
    return listing


# ---------------------------------------------------------------------------
# Catalogue
# ---------------------------------------------------------------------------

@router.get("/library/catalogue")
async def catalogue(
    subject: Optional[str] = Query(None),
    level: Optional[str] = Query(None),
    board: Optional[str] = Query(None),
    language: Optional[str] = Query(None),
    q: Optional[str] = Query(None),
    limit: int = Query(60, ge=1, le=200),
    institute_id: Optional[str] = Query(None),
    caller: Caller = Depends(get_caller),
    db: Session = Depends(db_dependency),
):
    """Published libraries, each marked with whether this institute owns it."""
    resolved = caller.require_institute(institute_id)
    return {
        "libraries": kb_library.list_catalogue(
            db, resolved, subject=subject, level=level, board=board,
            language=language, query=q, limit=limit,
        ),
        "unlock_credits": _unlock_price(db, resolved),
    }


@router.get("/library/facets")
async def facets(
    institute_id: Optional[str] = Query(None),
    caller: Caller = Depends(get_caller),
    db: Session = Depends(db_dependency),
):
    """Filter values that exist in the published catalogue."""
    caller.require_institute(institute_id)
    return kb_library.facet_values(db)


@router.get("/library/publisher/listings")
async def publisher_listings(
    institute_id: Optional[str] = Query(None),
    caller: Caller = Depends(get_caller),
    db: Session = Depends(db_dependency),
):
    """Every knowledge base in the publisher institute, with its listing if it
    has one. Bases without a listing appear so they can be described."""
    resolved = caller.require_institute(institute_id)
    _require_publisher(resolved)
    return {"listings": kb_library.list_all_for_publisher(db, resolved)}


@router.get("/library/{kb_id}")
async def listing_detail(
    kb_id: str,
    institute_id: Optional[str] = Query(None),
    caller: Caller = Depends(get_caller),
    db: Session = Depends(db_dependency),
):
    """One listing. Readable by any institute — this is the page they read
    before deciding to pay."""
    resolved = caller.require_institute(institute_id)
    listing = _listing_or_404(db, kb_id, resolved)

    # A draft is only visible to the publisher, so an unfinished library is
    # never reachable by guessing an id.
    if listing["status"] == "DRAFT" and resolved != PUBLISHER_INSTITUTE_ID:
        raise HTTPException(404, "Library not found")

    listing["unlock_credits"] = _unlock_price(db, resolved)
    return listing


# ---------------------------------------------------------------------------
# Publishing
# ---------------------------------------------------------------------------

@router.put("/library/{kb_id}/listing")
async def upsert_listing(
    kb_id: str,
    body: ListingUpsert,
    caller: Caller = Depends(get_caller),
    db: Session = Depends(db_dependency),
):
    resolved = caller.require_institute(body.institute_id)
    _require_publisher(resolved)

    kb = KbRepository(db).get_kb(kb_id, resolved)
    if not kb or kb["institute_id"] != resolved:
        raise HTTPException(404, "Knowledge base not found")

    return kb_library.upsert_listing(
        db, kb_id,
        title=body.title.strip(), summary=body.summary.strip(),
        description=body.description, cover_file_id=body.cover_file_id,
        cover_alt=(body.cover_alt or "").strip() or None,
        subject=body.subject, level=body.level, board=body.board,
        language=body.language, tags=body.tags, sort_weight=body.sort_weight,
        created_by=caller.user_id,
    )


@router.post("/library/{kb_id}/listing/status")
async def change_status(
    kb_id: str,
    body: StatusChange,
    caller: Caller = Depends(get_caller),
    db: Session = Depends(db_dependency),
):
    """Publish, withdraw from sale, or return to draft."""
    resolved = caller.require_institute(body.institute_id)
    _require_publisher(resolved)

    listing = kb_library.get_listing(db, kb_id)
    if not listing:
        raise HTTPException(404, "Describe this knowledge base before publishing it")

    status = (body.status or "").upper()
    if status == "PUBLISHED":
        # Refuse to publish something a stranger cannot evaluate. These are the
        # fields the catalogue card and the detail page are built from; without
        # them the listing renders as a blank rectangle with a price on it.
        missing = [
            name for name, value in (
                ("title", listing["title"]), ("summary", listing["summary"]),
                ("subject", listing["subject"]), ("level", listing["level"]),
            ) if not value
        ]
        if missing:
            raise HTTPException(
                400,
                "Add " + ", ".join(missing) + " before publishing this library",
            )
    try:
        return kb_library.set_status(db, kb_id, status, by=caller.user_id)
    except ValueError as exc:
        raise HTTPException(400, str(exc)) from exc


# ---------------------------------------------------------------------------
# Unlocking
# ---------------------------------------------------------------------------

def _unlock_price(db: Session, institute_id: str) -> float:
    """The flat rate, read from ai_tool_pricing so it can be retuned with an
    UPDATE rather than a deploy."""
    try:
        estimate = preflight_tool_credits(
            db, tool_key=UNLOCK_TOOL_KEY, tool_params={}, institute_id=institute_id,
        )
        return float(estimate.get("estimated_credits") or 0)
    except Exception:  # noqa: BLE001
        logger.warning("Could not read the library unlock price", exc_info=True)
        return 0.0


@router.post("/library/{kb_id}/unlock")
async def unlock(
    kb_id: str,
    body: UnlockRequest,
    caller: Caller = Depends(get_caller),
    db: Session = Depends(db_dependency),
):
    """Buy permanent access to a library.

    Order matters here. The entitlement row is written FIRST and the wallet is
    charged only if that insert won the race: the unique constraint is what
    makes a double-clicked button impossible to charge twice, and it can only do
    that job if nothing is billed before it has spoken.
    """
    resolved = caller.require_institute(body.institute_id)
    listing = _listing_or_404(db, kb_id, resolved)

    if listing["status"] != "PUBLISHED":
        raise HTTPException(400, "This library is not available")

    # The catalogue already hides archived bases, but a direct link would still
    # reach here — and charging for an archived corpus is a refund waiting to
    # happen.
    kb = KbRepository(db).get_kb(kb_id, resolved)
    if not kb or kb["status"] != "ACTIVE":
        raise HTTPException(400, "This library is not available")

    if kb_library.is_entitled(db, kb_id, resolved):
        # Already theirs. Answering 200 keeps a double-submit harmless.
        return {"unlocked": True, "credits_charged": 0, "already_owned": True}

    estimate = preflight_tool_credits(
        db, tool_key=UNLOCK_TOOL_KEY, tool_params={}, institute_id=resolved,
    )
    price = float(estimate.get("estimated_credits") or 0)
    if estimate.get("sufficient") is False:
        raise HTTPException(
            status_code=402,
            detail={
                "message": "Not enough credits to unlock this library",
                "required": price,
                "current_balance": estimate.get("current_balance"),
            },
        )

    won = kb_library.grant(
        db, kb_id, resolved,
        source="PURCHASE", credits_charged=price, granted_by=caller.user_id,
    )
    if not won:
        # Another request unlocked it a moment ago. Nothing to charge.
        return {"unlocked": True, "credits_charged": 0, "already_owned": True}

    try:
        record_tool_billing(
            tool_key=UNLOCK_TOOL_KEY,
            tool_params={},
            request_type=RequestType.KNOWLEDGE_BASE,
            model="none",
            prompt_tokens=0,
            completion_tokens=0,
            institute_id=resolved,
            user_id=caller.user_id,
            user_role="ADMIN",
            # Keyed on the pair, so a retry of this call cannot double-charge
            # even if the entitlement row was written by an earlier attempt.
            idempotency_key=f"kb_unlock:{kb_id}:{resolved}",
        )
    except Exception:  # noqa: BLE001
        # The institute already has access. Losing the billing record is a
        # revenue problem we can reconcile; revoking access they just bought is
        # a trust problem we cannot.
        logger.exception(
            "Library %s unlocked for %s but billing failed", kb_id, resolved
        )

    return {"unlocked": True, "credits_charged": price, "already_owned": False}
