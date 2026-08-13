"""
Super Admin Router - Platform-wide credit and AI usage endpoints.
"""

import logging
import math
from datetime import datetime, timedelta, timezone
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
    CreditUsageLiveResponse,
    CreditWindowInstitute,
    CreditWindowTotals,
    CreditWindowTypeItem,
    InstituteCreditItem,
    PlatformUsageSummary,
    UsageByTypeItem,
    UsageByDayItem,
    TopInstituteUsage,
)

# Credits are net of refunds: a USAGE_DEDUCTION adds, a REFUND (failed video,
# aborted pipeline) subtracts. ADMIN_GRANT / ADMIN_DEDUCTION / PURCHASE are
# balance movements, not consumption, so they never enter these numbers.
_NET_CREDITS_SQL = (
    "CASE WHEN ct.transaction_type = 'USAGE_DEDUCTION' THEN ABS(ct.amount) "
    "ELSE -ABS(ct.amount) END"
)
_IS_USAGE_SQL = "CASE WHEN ct.transaction_type = 'USAGE_DEDUCTION' THEN 1 ELSE 0 END"

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
    hours: Optional[int] = Query(
        None,
        ge=1,
        le=2160,
        description="Sub-day window (e.g. 1 or 24). Overrides `days` when set.",
    ),
    db: Session = Depends(db_dependency),
    current_user: CustomUserDetails = Depends(get_current_user),
):
    window_hours = hours if hours is not None else days * 24
    # A 1h or 24h window bucketed by day is a single useless bar, so switch the
    # time series to hourly buckets for anything up to two days.
    bucket = "hour" if window_hours <= 48 else "day"

    try:
        _require_super_admin(current_user)

        # ai_token_usage.created_at is timestamptz — pass an AWARE instant so the
        # comparison never depends on the session TimeZone (a 5:30 skew is noise
        # over 30 days but wipes out a 1h window entirely).
        start_date = datetime.now(timezone.utc) - timedelta(hours=window_hours)
        # credit_transactions.created_at is a NAIVE timestamp written with
        # utcnow(), so it needs the naive twin of the same instant.
        start_date_naive = start_date.replace(tzinfo=None)

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

        # Credits burnt platform-wide in the same window (net of refunds)
        credits_total = db.execute(
            text(f"""
                SELECT COALESCE(SUM({_NET_CREDITS_SQL}), 0)
                FROM credit_transactions ct
                WHERE ct.created_at >= :start_date
                  AND ct.transaction_type IN ('USAGE_DEDUCTION', 'REFUND')
            """),
            {"start_date": start_date_naive},
        ).scalar()
        total_credits_used = Decimal(str(credits_total or 0))

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

        # By day (or by hour for sub-2-day windows). Bucketed in UTC so the
        # labels line up with the totals above regardless of the DB session TZ.
        if bucket == "hour":
            bucket_expr = (
                "to_char(date_trunc('hour', created_at AT TIME ZONE 'UTC'), "
                "'YYYY-MM-DD\"T\"HH24:MI:00\"Z\"')"
            )
        else:
            bucket_expr = (
                "to_char(date_trunc('day', created_at AT TIME ZONE 'UTC'), 'YYYY-MM-DD')"
            )

        day_rows = db.execute(
            text(f"""
                SELECT {bucket_expr} AS usage_bucket,
                       COALESCE(SUM(total_tokens), 0),
                       COALESCE(SUM(total_price), 0),
                       COUNT(*)
                FROM ai_token_usage
                WHERE created_at >= :start_date
                GROUP BY usage_bucket
                ORDER BY usage_bucket
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

        # Credits per institute in the window, merged into the token leaderboard
        # below. Keyed by institute_id (VARCHAR here, UUID on ai_token_usage).
        credit_rows = db.execute(
            text(f"""
                SELECT ct.institute_id,
                       COALESCE(SUM({_NET_CREDITS_SQL}), 0)
                FROM credit_transactions ct
                WHERE ct.created_at >= :start_date
                  AND ct.transaction_type IN ('USAGE_DEDUCTION', 'REFUND')
                GROUP BY ct.institute_id
            """),
            {"start_date": start_date_naive},
        ).fetchall()
        credits_by_institute = {
            str(row[0]): Decimal(str(row[1] or 0)) for row in credit_rows
        }

        # Top institutes. ai_token_usage.institute_id is a UUID column and
        # institutes.id is VARCHAR, so the join casts the UUID to text — never
        # the other way round, which would blow up on any non-UUID institute id.
        inst_rows = db.execute(
            text("""
                SELECT CAST(u.institute_id AS TEXT) AS institute_id,
                       i.name AS institute_name,
                       COALESCE(SUM(u.total_tokens), 0),
                       COALESCE(SUM(u.total_price), 0),
                       COUNT(*)
                FROM ai_token_usage u
                LEFT JOIN institutes i ON i.id = CAST(u.institute_id AS TEXT)
                WHERE u.created_at >= :start_date AND u.institute_id IS NOT NULL
                GROUP BY u.institute_id, i.name
                ORDER BY SUM(u.total_tokens) DESC
                LIMIT 20
            """),
            {"start_date": start_date},
        ).fetchall()

        top_institutes = [
            TopInstituteUsage(
                institute_id=str(row[0]),
                institute_name=row[1],
                total_tokens=int(row[2]),
                total_cost=Decimal(str(row[3])),
                request_count=int(row[4]),
                credits_used=credits_by_institute.get(str(row[0]), Decimal("0")),
            )
            for row in inst_rows
        ]

        return PlatformUsageSummary(
            total_tokens=total_tokens,
            total_cost=total_cost,
            total_requests=total_requests,
            total_credits_used=total_credits_used,
            bucket=bucket,
            window_hours=window_hours,
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
            total_credits_used=Decimal("0"),
            bucket=bucket,
            window_hours=window_hours,
            usage_by_type=[],
            usage_by_day=[],
            top_institutes=[],
        )


@router.get(
    "/credit-usage-live",
    response_model=CreditUsageLiveResponse,
    summary="Platform credit burn over the last 1 hour and last 24 hours",
)
def get_credit_usage_live(
    top: int = Query(10, ge=1, le=50, description="How many institutes/types to return"),
    db: Session = Depends(db_dependency),
    current_user: CustomUserDetails = Depends(get_current_user),
):
    """
    Live credit consumption, net of refunds. One pass over the last 24h of
    credit_transactions serves both windows — the 1h numbers are a conditional
    sum over the same rows, so the two windows can never disagree.
    """
    # credit_transactions.created_at is a naive UTC timestamp (written with
    # utcnow()), so compare naive-to-naive and skip session-TZ conversion.
    now = datetime.utcnow()
    since_24h = now - timedelta(hours=24)
    since_1h = now - timedelta(hours=1)
    params = {"since_24h": since_24h, "since_1h": since_1h}

    # Timestamps go out UTC-stamped so clients don't have to guess the zone.
    now_utc = now.replace(tzinfo=timezone.utc)
    since_24h_utc = since_24h.replace(tzinfo=timezone.utc)
    since_1h_utc = since_1h.replace(tzinfo=timezone.utc)

    empty = CreditUsageLiveResponse(
        generated_at=now_utc,
        last_1h=CreditWindowTotals(
            hours=1, since=since_1h_utc, credits_used=Decimal("0"),
            request_count=0, institute_count=0,
        ),
        last_24h=CreditWindowTotals(
            hours=24, since=since_24h_utc, credits_used=Decimal("0"),
            request_count=0, institute_count=0,
        ),
        top_institutes=[],
        by_request_type=[],
    )

    try:
        _require_super_admin(current_user)

        window_cte = f"""
            WITH tx AS (
                SELECT ct.institute_id,
                       ct.request_type,
                       ct.created_at,
                       {_NET_CREDITS_SQL} AS net_credits,
                       {_IS_USAGE_SQL} AS is_usage
                FROM credit_transactions ct
                WHERE ct.created_at >= :since_24h
                  AND ct.transaction_type IN ('USAGE_DEDUCTION', 'REFUND')
            )
        """

        inst_rows = db.execute(
            text(f"""
                {window_cte}
                SELECT tx.institute_id,
                       i.name AS institute_name,
                       COALESCE(SUM(CASE WHEN tx.created_at >= :since_1h THEN tx.net_credits ELSE 0 END), 0),
                       COALESCE(SUM(CASE WHEN tx.created_at >= :since_1h THEN tx.is_usage ELSE 0 END), 0),
                       COALESCE(SUM(tx.net_credits), 0),
                       COALESCE(SUM(tx.is_usage), 0)
                FROM tx
                LEFT JOIN institutes i ON i.id = tx.institute_id
                GROUP BY tx.institute_id, i.name
                ORDER BY SUM(tx.net_credits) DESC
            """),
            params,
        ).fetchall()

        institutes = [
            CreditWindowInstitute(
                institute_id=str(row[0]),
                institute_name=row[1],
                credits_1h=Decimal(str(row[2] or 0)),
                requests_1h=int(row[3] or 0),
                credits_24h=Decimal(str(row[4] or 0)),
                requests_24h=int(row[5] or 0),
            )
            for row in inst_rows
        ]

        type_rows = db.execute(
            text(f"""
                {window_cte}
                SELECT COALESCE(tx.request_type, 'unknown'),
                       COALESCE(SUM(CASE WHEN tx.created_at >= :since_1h THEN tx.net_credits ELSE 0 END), 0),
                       COALESCE(SUM(CASE WHEN tx.created_at >= :since_1h THEN tx.is_usage ELSE 0 END), 0),
                       COALESCE(SUM(tx.net_credits), 0),
                       COALESCE(SUM(tx.is_usage), 0)
                FROM tx
                GROUP BY COALESCE(tx.request_type, 'unknown')
                ORDER BY SUM(tx.net_credits) DESC
                LIMIT :top
            """),
            {**params, "top": top},
        ).fetchall()

        by_request_type = [
            CreditWindowTypeItem(
                request_type=str(row[0]),
                credits_1h=Decimal(str(row[1] or 0)),
                requests_1h=int(row[2] or 0),
                credits_24h=Decimal(str(row[3] or 0)),
                requests_24h=int(row[4] or 0),
            )
            for row in type_rows
        ]

        # Totals roll up from the full (unsliced) institute list, so they stay
        # correct no matter how small `top` is.
        return CreditUsageLiveResponse(
            generated_at=now_utc,
            last_1h=CreditWindowTotals(
                hours=1,
                since=since_1h_utc,
                credits_used=sum((i.credits_1h for i in institutes), Decimal("0")),
                request_count=sum(i.requests_1h for i in institutes),
                institute_count=sum(1 for i in institutes if i.requests_1h > 0),
            ),
            last_24h=CreditWindowTotals(
                hours=24,
                since=since_24h_utc,
                credits_used=sum((i.credits_24h for i in institutes), Decimal("0")),
                request_count=sum(i.requests_24h for i in institutes),
                institute_count=sum(1 for i in institutes if i.requests_24h > 0),
            ),
            top_institutes=institutes[:top],
            by_request_type=by_request_type,
        )
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting live credit usage: {e}")
        return empty
