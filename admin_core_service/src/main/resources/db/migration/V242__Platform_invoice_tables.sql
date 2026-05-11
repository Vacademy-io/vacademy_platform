-- ================================================================================
-- V242: Platform Invoice + Platform Invoice Line Item + Invoice Number Sequence
--
-- GST-compliant invoices for AI credit pack purchases (Vacademy as supplier,
-- institute as buyer). Distinct from the existing `invoice` / `invoice_line_item`
-- tables which are for institute -> learner billing.
--
-- IMPORTANT: All buyer + supplier fields are SNAPSHOTTED at issue time. Editing
-- `institutes.gstin` or `platform_payment_config.supplier_gstin` later must NOT
-- mutate historical invoices (Indian GST law requires immutable invoices).
--
-- Tax breakup matches the Indian GST regime:
--   - Intra-state (buyer state == supplier state): CGST + SGST
--   - Inter-state                                 : IGST
--   - Export (non-Indian buyer)                   : 0% (zero-rated)
-- All `*_rate_bps` are in basis points (1800 = 18.00%).
-- ================================================================================

-- ================================================================================
-- 1. Invoice number sequence: monthly counter -> "INV-AICRED-YYYYMM-NNNN"
--    Allocated atomically via INSERT ... ON CONFLICT (yyyymm) DO UPDATE ... RETURNING.
-- ================================================================================
CREATE TABLE IF NOT EXISTS ai_credit_invoice_sequence (
    yyyymm  CHAR(6) PRIMARY KEY,                    -- "202605"
    last_no INT NOT NULL DEFAULT 0
);

-- ================================================================================
-- 2. Platform Invoice - one row per credit-pack purchase
-- ================================================================================
CREATE TABLE IF NOT EXISTS platform_invoice (
    id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_payment_id      UUID NOT NULL UNIQUE REFERENCES platform_payment(id),
    invoice_number           VARCHAR(64) NOT NULL UNIQUE,    -- INV-AICRED-202605-0001

    -- Supplier (Vacademy) snapshot at issue time
    supplier_legal_name      VARCHAR(255) NOT NULL,
    supplier_gstin           VARCHAR(15),
    supplier_state_code      VARCHAR(2)  NOT NULL,
    supplier_address         TEXT NOT NULL,

    -- Buyer (institute) snapshot at issue time
    buyer_institute_id       VARCHAR(255) NOT NULL,
    buyer_legal_name         VARCHAR(255) NOT NULL,
    buyer_gstin              VARCHAR(15),
    buyer_state_code         VARCHAR(2),
    buyer_address            TEXT,

    place_of_supply          VARCHAR(2)  NOT NULL,           -- buyer_state_code; "96" for export / outside India
    is_export                BOOLEAN     NOT NULL DEFAULT FALSE,

    currency                 VARCHAR(3)  NOT NULL,
    base_amount_minor        BIGINT NOT NULL,
    cgst_amount_minor        BIGINT NOT NULL DEFAULT 0,
    sgst_amount_minor        BIGINT NOT NULL DEFAULT 0,
    igst_amount_minor        BIGINT NOT NULL DEFAULT 0,
    total_amount_minor       BIGINT NOT NULL,

    pdf_s3_url               TEXT,                            -- nullable: set after PDF render
    issued_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_invoice_buyer  ON platform_invoice(buyer_institute_id, issued_at DESC);
CREATE INDEX IF NOT EXISTS idx_platform_invoice_issued ON platform_invoice(issued_at DESC);

-- ================================================================================
-- 3. Platform Invoice Line Item - per pack purchased
-- ================================================================================
CREATE TABLE IF NOT EXISTS platform_invoice_line_item (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    platform_invoice_id UUID NOT NULL REFERENCES platform_invoice(id) ON DELETE CASCADE,

    description         VARCHAR(255) NOT NULL,                -- "AI Credits — PRO pack (2,500 credits)"
    hsn_sac_code        VARCHAR(8)   NOT NULL,
    quantity            DECIMAL(12,2) NOT NULL DEFAULT 1,
    unit_price_minor    BIGINT NOT NULL,
    base_amount_minor   BIGINT NOT NULL,

    cgst_rate_bps       INT    NOT NULL DEFAULT 0,
    cgst_amount_minor   BIGINT NOT NULL DEFAULT 0,
    sgst_rate_bps       INT    NOT NULL DEFAULT 0,
    sgst_amount_minor   BIGINT NOT NULL DEFAULT 0,
    igst_rate_bps       INT    NOT NULL DEFAULT 0,
    igst_amount_minor   BIGINT NOT NULL DEFAULT 0,

    total_amount_minor  BIGINT NOT NULL,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_platform_invoice_line_item_invoice ON platform_invoice_line_item(platform_invoice_id);
