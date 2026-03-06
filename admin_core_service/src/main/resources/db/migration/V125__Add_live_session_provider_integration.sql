-- V123: Add live session provider integration tables and extend existing tables

-- ============================================================
-- 1. institute_live_session_provider_mapping
--    Generic mapping: institute ↔ meeting provider.
--    Mirrors institute_payment_gateway_mapping structure exactly.
--    All provider credentials stored in config_json (TEXT).
--
--    Zoho config_json example:
--    {
--      "clientId": "...", "clientSecret": "...",
--      "accessToken": "...", "refreshToken": "...",
--      "tokenExpiresAt": 1234567890,
--      "zohoUserId": "12345678", "domain": "zoho.com"
--    }
-- ============================================================
CREATE TABLE IF NOT EXISTS institute_live_session_provider_mapping (
    id            VARCHAR(36) PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id  VARCHAR(36) NOT NULL,
    provider      VARCHAR(50) NOT NULL,
    config_json   TEXT        NOT NULL,
    status        VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP   NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_institute_live_session_provider UNIQUE (institute_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_ilspm_institute_id ON institute_live_session_provider_mapping (institute_id);
CREATE INDEX IF NOT EXISTS idx_ilspm_provider     ON institute_live_session_provider_mapping (provider);

-- ============================================================
-- 2. Extend session_schedules
--    Add provider meeting fields directly — no second table needed.
--    The schedule IS the per-occurrence record, so provider meeting
--    data naturally belongs here alongside custom_meeting_link & link_type.
--
--    provider_meeting_id      — Zoho meetingKey (used by scheduler to query API)
--    provider_host_url        — Presenter-only URL from the provider
--    provider_recordings_json — Cached JSON array of MeetingRecordingDTO
--    last_attendance_sync_at  — Timestamp of last Zoho attendance pull
--    last_recording_sync_at   — Timestamp of last Zoho recording pull
-- ============================================================
ALTER TABLE session_schedules
    ADD COLUMN IF NOT EXISTS provider_meeting_id       VARCHAR(255),
    ADD COLUMN IF NOT EXISTS provider_host_url         TEXT,
    ADD COLUMN IF NOT EXISTS provider_recordings_json  TEXT,
    ADD COLUMN IF NOT EXISTS last_attendance_sync_at   TIMESTAMP,
    ADD COLUMN IF NOT EXISTS last_recording_sync_at    TIMESTAMP;

-- ============================================================
-- 3. Extend live_session_logs
--    provider_join_time           — ISO-8601 when attendee joined (from provider)
--    provider_total_duration_minutes — total minutes in the meeting
-- ============================================================
ALTER TABLE live_session_logs
    ADD COLUMN IF NOT EXISTS provider_join_time              VARCHAR(50),
    ADD COLUMN IF NOT EXISTS provider_total_duration_minutes INTEGER;
