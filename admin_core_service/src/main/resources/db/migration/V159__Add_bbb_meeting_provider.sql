-- Add BBB (BigBlueButton) as a Vacademy-level video platform provider.
-- institute_id is NULL because BBB is shared across all institutes.

-- 1. Allow institute_id to be NULL (for platform-wide providers like BBB)
ALTER TABLE institute_live_session_provider_mapping
    ALTER COLUMN institute_id DROP NOT NULL;

-- 2. Drop the existing unique constraint and recreate with COALESCE
--    so that NULL institute_id rows can coexist with non-NULL ones
ALTER TABLE institute_live_session_provider_mapping
    DROP CONSTRAINT IF EXISTS uq_institute_live_session_provider;

CREATE UNIQUE INDEX IF NOT EXISTS uq_institute_live_session_provider
    ON institute_live_session_provider_mapping (COALESCE(institute_id, '__PLATFORM__'), provider);

-- 3. Insert the BBB config row (only if one doesn't already exist)
INSERT INTO institute_live_session_provider_mapping (id, institute_id, provider, config_json, status, created_at)
SELECT gen_random_uuid(), NULL, 'BBB_MEETING',
       '{"apiUrl":"https://meet.vacademy.io/bigbluebutton/api","secret":"8VhLHf3B2ouubT3nTJlUzD6m69oa8hC32GdWdpuvDU"}',
       'ACTIVE', NOW()
WHERE NOT EXISTS (
    SELECT 1 FROM institute_live_session_provider_mapping
    WHERE provider = 'BBB_MEETING' AND institute_id IS NULL
);
