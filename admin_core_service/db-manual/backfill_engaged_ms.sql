-- =============================================================================
-- MANUAL BACKFILL — run in DBeaver (NOT a Flyway migration). One-time.
-- Repairs historical activity_log for the learning-time leaderboard fix.
--
-- Pairs with Flyway V360 (adds the engaged_ms column) and the code change that
-- makes every time query read SUM(engaged_ms) instead of (end_time - start_time).
--
-- SAFE TO RUN MULTIPLE TIMES (idempotent). Recompute-from-source, not incremental.
--
-- RECOMMENDED ORDER on prod, to avoid a window where old rows show 0 minutes:
--   1. Run this whole script in DBeaver (it adds the column too, if missing).
--   2. Then deploy the service (Flyway V360 becomes a no-op via IF NOT EXISTS).
-- (New rows created after deploy get engaged_ms populated live by the app.)
--
-- TIP: DBeaver -> switch to Manual commit mode, run, eyeball the verification
--      block at the bottom, then COMMIT (or ROLLBACK to abort).
-- =============================================================================

-- Self-contained: harmless if the column already exists (Flyway V360).
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS engaged_ms BIGINT;

-- ---- PRE-CHECK (optional; read-only) ----------------------------------------
-- SELECT
--   count(*) FILTER (WHERE start_time < TIMESTAMP '2023-01-01')      AS epoch_start_rows,
--   count(*) FILTER (WHERE end_time < start_time)                    AS negative_rows,
--   count(*) FILTER (WHERE engaged_ms IS NULL)                       AS not_yet_backfilled
-- FROM activity_log;

-- ---- 1. Bug 2: repair epoch/pre-2023 start_time to the reliable server time --
UPDATE activity_log
SET start_time = LEAST(created_at, end_time)
WHERE start_time < TIMESTAMP '2023-01-01' AND end_time IS NOT NULL;

UPDATE activity_log
SET start_time = created_at
WHERE start_time < TIMESTAMP '2023-01-01' AND end_time IS NULL;

-- ---- 2. Bug 4: clamp negative-duration rows (end_time < start_time) ----------
UPDATE activity_log
SET end_time = start_time
WHERE end_time IS NOT NULL AND start_time IS NOT NULL AND end_time < start_time;

-- ---- 3. Baseline engaged_ms = clamped wall-clock window ----------------------
-- Correct for interactive slides and the ~0.1% of passive rows with no breadcrumbs.
-- Passive rows are overwritten with the merged value in step 4.
-- LEAST(..., 86400000) = 24h per-activity ceiling (matches the old query cap).
UPDATE activity_log
SET engaged_ms = LEAST(86400000, GREATEST(0, (EXTRACT(EPOCH FROM (end_time - start_time)) * 1000)))::bigint
WHERE end_time IS NOT NULL AND start_time IS NOT NULL;

-- ---- 4. Bug 1: overwrite passive-media rows with the MERGED breadcrumb time --
-- Gaps-and-islands interval union over document/video/audio segments.
-- Turns a "tab left open 17h" row into the real ~12 min of engagement.
WITH segs AS (
    SELECT activity_id, start_time AS s, end_time AS e FROM document_tracked WHERE end_time >= start_time
    UNION ALL
    SELECT activity_id, start_time AS s, end_time AS e FROM video_tracked    WHERE end_time >= start_time
    UNION ALL
    SELECT activity_id, start_time AS s, end_time AS e FROM audio_tracked    WHERE end_time >= start_time
),
ordered AS (
    SELECT activity_id, s, e,
           MAX(e) OVER (PARTITION BY activity_id ORDER BY s, e
                        ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING) AS prev_max_e
    FROM segs
),
islands AS (
    SELECT activity_id, s, e,
           SUM(CASE WHEN prev_max_e IS NULL OR s > prev_max_e THEN 1 ELSE 0 END)
               OVER (PARTITION BY activity_id ORDER BY s, e) AS island
    FROM ordered
),
merged AS (
    SELECT activity_id, island, MIN(s) AS island_start, MAX(e) AS island_end
    FROM islands
    GROUP BY activity_id, island
),
engaged AS (
    SELECT activity_id,
           SUM(EXTRACT(EPOCH FROM (island_end - island_start)) * 1000)::bigint AS ms
    FROM merged
    GROUP BY activity_id
)
UPDATE activity_log a
SET engaged_ms = LEAST(86400000, engaged.ms)
FROM engaged
WHERE a.id = engaged.activity_id;

-- ---- VERIFY (read-only; expect no absurd hours, no NULLs) --------------------
-- SELECT
--   round((max(engaged_ms)/3600000.0)::numeric,1) AS max_hours,      -- should be < ~24
--   count(*) FILTER (WHERE engaged_ms IS NULL)     AS still_null,     -- should be 0 (rows with times)
--   round((sum(engaged_ms)/3600000.0)::numeric,0)  AS total_hours     -- sane platform total
-- FROM activity_log;
