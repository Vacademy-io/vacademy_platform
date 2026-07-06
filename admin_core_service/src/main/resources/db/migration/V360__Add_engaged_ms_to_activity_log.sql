-- Bug 1 fix: authoritative "engaged time" per activity (milliseconds).
-- Populated at ingestion from the merged/union of breadcrumb intervals (passive media)
-- or the clamped wall-clock window (interactive / no-breadcrumb rows).
-- All time-reporting queries read SUM(engaged_ms) instead of (end_time - start_time),
-- which counted wall-clock tab-open time and inflated the leaderboard.
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS engaged_ms BIGINT;
