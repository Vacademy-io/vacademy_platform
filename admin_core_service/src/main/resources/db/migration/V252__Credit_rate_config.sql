-- ================================================================================
-- V252: Credit Rate Config — DB-driven USD↔credits ratio + margin
--
-- Replaces the hardcoded USD_TO_CREDIT_RATIO = 150 in ai_service/credit_service.py.
-- Splits the single ratio into two independent knobs:
--   - usd_to_credits: base $1 → credits ratio (no margin)
--   - margin_pct:     markup percent applied on top
--
-- Effective ratio = usd_to_credits × (1 + margin_pct/100).
-- Seed values yield 100 × 1.5 = 150 — identical to today's behavior.
--
-- Append-only: a rate change is a new row with `effective_from = now`.
-- The "current" rate is the most recent row whose effective_from <= now.
-- Historical credit_transactions are NEVER repriced — their `amount` and
-- `balance_after` are already credit-denominated snapshots.
-- ================================================================================

CREATE TABLE IF NOT EXISTS credit_rate_config (
    id              BIGSERIAL PRIMARY KEY,
    usd_to_credits  DECIMAL(10,4) NOT NULL,
    margin_pct      DECIMAL(5,2)  NOT NULL,
    currency_code   VARCHAR(8)    NOT NULL DEFAULT 'USD',
    effective_from  TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    notes           TEXT,
    created_by      VARCHAR(255),
    created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT credit_rate_config_usd_to_credits_positive CHECK (usd_to_credits > 0),
    CONSTRAINT credit_rate_config_margin_nonneg CHECK (margin_pct >= 0)
);

CREATE INDEX IF NOT EXISTS idx_credit_rate_effective
    ON credit_rate_config (effective_from DESC);

-- Seed with current values — preserves existing 150× behavior.
INSERT INTO credit_rate_config (usd_to_credits, margin_pct, notes, created_by)
SELECT 100.00, 50.00,
       'Initial seed (V252) — matches hardcoded USD_TO_CREDIT_RATIO=150',
       'system'
WHERE NOT EXISTS (SELECT 1 FROM credit_rate_config);
