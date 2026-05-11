-- ================================================================================
-- V241: Platform Payment + Platform Payment Item
--
-- One row in `platform_payment` per Razorpay order placed against Vacademy's
-- own Razorpay account (not an institute's). Distinct from `payment_log` which
-- records institute -> learner payments.
--
-- One row in `platform_payment_item` per pack purchased in that order. Today
-- always exactly 1; the table shape future-proofs multi-pack carts without
-- another migration.
--
-- Lifecycle:
--   status         INITIATED -> SUCCESS | FAILED
--   payment_status PAYMENT_PENDING -> PAID | FAILED | REFUNDED | PARTIALLY_REFUNDED
-- ================================================================================

CREATE TABLE IF NOT EXISTS platform_payment (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id          VARCHAR(255) NOT NULL,           -- buying institute
    buyer_user_id         VARCHAR(255),                    -- user who clicked Buy

    vendor                VARCHAR(32) NOT NULL DEFAULT 'RAZORPAY',
    vendor_order_id       VARCHAR(64) UNIQUE,              -- razorpay order_id (set on order creation)
    vendor_payment_id     VARCHAR(64),                     -- razorpay payment_id (set on capture)

    currency              VARCHAR(3) NOT NULL,
    base_amount_minor     BIGINT NOT NULL,                 -- before tax
    tax_amount_minor      BIGINT NOT NULL DEFAULT 0,
    total_amount_minor    BIGINT NOT NULL,                 -- amount Razorpay charges = base + tax

    status                VARCHAR(32) NOT NULL,            -- INITIATED | SUCCESS | FAILED
    payment_status        VARCHAR(32) NOT NULL,            -- PAYMENT_PENDING | PAID | FAILED | REFUNDED | PARTIALLY_REFUNDED

    payment_specific_data JSONB,                           -- razorpay response, snapshots, refund history

    created_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_payment_institute       ON platform_payment(institute_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_payment_vendor_payment  ON platform_payment(vendor_payment_id);
CREATE INDEX IF NOT EXISTS idx_platform_payment_payment_status  ON platform_payment(payment_status);

-- ================================================================================
-- Per-pack line items. Snapshot the pack's price and tax at purchase time so
-- later catalog edits don't mutate historical orders.
-- tax_rate_bps is in basis points (1800 = 18.00%).
-- ================================================================================
CREATE TABLE IF NOT EXISTS platform_payment_item (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_payment_id  UUID NOT NULL REFERENCES platform_payment(id) ON DELETE CASCADE,
    pack_id              UUID NOT NULL REFERENCES credit_pack(id),

    pack_code_snapshot   VARCHAR(64) NOT NULL,
    credits              DECIMAL(12,2) NOT NULL,

    currency             VARCHAR(3) NOT NULL,
    base_amount_minor    BIGINT NOT NULL,
    tax_rate_bps         INT NOT NULL,                     -- 1800 = 18.00%
    tax_amount_minor     BIGINT NOT NULL,
    total_amount_minor   BIGINT NOT NULL,

    hsn_sac_snapshot     VARCHAR(8) NOT NULL,
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_payment_item_payment ON platform_payment_item(platform_payment_id);
CREATE INDEX IF NOT EXISTS idx_platform_payment_item_pack    ON platform_payment_item(pack_id);
