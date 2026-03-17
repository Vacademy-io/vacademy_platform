-- Migration to add is_skippable and fee_type_id to student_fee_payment table
-- Also adding is_skippable to fee_type table to act as the master template rule

ALTER TABLE fee_type
    ADD COLUMN is_skippable BOOLEAN DEFAULT FALSE;

ALTER TABLE student_fee_payment
    ADD COLUMN is_skippable BOOLEAN DEFAULT FALSE,
    ADD COLUMN fee_type_id VARCHAR(255);

-- Optional: Add an index on fee_type_id for faster lookups later when filtering by fee type
CREATE INDEX idx_student_fee_payment_fee_type_id ON student_fee_payment(fee_type_id);
