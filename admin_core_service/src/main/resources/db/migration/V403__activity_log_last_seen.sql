ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;

-- Serves "who is live now": WHERE last_seen_at > now() - interval '2 minutes'.
-- Cannot be partial (now() is not immutable); the range scan hits the cached tail.
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_log_last_seen
    ON activity_log (last_seen_at DESC);
