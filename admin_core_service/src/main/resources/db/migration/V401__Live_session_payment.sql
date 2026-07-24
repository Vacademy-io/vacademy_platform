-- Paid live sessions: a live_session can carry a price via a payment_option row
-- (source='LIVE_SESSION', source_id=<live_session.id>, type='ONE_TIME') with a single
-- payment_plan holding the amount + currency. No new tables needed for the config side.
--
-- The purchase itself is tracked on the registration row: every payer (public guest OR
-- authenticated learner of a private session) gets a session_guest_registrations row,
-- which now records who paid (user_id — payers always get an auth user so the invoice
-- machinery works), the payment state, and the invoice/payment-log linkage.
-- payment_status: NULL = registration for a free session (legacy rows unchanged),
--                 'PENDING' = registered but not yet paid, 'PAID' = settled.

ALTER TABLE session_guest_registrations
    ADD COLUMN IF NOT EXISTS user_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS payment_status VARCHAR(30),
    ADD COLUMN IF NOT EXISTS payment_amount NUMERIC(12, 2),
    ADD COLUMN IF NOT EXISTS payment_currency VARCHAR(10),
    ADD COLUMN IF NOT EXISTS invoice_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS payment_log_id VARCHAR(255);

-- Webhook confirmation resolves invoice -> registration; join gating resolves (session, user).
CREATE INDEX IF NOT EXISTS idx_session_guest_registrations_invoice_id
    ON session_guest_registrations (invoice_id);
CREATE INDEX IF NOT EXISTS idx_session_guest_registrations_session_user
    ON session_guest_registrations (session_id, user_id);
