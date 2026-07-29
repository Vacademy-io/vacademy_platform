-- learner_operation had no unique key on (user_id, source, source_id, operation):
-- the read-then-write upsert in LearnerOperationService raced under the async
-- progress cascade and inserted duplicate rows. Duplicates split-brain the
-- rollup queries (SUM counts every row, COUNT(DISTINCT slide_id) counts one),
-- silently inflating chapter percentages.
--
-- NOTE: the first version of this migration deduped with a DELETE..USING
-- self-join — quadratic without an index on the logical key — and died on the
-- statement timeout at boot. This version is a single sequential scan + sort
-- (ROW_NUMBER over the logical key), and raises the timeout for this
-- transaction only. Flyway runs the whole file in one transaction, so
-- SET LOCAL applies to every statement below and resets automatically.

SET LOCAL statement_timeout = '30min';

-- 1. Dedupe: keep the most recently created row per logical key
--    (NULLS LAST so a row missing created_at never wins over a real one).
DELETE FROM learner_operation
WHERE id IN (
    SELECT id
    FROM (
        SELECT id,
               ROW_NUMBER() OVER (
                   PARTITION BY user_id, source, source_id, operation
                   ORDER BY created_at DESC NULLS LAST, id DESC
               ) AS rn
        FROM learner_operation
    ) ranked
    WHERE rn > 1
);

-- 2. Enforce uniqueness so concurrent writers conflict instead of duplicating.
--    Also the index ON CONFLICT (user_id, source, source_id, operation) in
--    LearnerOperationRepository.upsertOperation resolves against.
CREATE UNIQUE INDEX IF NOT EXISTS uq_learner_operation_user_source_op
    ON learner_operation (user_id, source, source_id, operation);
