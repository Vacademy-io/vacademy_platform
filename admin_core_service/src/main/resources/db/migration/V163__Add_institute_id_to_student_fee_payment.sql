-- V163: Add institute_id column to student_fee_payment
-- Nullable — backward-compatible with all existing rows.
-- Populated at enrollment time by StudentFeePaymentGenerationService.generateFeeBills().
-- Used by the fee reminder workflow to filter payments per institute.

ALTER TABLE student_fee_payment
    ADD COLUMN IF NOT EXISTS institute_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_sfp_institute_id ON student_fee_payment (institute_id);
