-- learner_operation had no unique key on (user_id, source, source_id, operation):
-- the read-then-write upsert in LearnerOperationService raced under the async
-- progress cascade and inserted duplicate rows. Duplicates split-brain the
-- rollup queries (SUM counts every row, COUNT(DISTINCT slide_id) counts one),
-- silently inflating chapter percentages.

-- 1. Dedupe: keep the most recently created row per logical key.
DELETE FROM learner_operation a
USING learner_operation b
WHERE a.id <> b.id
  AND a.user_id   IS NOT DISTINCT FROM b.user_id
  AND a.source    IS NOT DISTINCT FROM b.source
  AND a.source_id IS NOT DISTINCT FROM b.source_id
  AND a.operation IS NOT DISTINCT FROM b.operation
  AND (a.created_at < b.created_at
       OR (a.created_at = b.created_at AND a.id < b.id));

-- 2. Enforce uniqueness so concurrent writers conflict instead of duplicating.
CREATE UNIQUE INDEX IF NOT EXISTS uq_learner_operation_user_source_op
    ON learner_operation (user_id, source, source_id, operation);
