-- ============================================================
-- V273: Track the FIRST time a lead's user got a status response.
--
-- Why: the "Reach out by" column needs to flip to "✓ Responded in N" the moment the
-- lead's status moves off the default ('LEAD'), regardless of who triggered the change
-- (assigned counselor or institute admin). Until now we derived this from
-- timeline_event by the assigned counselor — that misses status changes made by admins
-- and silently shows leads as unresponded.
--
-- The column is set ONCE — when conversion_status first transitions away from the default
-- 'LEAD' — by all three writers in UserLeadProfileService:
--   updateConversionStatus, markConverted, markConvertedIfExists.
-- The write is guarded by  `if firstResponseAt == null && status != 'LEAD'`  so it never
-- overwrites an existing timestamp (idempotent at the row level).
--
-- Backfill: for rows that have already transitioned before this migration runs we use
-- `updated_at` as the closest historical proxy — it's the LAST update, not the first
-- response, but it's the best signal available for legacy data. New transitions after
-- deployment record the exact moment.
--
-- Safety: ADD COLUMN with no default is an instant metadata-only change in Postgres
-- (no table rewrite, no long lock). The UPDATE writes only the new column and is
-- idempotent — re-runs do nothing because the WHERE filters out already-populated rows.
-- ============================================================

ALTER TABLE user_lead_profile
    ADD COLUMN IF NOT EXISTS first_response_at TIMESTAMP NULL;

-- Backfill: any profile that's already past the default seed status gets the closest
-- historical proxy. New transitions after deployment use NOW() at the exact moment.
UPDATE user_lead_profile
   SET first_response_at = updated_at
 WHERE first_response_at IS NULL
   AND conversion_status IS NOT NULL
   AND conversion_status <> 'LEAD';
