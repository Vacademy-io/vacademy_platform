-- Autopay / recurring-mandate support on user_plan.
--
-- These columns drive the auto-charge scheduler (RenewalChargeScheduler / the
-- emitRenewalCharges pass on PackageSessionScheduler). They are ADDITIVE and
-- default OFF, so every pre-existing plan keeps its current behaviour: the
-- scheduler only picks up plans where auto_renewal_enabled = true, which is
-- set only on new mandate enrollments (or a deliberate one-time backfill for
-- existing eWay token customers). No column here holds the mandate itself —
-- the mandate (token id, max_amount, status) lives in
-- user_institute_payment_gateway_mapping.payment_gateway_customer_data JSON,
-- keyed per user_plan id.

ALTER TABLE user_plan ADD COLUMN IF NOT EXISTS auto_renewal_enabled BOOLEAN NOT NULL DEFAULT FALSE;

-- Next date the scheduler should attempt a renewal charge. Usually mirrors
-- end_date; kept explicit so trial (charge at trial-end) and renewal are
-- handled uniformly, and so a failed attempt can be re-spaced without moving
-- end_date.
ALTER TABLE user_plan ADD COLUMN IF NOT EXISTS next_charge_at TIMESTAMP;

-- True while the plan is in its free-trial window (access granted, no real
-- charge yet; first debit happens on next_charge_at = trial-end).
ALTER TABLE user_plan ADD COLUMN IF NOT EXISTS is_trial BOOLEAN NOT NULL DEFAULT FALSE;

-- Dunning bookkeeping for the current billing cycle.
ALTER TABLE user_plan ADD COLUMN IF NOT EXISTS renewal_attempt_count INT NOT NULL DEFAULT 0;
ALTER TABLE user_plan ADD COLUMN IF NOT EXISTS last_renewal_attempt_at TIMESTAMP;

-- Partial index for the scheduler's due-query (only autopay-enabled plans).
CREATE INDEX IF NOT EXISTS idx_user_plan_due_for_renewal
    ON user_plan (next_charge_at)
    WHERE auto_renewal_enabled = TRUE;
