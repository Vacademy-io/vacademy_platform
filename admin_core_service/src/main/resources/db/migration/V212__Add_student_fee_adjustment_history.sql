-- New table: append-only history of every adjustment event on an installment
CREATE TABLE student_fee_adjustment_history (
    id                      VARCHAR(36) PRIMARY KEY,
    student_fee_payment_id  VARCHAR(36) NOT NULL REFERENCES student_fee_payment(id),
    institute_id            VARCHAR(255) NOT NULL,
    event_type              VARCHAR(40) NOT NULL,
    adjustment_type         VARCHAR(40) NOT NULL,
    amount                  NUMERIC(19, 4) NOT NULL,
    reason                  TEXT,
    resulting_status        VARCHAR(40) NOT NULL,
    actor_user_id           VARCHAR(255) NOT NULL,
    actor_role              VARCHAR(100),
    previous_event_id       VARCHAR(36) REFERENCES student_fee_adjustment_history(id),
    metadata                JSONB,
    created_at              TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sfah_bill_created
    ON student_fee_adjustment_history (student_fee_payment_id, created_at DESC);

CREATE INDEX idx_sfah_institute_event
    ON student_fee_adjustment_history (institute_id, event_type, created_at DESC);

CREATE INDEX idx_sfah_actor
    ON student_fee_adjustment_history (actor_user_id);

-- FK on student_fee_payment pointing to current effective history row
ALTER TABLE student_fee_payment
    ADD COLUMN current_adjustment_history_id VARCHAR(36)
    REFERENCES student_fee_adjustment_history(id);

-- Backfill: one seed history row per existing non-null adjustment.
-- Actor set to synthetic 'MIGRATION' marker since original actor was never recorded.
INSERT INTO student_fee_adjustment_history (
    id, student_fee_payment_id, institute_id, event_type,
    adjustment_type, amount, reason, resulting_status,
    actor_user_id, metadata, created_at
)
SELECT
    gen_random_uuid()::text,
    sfp.id,
    COALESCE(sfp.institute_id, 'UNKNOWN'),
    CASE
        WHEN sfp.adjustment_status = 'PENDING_FOR_APPROVAL' THEN 'SUBMITTED'
        WHEN sfp.adjustment_status = 'APPROVED' THEN 'APPROVED'
        WHEN sfp.adjustment_status = 'REJECTED' THEN 'REJECTED'
    END,
    sfp.adjustment_type,
    COALESCE(sfp.adjustment_amount, 0),
    sfp.adjustment_reason,
    sfp.adjustment_status,
    'MIGRATION',
    '{"source": "V212_backfill"}'::jsonb,
    COALESCE(sfp.updated_at, sfp.created_at, NOW())
FROM student_fee_payment sfp
WHERE sfp.adjustment_status IS NOT NULL
  AND sfp.adjustment_type IS NOT NULL;

-- Link each installment's FK to its seeded history row
UPDATE student_fee_payment sfp
SET current_adjustment_history_id = h.id
FROM student_fee_adjustment_history h
WHERE h.student_fee_payment_id = sfp.id
  AND h.actor_user_id = 'MIGRATION';

-- Drop the 4 legacy adjustment columns — replaced by FK lookup into history table
ALTER TABLE student_fee_payment DROP COLUMN adjustment_amount;
ALTER TABLE student_fee_payment DROP COLUMN adjustment_reason;
ALTER TABLE student_fee_payment DROP COLUMN adjustment_type;
ALTER TABLE student_fee_payment DROP COLUMN adjustment_status;
