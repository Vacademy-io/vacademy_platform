-- V152: Add discount tracking to assigned_fee_value and audit columns to complex_payment_option

-- 1. Add discount columns to assigned_fee_value
--    original_amount: the full fee before any discount
--    discount_type:   'PERCENTAGE', 'FLAT', or NULL (no discount)
--    discount_value:  e.g. 10 for 10%, 5000 for flat ₹5000, or NULL
--    amount column (existing) remains the POST-DISCOUNT amount that drives installments
ALTER TABLE assigned_fee_value
    ADD COLUMN IF NOT EXISTS original_amount DECIMAL(10,2),
    ADD COLUMN IF NOT EXISTS discount_type   VARCHAR(50),
    ADD COLUMN IF NOT EXISTS discount_value  DECIMAL(10,2);

-- 2. Add audit columns to complex_payment_option
--    created_by:  userId of the admin/staff who created this CPO
--    approved_by: userId of the admin who approved this CPO (null if ACTIVE on creation)
ALTER TABLE complex_payment_option
    ADD COLUMN IF NOT EXISTS created_by  VARCHAR(255),
    ADD COLUMN IF NOT EXISTS approved_by VARCHAR(255);
