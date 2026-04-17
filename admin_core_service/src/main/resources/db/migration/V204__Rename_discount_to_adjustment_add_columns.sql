-- Rename existing discount columns to adjustment
ALTER TABLE student_fee_payment RENAME COLUMN discount_amount TO adjustment_amount;
ALTER TABLE student_fee_payment RENAME COLUMN discount_reason TO adjustment_reason;

-- Add adjustment_type: 'CONCESSION' or 'PENALTY'
ALTER TABLE student_fee_payment ADD COLUMN adjustment_type VARCHAR(20);

-- Add adjustment_status: NULL, 'PENDING_FOR_APPROVAL', 'APPROVED', 'REJECTED'
ALTER TABLE student_fee_payment ADD COLUMN adjustment_status VARCHAR(30);

-- Migrate existing data: any existing discount > 0 becomes an approved concession
-- Amount stays positive (unsigned storage), type indicates concession
UPDATE student_fee_payment
SET adjustment_type = 'CONCESSION',
    adjustment_status = 'APPROVED'
WHERE adjustment_amount IS NOT NULL AND adjustment_amount > 0;

-- Zero/null amounts: clear type and status
UPDATE student_fee_payment
SET adjustment_type = NULL,
    adjustment_status = NULL
WHERE adjustment_amount IS NULL OR adjustment_amount = 0;
