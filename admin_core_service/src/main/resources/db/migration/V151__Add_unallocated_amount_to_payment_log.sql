-- =======================================================================================
-- V151: Add unallocated_amount to payment_log (extra fee amount not applied to any bill)
-- =======================================================================================
-- When a user pays more than total dues, the excess is stored here per payment.
-- Backward compatible: new nullable column with DEFAULT 0; existing rows get 0.
-- No existing code reads this column; allocation service will write it when excess exists.
-- =======================================================================================

ALTER TABLE payment_log
    ADD COLUMN IF NOT EXISTS unallocated_amount DOUBLE PRECISION DEFAULT 0;

COMMENT ON COLUMN payment_log.unallocated_amount IS 'Amount from this payment that was not allocated to any student_fee_payment (excess/overpayment).';
