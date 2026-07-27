-- Index for the Course Pulse "who is live now" query:
--   WHERE last_seen_at > now() - interval '2 minutes'
-- Cannot be partial (now() is not immutable); the DESC range scan hits the cached tail.
--
-- CONCURRENTLY (matching V84) so building it does not lock writes on activity_log, the
-- highest-write table -- learner tracking keeps flowing during deploy. This file contains
-- ONLY the concurrent statement: Flyway runs an all-non-transactional migration outside a
-- transaction, but errors if a transactional statement is mixed in (hence the split from V403).
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_log_last_seen
    ON activity_log (last_seen_at DESC);
