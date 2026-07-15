-- V373: Invoice source tracking + user account ledger
-- Part 1: add source/source_id to invoice table
ALTER TABLE invoice
    ADD COLUMN IF NOT EXISTS source VARCHAR(50),
    ADD COLUMN IF NOT EXISTS source_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_invoice_source ON invoice(source, source_id);

-- Part 2: user_account_ledger – append-only event log
-- tracks every debit (obligation created) and credit (payment received / adjustment)
-- for every user across all payment tracks (subscription, CPO fee, admin invoice).
-- Running balance = SUM(credits) - SUM(debits) per user + institute.
CREATE TABLE IF NOT EXISTS user_account_ledger (
    id           VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id      VARCHAR(255) NOT NULL,
    institute_id VARCHAR(255) NOT NULL,

    -- DEBIT_ACCRUAL   : obligation created (UserPlan PENDING_FOR_PAYMENT, SFP bill, admin invoice raised)
    -- CREDIT_PAYMENT  : money received (gateway success, offline payment, admin mark-paid)
    -- CREDIT_WAIVER   : full fee waiver / concession on a bill
    -- CREDIT_ADJUSTMENT: partial concession that reduces the outstanding amount
    -- DEBIT_PENALTY   : penalty added to a fee bill
    event_type   VARCHAR(50)  NOT NULL,

    amount       DECIMAL(15, 2) NOT NULL CHECK (amount >= 0),
    currency     VARCHAR(10)  NOT NULL DEFAULT 'INR',

    -- Populated on DEBIT rows: when the obligation is due
    due_date     DATE,

    -- Which entity triggered this row: USER_PLAN, STUDENT_FEE_PAYMENT, ADMIN_INVOICE
    source_type  VARCHAR(50)  NOT NULL,
    source_id    VARCHAR(255),

    -- Link back to invoice when one was generated
    invoice_id   VARCHAR(255),

    -- On CREDIT rows: payment_log.id or adjustment_history.id
    reference_id VARCHAR(255),

    remarks      TEXT,
    created_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ual_user_institute ON user_account_ledger(user_id, institute_id);
CREATE INDEX IF NOT EXISTS idx_ual_source         ON user_account_ledger(source_type, source_id);
CREATE INDEX IF NOT EXISTS idx_ual_event_type     ON user_account_ledger(event_type);
CREATE INDEX IF NOT EXISTS idx_ual_invoice        ON user_account_ledger(invoice_id);
