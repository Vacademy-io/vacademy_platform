-- =========================================================================
-- V224: Unify ComplexPaymentOption (CPO) into the PaymentOption strategy
--
-- - Adds payment_option.complex_payment_option_id (FK to complex_payment_option)
-- - Backfills a mirror PaymentOption (type='CPO') for every existing CPO,
--   keeping source='INSTITUTE', source_id=cpo.institute_id so institute-
--   filtered queries continue to work
-- - Backfills one synthetic PaymentPlan per mirror with actualPrice equal to
--   the sum of all aft_installments (or AssignedFeeValue.amount when there
--   are no installments) and validity_in_days derived from installment dates
-- - Repoints existing bridge rows that carry cpo_id so their payment_option_id
--   points at the new mirror, then drops the now-redundant cpo_id column
--
-- Idempotent: every insert/update has a NOT EXISTS / WHERE guard so a Flyway
-- repair replays cleanly. Drop step is gated on column existence.
-- =========================================================================

-- 1) Add nullable FK column on payment_option
ALTER TABLE payment_option
    ADD COLUMN IF NOT EXISTS complex_payment_option_id VARCHAR(255);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'payment_option'
          AND constraint_name = 'fk_payment_option_cpo'
    ) THEN
        ALTER TABLE payment_option
            ADD CONSTRAINT fk_payment_option_cpo
            FOREIGN KEY (complex_payment_option_id)
            REFERENCES complex_payment_option(id);
    END IF;
END $$;

-- Partial unique index: at most one mirror PaymentOption per CPO
CREATE UNIQUE INDEX IF NOT EXISTS uq_payment_option_complex_payment_option_id
    ON payment_option(complex_payment_option_id)
    WHERE complex_payment_option_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_payment_option_type
    ON payment_option(type);

-- 2) Backfill: one mirror PaymentOption per existing CPO
INSERT INTO payment_option (
    id, name, status, source, source_id, type,
    require_approval, complex_payment_option_id, created_at, updated_at
)
SELECT
    gen_random_uuid()::text,
    cpo.name,
    CASE
        WHEN cpo.status = 'PENDING_APPROVAL' THEN 'PENDING_APPROVAL'
        WHEN cpo.status = 'DELETED'          THEN 'DELETED'
        ELSE 'ACTIVE'
    END,
    'INSTITUTE',
    cpo.institute_id,
    'CPO',
    FALSE,
    cpo.id,
    NOW(), NOW()
FROM complex_payment_option cpo
WHERE NOT EXISTS (
    SELECT 1 FROM payment_option po
    WHERE po.complex_payment_option_id = cpo.id
);

-- 3) Backfill: one synthetic PaymentPlan per mirror
INSERT INTO payment_plan (
    id, name, status, validity_in_days, actual_price, elevated_price,
    currency, description, tag, payment_option_id, created_at, updated_at
)
SELECT
    gen_random_uuid()::text,
    po.name,
    'ACTIVE',
    NULLIF(
        EXTRACT(DAY FROM (MAX(afi.end_date)::timestamp - MIN(afi.start_date)::timestamp))::int,
        0
    ),
    COALESCE(SUM(afi.amount), MAX(afv.amount), 0),
    0,
    'INR',
    'Synthetic plan auto-generated for CPO-backed payment option',
    'DEFAULT',
    po.id,
    NOW(), NOW()
FROM payment_option po
LEFT JOIN fee_type ft            ON ft.cpo_id                 = po.complex_payment_option_id
LEFT JOIN assigned_fee_value afv ON afv.fee_type_id           = ft.id
LEFT JOIN aft_installments afi   ON afi.assigned_fee_value_id = afv.id
WHERE po.type = 'CPO'
  AND po.complex_payment_option_id IS NOT NULL
  AND NOT EXISTS (
      SELECT 1 FROM payment_plan pp WHERE pp.payment_option_id = po.id
  )
GROUP BY po.id, po.name;

-- 4) Repoint bridge rows currently carrying cpo_id to the CPO's mirror PaymentOption
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_name = 'package_session_learner_invitation_to_payment_option'
          AND column_name = 'cpo_id'
    ) THEN
        EXECUTE $upd$
            UPDATE package_session_learner_invitation_to_payment_option bridge
            SET payment_option_id = po.id
            FROM payment_option po
            WHERE po.complex_payment_option_id = bridge.cpo_id
              AND bridge.cpo_id IS NOT NULL
              AND bridge.status <> 'DELETED'
        $upd$;
    END IF;
END $$;

-- 5) Drop the now-redundant cpo_id column on the bridge.
--    All readers (validateCpoForPackageSession, findDistinctCpoIdsByPackageSessionId,
--    findByCpoId, assignCpoToPackageSession) are switched to derive the CPO via
--    bridge.payment_option_id -> payment_option.complex_payment_option_id in the
--    same deploy.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.table_constraints
        WHERE table_name = 'package_session_learner_invitation_to_payment_option'
          AND constraint_name = 'fk_package_session_learner_invitation_cpo'
    ) THEN
        ALTER TABLE package_session_learner_invitation_to_payment_option
            DROP CONSTRAINT fk_package_session_learner_invitation_cpo;
    END IF;
END $$;

DROP INDEX IF EXISTS idx_package_session_learner_invitation_cpo_id;

ALTER TABLE package_session_learner_invitation_to_payment_option
    DROP COLUMN IF EXISTS cpo_id;
