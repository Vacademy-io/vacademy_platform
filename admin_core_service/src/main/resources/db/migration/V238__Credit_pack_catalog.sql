-- ================================================================================
-- V238: AI Credit Pack Catalog
--
-- Adds the catalog of purchasable AI credit packs and their per-currency prices.
-- Source of pricing: ai_service/docs/AI_CREDITS_PRICING.md
-- Prices are stored in minor units (paise / cents) to avoid float drift.
-- Tables created:
--   1. credit_pack          - the SKU (code, name, credits, HSN/SAC, badge)
--   2. credit_pack_price    - per-currency price (multi-currency-ready)
-- ================================================================================

-- ================================================================================
-- 1. Credit Pack - Catalog of purchasable packs
-- ================================================================================
CREATE TABLE IF NOT EXISTS credit_pack (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code            VARCHAR(64) NOT NULL UNIQUE,           -- "BASIC", "PRO", "BUSINESS", "ENTERPRISE"
    name            VARCHAR(128) NOT NULL,
    credits         DECIMAL(12,2) NOT NULL,                -- credits granted on purchase
    hsn_sac_code    VARCHAR(8) NOT NULL DEFAULT '998313',  -- SAC code for SaaS (default)
    display_order   INT NOT NULL DEFAULT 0,                -- order in pack picker UI
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    badge           VARCHAR(32),                            -- "Most Popular", "Best Value", null
    metadata        JSONB,                                  -- description, marketing copy, etc.
    created_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credit_pack_active_order ON credit_pack(is_active, display_order);

-- ================================================================================
-- 2. Credit Pack Price - Per-currency pricing (multi-currency-ready)
--    amount_minor is in smallest unit: paise for INR, cents for USD.
-- ================================================================================
CREATE TABLE IF NOT EXISTS credit_pack_price (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    pack_id          UUID NOT NULL REFERENCES credit_pack(id) ON DELETE CASCADE,
    currency         VARCHAR(3) NOT NULL,                   -- "INR", "USD"
    amount_minor     BIGINT NOT NULL,                       -- never use float for money
    is_tax_inclusive BOOLEAN NOT NULL DEFAULT FALSE,        -- false = base; total = base + GST
    is_active        BOOLEAN NOT NULL DEFAULT TRUE,
    created_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at       TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (pack_id, currency)
);

CREATE INDEX IF NOT EXISTS idx_credit_pack_price_pack_currency ON credit_pack_price(pack_id, currency);

-- ================================================================================
-- 3. Seed the four paid packs (Basic, Pro, Business, Enterprise).
--    Prices treated as tax-exclusive base; GST added at order time.
--    Source: ai_service/docs/AI_CREDITS_PRICING.md
-- ================================================================================
INSERT INTO credit_pack (code, name, credits, display_order, badge, metadata)
VALUES
    ('BASIC',      'Basic',      500,     10, NULL,             '{"description": "Small institutes, light usage"}'::jsonb),
    ('PRO',        'Pro',        2500,    20, 'Most Popular',   '{"description": "Regular usage, ~50 videos/month"}'::jsonb),
    ('BUSINESS',   'Business',   6100,    30, 'Best Value',     '{"description": "Heavy usage, ~125 videos/month"}'::jsonb),
    ('ENTERPRISE', 'Enterprise', 10000,   40, NULL,             '{"description": "Large institutes, bulk generation"}'::jsonb)
ON CONFLICT (code) DO NOTHING;

-- INR prices in paise (₹465 = 46500 paise, etc.)
INSERT INTO credit_pack_price (pack_id, currency, amount_minor, is_tax_inclusive)
SELECT id, 'INR',
    CASE code
        WHEN 'BASIC'      THEN 46500
        WHEN 'PRO'        THEN 232500
        WHEN 'BUSINESS'   THEN 570000
        WHEN 'ENTERPRISE' THEN 930000
    END,
    FALSE
FROM credit_pack
WHERE code IN ('BASIC', 'PRO', 'BUSINESS', 'ENTERPRISE')
ON CONFLICT (pack_id, currency) DO NOTHING;

-- USD prices in cents ($5 = 500 cents, etc.)
INSERT INTO credit_pack_price (pack_id, currency, amount_minor, is_tax_inclusive)
SELECT id, 'USD',
    CASE code
        WHEN 'BASIC'      THEN 500
        WHEN 'PRO'        THEN 2500
        WHEN 'BUSINESS'   THEN 6100
        WHEN 'ENTERPRISE' THEN 10000
    END,
    FALSE
FROM credit_pack
WHERE code IN ('BASIC', 'PRO', 'BUSINESS', 'ENTERPRISE')
ON CONFLICT (pack_id, currency) DO NOTHING;
