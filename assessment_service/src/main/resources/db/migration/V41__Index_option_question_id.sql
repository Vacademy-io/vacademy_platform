-- V41: index option.question_id  --  19.6 BILLION rows read via sequential scan.
--
-- Evidence: pg_stat_user_tables over the 18-day window since the stats reset
-- (2026-08-03 -> 2026-08-21). option had exactly one index -- the primary key on
-- id -- while every query that loads a question's answer choices filters on
-- question_id. 165,030 sequential scans reading 19,656,506,672 rows, which works
-- out to 119,108 rows per scan against a 117,405-row table: a full scan every
-- single time.
--
-- The table is 25 MB, so a plain build holds its ACCESS EXCLUSIVE lock for
-- milliseconds. CONCURRENTLY is deliberately not used: it cannot run inside
-- Flyway's transaction.
CREATE INDEX IF NOT EXISTS idx_option_question_id
    ON option (question_id);
