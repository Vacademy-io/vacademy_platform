-- ================================================================================
-- V243: Credit Transactions - external reference + idempotency for PURCHASE/REFUND
--
-- Adds an `external_reference_id` (VARCHAR, gateway-side ID) and a partial UNIQUE
-- index on it. This is the dedup boundary for webhook-driven inserts:
--   - PURCHASE row: external_reference_id = razorpay payment_id (e.g. "pay_...")
--   - REFUND   row: external_reference_id = razorpay refund_id  (e.g. "rfnd_...")
-- A retried webhook tries to insert a second row with the same gateway ID,
-- hits the unique constraint, and the application returns `already_processed=true`.
--
-- Note: the existing `reference_id UUID` column from V100 is left untouched. It
-- still links USAGE_DEDUCTION rows to ai_token_usage.id. PURCHASE/REFUND rows
-- should also populate it with the platform_payment.id for reverse lookups
-- ("which transactions belong to this purchase?").
--
-- TransactionType values used:
--   PURCHASE  - already declared in ai_service/app/schemas/credits.py:23
--   REFUND    - already declared in ai_service/app/schemas/credits.py:21
-- ================================================================================

ALTER TABLE credit_transactions
    ADD COLUMN IF NOT EXISTS external_reference_id VARCHAR(255);

-- Partial unique index: only enforced on rows where external_reference_id is set,
-- so existing USAGE_DEDUCTION / INITIAL_GRANT rows (NULL) aren't affected.
CREATE UNIQUE INDEX IF NOT EXISTS idx_credit_transactions_external_ref_unique
    ON credit_transactions(external_reference_id)
    WHERE external_reference_id IS NOT NULL;
