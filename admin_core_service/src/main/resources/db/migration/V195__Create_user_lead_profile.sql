-- V195: Create user_lead_profile table for Option B lead tracking architecture.
-- Aggregates best lead score across all campaigns for a given user.
-- Also adds user_id index on lead_score for faster profile rebuild queries.

CREATE TABLE IF NOT EXISTS user_lead_profile (
    id                      TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id                 TEXT NOT NULL UNIQUE,
    institute_id            TEXT NOT NULL,

    -- Best score across all campaigns this user has participated in
    best_score              INTEGER NOT NULL DEFAULT 0,
    best_score_response_id  TEXT,           -- audience_response.id that gave best_score
    lead_tier               VARCHAR(10),    -- HOT / WARM / COLD derived from best_score

    -- Conversion lifecycle
    conversion_status       VARCHAR(20) NOT NULL DEFAULT 'LEAD',  -- LEAD | CONVERTED | LOST
    converted_at            TIMESTAMP,

    -- Campaign aggregates
    campaign_count          INTEGER NOT NULL DEFAULT 0,
    best_source_type        TEXT,

    -- Timeline engagement
    total_timeline_events   INTEGER NOT NULL DEFAULT 0,

    -- Demo class activity signals
    demo_login_count        INTEGER NOT NULL DEFAULT 0,
    demo_attendance_count   INTEGER NOT NULL DEFAULT 0,

    last_activity_at        TIMESTAMP,
    last_calculated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at              TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_lead_profile_institute
    ON user_lead_profile (institute_id);

CREATE INDEX IF NOT EXISTS idx_user_lead_profile_tier
    ON user_lead_profile (institute_id, lead_tier);

CREATE INDEX IF NOT EXISTS idx_user_lead_profile_status
    ON user_lead_profile (institute_id, conversion_status);

-- Allow lead_score lookups by user_id for profile rebuild (via audience_response join)
-- The join path: user_lead_profile.user_id → audience_response.user_id → lead_score.audience_response_id
-- No new column needed on lead_score; the join is done in service layer.
