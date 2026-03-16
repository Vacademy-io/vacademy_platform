-- V126: Support per-organizer Zoho credentials within an institute.
--
-- Existing rows (vendor_user_id IS NULL) represent the institute-wide
-- fallback credential — used for all organizers that don't have their
-- own personal config.  New rows with a non-null vendor_user_id are
-- scoped to a specific organizer.
--
-- Backward-compatible: no existing row is modified.

-- 1. Add the new column (nullable so existing rows stay valid)
ALTER TABLE institute_live_session_provider_mapping
    ADD COLUMN IF NOT EXISTS vendor_user_id VARCHAR(100);

-- 2. Drop the old single unique constraint (institute_id, provider)
ALTER TABLE institute_live_session_provider_mapping
    DROP CONSTRAINT IF EXISTS uq_institute_live_session_provider;

-- 3a. Replace with a partial unique index for institute-wide rows (vendor_user_id IS NULL)
--     → at most one fallback config per (institute, provider)
CREATE UNIQUE INDEX IF NOT EXISTS uq_ilspm_institute_provider_global
    ON institute_live_session_provider_mapping (institute_id, provider)
    WHERE vendor_user_id IS NULL;

-- 3b. Separate partial unique index for per-organizer rows (vendor_user_id IS NOT NULL)
--     → at most one config per (institute, provider, organizer)
CREATE UNIQUE INDEX IF NOT EXISTS uq_ilspm_institute_provider_vendor
    ON institute_live_session_provider_mapping (institute_id, provider, vendor_user_id)
    WHERE vendor_user_id IS NOT NULL;

-- 4. Index for fast lookup by vendor_user_id
CREATE INDEX IF NOT EXISTS idx_ilspm_vendor_user_id
    ON institute_live_session_provider_mapping (vendor_user_id);
