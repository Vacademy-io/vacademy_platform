-- Discounted enrollments: the ledger's DEBIT_ACCRUAL stores the NET obligation
-- (what will actually be charged). To let the panel render "list price struck
-- through -> net" on the transaction line, carry the pricing breakdown on the
-- entry itself. Nullable — only populated when a discount/coupon applied.
ALTER TABLE user_account_ledger
    ADD COLUMN IF NOT EXISTS gross_amount    NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS discount_amount NUMERIC(12, 2);
