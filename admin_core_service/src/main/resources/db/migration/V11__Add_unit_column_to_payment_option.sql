-- Migration script to add unit column to payment_option table
-- This column will store the unit information for payment options

ALTER TABLE payment_option ADD COLUMN unit VARCHAR(255);

-- Add comment to explain the column purpose
COMMENT ON COLUMN payment_option.unit IS 'Unit information for the payment option (e.g., currency, time period, etc.)';

