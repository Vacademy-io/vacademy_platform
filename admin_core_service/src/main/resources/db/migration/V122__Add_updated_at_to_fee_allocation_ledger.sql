-- Add updated_at column to student_fee_allocation_ledger table
ALTER TABLE student_fee_allocation_ledger
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT NOW();
