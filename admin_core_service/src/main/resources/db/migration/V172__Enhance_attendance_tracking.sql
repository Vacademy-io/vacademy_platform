-- Add status_type (ONLINE/OFFLINE), engagement_data (JSON), and provider_meeting_id to live_session_logs
ALTER TABLE live_session_logs
    ADD COLUMN IF NOT EXISTS status_type VARCHAR(10) DEFAULT 'ONLINE',
    ADD COLUMN IF NOT EXISTS engagement_data TEXT,
    ADD COLUMN IF NOT EXISTS provider_meeting_id VARCHAR(255);
