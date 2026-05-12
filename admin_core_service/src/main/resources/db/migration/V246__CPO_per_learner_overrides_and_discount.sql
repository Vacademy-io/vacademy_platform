-- Per-learner installment overrides for CPO enrollments.
--
-- Driven by the bulk-assign v3 flow:
--   Admin picks a CPO, then for each learner customizes per-installment
--   start/end dates and amounts, applies installment-level and/or whole-CPO
--   discounts. After enrollment the same fields are editable from the
--   side-view payment history.
--
-- Design:
--   - student_fee_payment.amount_expected stays as the *net* (post-discount)
--     value FIFO targets. original_amount preserves the template face value
--     so we can always show "before vs after". start_date is new; due_date
--     continues to mean "deadline".
--   - The CPO-level discount + per-installment discount audit snapshot is
--     embedded inside the existing user_plan.payment_option_json column
--     under the "cpo_discount_state" key (no new column). PaymentOption is
--     deserialized with @JsonIgnoreProperties so existing readers ignore it.

ALTER TABLE student_fee_payment
    ADD COLUMN IF NOT EXISTS start_date       DATE,
    ADD COLUMN IF NOT EXISTS original_amount  DECIMAL(19,2);

-- Backfill original_amount for existing rows so the invariant
--   original_amount >= amount_expected
-- holds from day one. For pre-V238 rows nothing was discounted, so
-- original_amount == amount_expected.
UPDATE student_fee_payment
   SET original_amount = amount_expected
 WHERE original_amount IS NULL;
