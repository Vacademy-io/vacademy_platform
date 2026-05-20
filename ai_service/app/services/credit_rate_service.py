"""
Credit Rate Service — DB-driven USD↔credits ratio + margin.

Replaces the hardcoded `USD_TO_CREDIT_RATIO = Decimal("150")` constant.
Reads from `credit_rate_config` (V252) and caches the result in-process
for 60 seconds to avoid a DB hit on every credit calculation.

Effective ratio = `usd_to_credits × (1 + margin_pct/100)`.

Rate changes apply to FUTURE deductions only — `credit_transactions.amount`
and `balance_after` are already credit-denominated snapshots and are never
repriced.
"""

import logging
import threading
import time
from decimal import Decimal
from typing import Optional, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session


logger = logging.getLogger(__name__)


# Fallback when the table is missing (pre-V252) or empty. Matches the
# hardcoded value the code shipped with before this service existed.
_FALLBACK_USD_TO_CREDITS = Decimal("100")
_FALLBACK_MARGIN_PCT = Decimal("50")

# Cache TTL — short enough that a rate change propagates quickly, long
# enough that we don't hammer the DB for every deduction.
_CACHE_TTL_SECONDS = 60


class _RateCache:
    """Process-wide cache for the current rate row. Thread-safe."""

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._fetched_at: float = 0.0
        self._usd_to_credits: Decimal = _FALLBACK_USD_TO_CREDITS
        self._margin_pct: Decimal = _FALLBACK_MARGIN_PCT
        self._hydrated_once: bool = False

    def get(self) -> Tuple[Decimal, Decimal]:
        with self._lock:
            return self._usd_to_credits, self._margin_pct

    def is_fresh(self) -> bool:
        with self._lock:
            return (
                self._hydrated_once
                and (time.monotonic() - self._fetched_at) < _CACHE_TTL_SECONDS
            )

    def set(self, usd_to_credits: Decimal, margin_pct: Decimal) -> None:
        with self._lock:
            self._usd_to_credits = usd_to_credits
            self._margin_pct = margin_pct
            self._fetched_at = time.monotonic()
            self._hydrated_once = True

    def invalidate(self) -> None:
        with self._lock:
            self._fetched_at = 0.0
            self._hydrated_once = False


_cache = _RateCache()


class CreditRateService:
    """Resolves the current credit↔USD rate, with caching.

    Construct with a SQLAlchemy session; lookup methods consult the
    process-wide cache before falling back to the DB.
    """

    def __init__(self, db: Session):
        self.db = db

    def get_current_rate(self) -> Tuple[Decimal, Decimal]:
        """Return `(usd_to_credits, margin_pct)` for the active rate row."""
        if not _cache.is_fresh():
            self._refresh_cache()
        return _cache.get()

    def get_effective_ratio(self) -> Decimal:
        """Return `usd_to_credits × (1 + margin_pct/100)`.

        This is the multiplier callers use: `credits = usd × effective_ratio`.
        With seed values (100, 50) it yields 150 — identical to the prior
        hardcoded `USD_TO_CREDIT_RATIO`.
        """
        usd_to_credits, margin_pct = self.get_current_rate()
        return usd_to_credits * (Decimal("1") + margin_pct / Decimal("100"))

    def insert_new_rate(
        self,
        *,
        usd_to_credits: Decimal,
        margin_pct: Decimal,
        notes: Optional[str],
        created_by: Optional[str],
    ) -> Decimal:
        """Append a new rate row; invalidate the cache; return the new effective ratio."""
        if usd_to_credits <= 0:
            raise ValueError("usd_to_credits must be positive")
        if margin_pct < 0:
            raise ValueError("margin_pct must be >= 0")

        self.db.execute(
            text(
                """
                INSERT INTO credit_rate_config
                    (usd_to_credits, margin_pct, notes, created_by)
                VALUES
                    (:usd_to_credits, :margin_pct, :notes, :created_by)
                """
            ),
            {
                "usd_to_credits": usd_to_credits,
                "margin_pct": margin_pct,
                "notes": notes,
                "created_by": created_by,
            },
        )
        self.db.commit()
        # Populate the cache directly with the just-inserted values. We
        # avoid `_cache.invalidate()` + a subsequent `_refresh_cache()`
        # round-trip because a transient DB error on the SELECT (rare but
        # possible: pool exhaustion, statement timeout) would otherwise
        # leave callers reading the fallback rate for up to 60s — even
        # though the admin's update is already committed.
        _cache.set(usd_to_credits, margin_pct)
        return usd_to_credits * (Decimal("1") + margin_pct / Decimal("100"))

    # ------------------------------------------------------------------
    # Internals
    # ------------------------------------------------------------------

    def _refresh_cache(self) -> None:
        try:
            row = self.db.execute(
                text(
                    """
                    SELECT usd_to_credits, margin_pct
                    FROM credit_rate_config
                    WHERE effective_from <= CURRENT_TIMESTAMP
                    ORDER BY effective_from DESC, id DESC
                    LIMIT 1
                    """
                )
            ).fetchone()
        except Exception as exc:
            logger.warning(
                "credit_rate_config lookup failed (%s); using fallback rate", exc
            )
            _cache.set(_FALLBACK_USD_TO_CREDITS, _FALLBACK_MARGIN_PCT)
            return

        if not row:
            logger.warning(
                "credit_rate_config table is empty; using fallback rate"
            )
            _cache.set(_FALLBACK_USD_TO_CREDITS, _FALLBACK_MARGIN_PCT)
            return

        _cache.set(
            Decimal(str(row.usd_to_credits)),
            Decimal(str(row.margin_pct)),
        )


def invalidate_rate_cache() -> None:
    """Clear the in-process rate cache. Exposed for tests and admin tooling."""
    _cache.invalidate()
