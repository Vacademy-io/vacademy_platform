-- ============================================================
-- V580: regional (country-based) pricing for payment plans.
--
-- payment_option.regional_pricing_enabled is the master switch. When it is on, a
-- learner's checkout price is looked up from payment_plan_regional_price by the
-- viewer's country (Cloudflare CF-IPCountry) instead of payment_plan.actual_price.
-- regional_pricing_currencies lists the currencies the system keeps an AUTO
-- (exchange-rate converted, rounded) row for on every plan of the option.
--
-- A regional row is either AUTO (recomputed from the base price and fx_rate) or
-- MANUAL (an admin typed it; never overwritten). country_code NULL means "every
-- country whose currency is this one"; a non-null country_code wins over it.
--
-- user_plan.regional_* locks the price the learner bought at, so renewals,
-- invoices and the ledger keep charging that currency and amount even if the
-- learner later travels or the admin edits the regional table.
-- ============================================================

ALTER TABLE payment_option
    ADD COLUMN IF NOT EXISTS regional_pricing_enabled    BOOLEAN NOT NULL DEFAULT FALSE,
    -- comma-separated ISO-4217 codes, e.g. 'USD,GBP,AED'
    ADD COLUMN IF NOT EXISTS regional_pricing_currencies TEXT;

CREATE TABLE IF NOT EXISTS payment_plan_regional_price (
    id                    VARCHAR(255) PRIMARY KEY,
    payment_plan_id       VARCHAR(255) NOT NULL REFERENCES payment_plan (id),
    currency              VARCHAR(3)   NOT NULL,
    -- ISO-3166 alpha-2; NULL = all countries using this currency
    country_code          VARCHAR(2),
    actual_price          NUMERIC(14, 2) NOT NULL,
    elevated_price        NUMERIC(14, 2),
    price_source          VARCHAR(10)  NOT NULL,          -- AUTO | MANUAL
    -- what the row was computed from, so a base-price edit or rate drift is detectable
    base_price_at_compute NUMERIC(14, 2),
    base_currency         VARCHAR(3),
    fx_rate_used          NUMERIC(24, 10),
    computed_at           TIMESTAMP,
    -- MANUAL row whose base price changed after the admin set it
    needs_review          BOOLEAN      NOT NULL DEFAULT FALSE,
    status                VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',
    created_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP    DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pprp_plan
    ON payment_plan_regional_price (payment_plan_id)
    WHERE status = 'ACTIVE';

-- one live row per (plan, currency, country); COALESCE so the currency-wide row is unique too
CREATE UNIQUE INDEX IF NOT EXISTS uq_pprp_plan_currency_country
    ON payment_plan_regional_price (payment_plan_id, currency, COALESCE(country_code, ''))
    WHERE status = 'ACTIVE';

-- Daily exchange rates, all quoted against USD (units of `currency` per 1 USD).
CREATE TABLE IF NOT EXISTS fx_rate (
    currency      VARCHAR(3) PRIMARY KEY,
    units_per_usd NUMERIC(24, 10) NOT NULL,
    source        VARCHAR(100),
    fetched_at    TIMESTAMP NOT NULL
);

ALTER TABLE user_plan
    ADD COLUMN IF NOT EXISTS regional_price    NUMERIC(14, 2),
    ADD COLUMN IF NOT EXISTS regional_currency VARCHAR(3),
    ADD COLUMN IF NOT EXISTS regional_country  VARCHAR(2);
