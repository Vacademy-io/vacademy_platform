-- ============================================================
-- V270: Add schedule_pattern to counselor_pool
--
-- Distinguishes how the admin authored the pool's TIME_BASED
-- weekly schedule, so the UI can render the right editor when
-- the pool is reopened:
--
--   PER_DAY              — admin authored shifts independently per day
--                          (current behaviour; default for pre-existing pools)
--   SAME_HOURS_ALL_DAYS  — admin authored one set of blocks that applies
--                          to all 7 days; on save the frontend expands them
--                          to 7-day rows so the routing engine stays unchanged
--
-- Routing engine and shift validation read flat counselor_pool_shift rows
-- and remain unaffected.
--
-- The column is nullable so the UI can distinguish "admin hasn't explicitly
-- picked a pattern yet" (NULL) from "admin picked X" (PER_DAY|SAME_HOURS_ALL_DAYS).
-- That lets the empty-state chooser appear for fresh TIME_BASED pools, and
-- legacy data (pre-migration shifts) gracefully falls back to PER_DAY on the UI.
-- ============================================================

ALTER TABLE counselor_pool
    ADD COLUMN IF NOT EXISTS schedule_pattern VARCHAR(50);
