"""
Super Admin Router - Platform-wide credit and AI usage endpoints.
"""

import logging
import math
from datetime import datetime, timedelta
from decimal import Decimal
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import text
from sqlalchemy.orm import Session

from ..db import db_dependency
from ..core.security import get_current_user
from ..schemas.auth import CustomUserDetails
from ..schemas.super_admin import (
    AllInstitutesCreditsResponse,
    InstituteCreditItem,
    PlatformUsageSummary,
    UsageByTypeItem,
    UsageByDayItem,
    TopInstituteUsage,
)

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/super-admin/v1", tags=["Super Admin"])


def _require_super_admin(user: Optional[CustomUserDetails]):
    """Raise 403 if user is not a super admin."""
    if not user:
        raise HTTPException(status_code=403, detail="Super admin access required")
    # Primary check: is_root_user boolean flag (matches Java User.isRootUser)
    if user.is_root_user:
        return
    # Fallback: check roles list for ROOT_ADMIN or ADMIN
    roles = user.roles if hasattr(user, "roles") else []
    if isinstance(roles, str):
        roles = [r.strip() for r in roles.split(",")]
    if "ROOT_ADMIN" not in roles and "ADMIN" not in [r.upper() for r in roles]:
        raise HTTPException(status_code=403, detail="Super admin access required")


@router.get(
    "/credits/all",
    response_model=AllInstitutesCreditsResponse,
    summary="Get all institutes credit balances (paginated)",
)
def get_all_credits(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=50),
    sort_by: str = Query("current_balance", enum=["current_balance", "total_credits", "used_credits"]),
    sort_direction: str = Query("ASC", enum=["ASC", "DESC"]),
    search: Optional[str] = Query(None),
    db: Session = Depends(db_dependency),
    current_user: CustomUserDetails = Depends(get_current_user),
):
    try:
        _require_super_admin(current_user)

        offset = (page - 1) * page_size

        where_clause = ""
        params = {"limit": page_size, "offset": offset}
        if search and search.strip():
            where_clause = "WHERE CAST(institute_id AS TEXT) ILIKE :search"
            params["search"] = f"%{search.strip()}%"

        count_result = db.execute(text(f"SELECT COUNT(*) FROM institute_credits {where_clause}"), params)
        total = count_result.scalar() or 0

        query = text(f"""
            SELECT institute_id, total_credits, used_credits, current_balance,
                   low_balance_threshold, created_at, updated_at
            FROM institute_credits
            {where_clause}
            ORDER BY {sort_by} {sort_direction}
            LIMIT :limit OFFSET :offset
        """)
        rows = db.execute(query, params).fetchall()

        items = []
        for row in rows:
            balance = row[3] or Decimal("0")
            threshold = row[4] or Decimal("50")
            items.append(InstituteCreditItem(
                institute_id=str(row[0]),
                total_credits=row[1] or Decimal("0"),
                used_credits=row[2] or Decimal("0"),
                current_balance=balance,
                is_low_balance=balance <= threshold,
                created_at=row[5],
                updated_at=row[6],
            ))

        return AllInstitutesCreditsResponse(
            items=items,
            page=page,
            page_size=page_size,
            total=total,
            total_pages=math.ceil(total / page_size) if total > 0 else 0,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting all credits: {e}")
        return AllInstitutesCreditsResponse(
            items=[], page=page, page_size=page_size, total=0, total_pages=0
        )


@router.get(
    "/usage-summary",
    response_model=PlatformUsageSummary,
    summary="Get platform-wide AI usage summary",
)
def get_usage_summary(
    days: int = Query(30, ge=1, le=90),
    db: Session = Depends(db_dependency),
    current_user: CustomUserDetails = Depends(get_current_user),
):
    try:
        _require_super_admin(current_user)

        start_date = datetime.utcnow() - timedelta(days=days)

        # Totals
        totals_result = db.execute(
            text("""
                SELECT COALESCE(SUM(total_tokens), 0),
                       COALESCE(SUM(total_price), 0),
                       COUNT(*)
                FROM ai_token_usage
                WHERE created_at >= :start_date
            """),
            {"start_date": start_date},
        ).fetchone()

        total_tokens = int(totals_result[0]) if totals_result else 0
        total_cost = Decimal(str(totals_result[1])) if totals_result else Decimal("0")
        total_requests = int(totals_result[2]) if totals_result else 0

        # By type
        type_rows = db.execute(
            text("""
                SELECT request_type,
                       COALESCE(SUM(total_tokens), 0),
                       COALESCE(SUM(total_price), 0),
                       COUNT(*)
                FROM ai_token_usage
                WHERE created_at >= :start_date
                GROUP BY request_type
                ORDER BY SUM(total_tokens) DESC
            """),
            {"start_date": start_date},
        ).fetchall()

        usage_by_type = [
            UsageByTypeItem(
                request_type=row[0] or "unknown",
                total_tokens=int(row[1]),
                total_cost=Decimal(str(row[2])),
                request_count=int(row[3]),
            )
            for row in type_rows
        ]

        # By day
        day_rows = db.execute(
            text("""
                SELECT DATE(created_at) AS usage_date,
                       COALESCE(SUM(total_tokens), 0),
                       COALESCE(SUM(total_price), 0),
                       COUNT(*)
                FROM ai_token_usage
                WHERE created_at >= :start_date
                GROUP BY DATE(created_at)
                ORDER BY usage_date
            """),
            {"start_date": start_date},
        ).fetchall()

        usage_by_day = [
            UsageByDayItem(
                date=str(row[0]),
                total_tokens=int(row[1]),
                total_cost=Decimal(str(row[2])),
                request_count=int(row[3]),
            )
            for row in day_rows
        ]

        # Top institutes
        inst_rows = db.execute(
            text("""
                SELECT CAST(institute_id AS TEXT),
                       COALESCE(SUM(total_tokens), 0),
                       COALESCE(SUM(total_price), 0),
                       COUNT(*)
                FROM ai_token_usage
                WHERE created_at >= :start_date AND institute_id IS NOT NULL
                GROUP BY institute_id
                ORDER BY SUM(total_tokens) DESC
                LIMIT 20
            """),
            {"start_date": start_date},
        ).fetchall()

        top_institutes = [
            TopInstituteUsage(
                institute_id=str(row[0]),
                total_tokens=int(row[1]),
                total_cost=Decimal(str(row[2])),
                request_count=int(row[3]),
            )
            for row in inst_rows
        ]

        return PlatformUsageSummary(
            total_tokens=total_tokens,
            total_cost=total_cost,
            total_requests=total_requests,
            usage_by_type=usage_by_type,
            usage_by_day=usage_by_day,
            top_institutes=top_institutes,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting usage summary: {e}")
        return PlatformUsageSummary(
            total_tokens=0,
            total_cost=Decimal("0"),
            total_requests=0,
            usage_by_type=[],
            usage_by_day=[],
            top_institutes=[],
        )
