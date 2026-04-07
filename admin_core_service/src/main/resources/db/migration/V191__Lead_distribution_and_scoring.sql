-- ============================================================
-- V191: Lead Distribution Engine + Lead Scoring + Deduplication + Notes Enhancement
-- Part of Phase 1: Centralized Lead Management & Dynamic Distribution
-- ============================================================

-- 1. Lead Assignment Counter (round-robin state tracking)
CREATE TABLE IF NOT EXISTS lead_assignment_counter (
    id              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    scope_type      VARCHAR(50) NOT NULL,       -- 'AUDIENCE' or 'INSTITUTE'
    scope_id        TEXT NOT NULL,               -- audience_id or institute_id
    last_index      INTEGER NOT NULL DEFAULT 0,  -- last assigned position in pool
    created_at      TIMESTAMP DEFAULT NOW(),
    updated_at      TIMESTAMP DEFAULT NOW(),
    UNIQUE(scope_type, scope_id)
);

-- 2. Lead Score (per audience response)
CREATE TABLE IF NOT EXISTS lead_score (
    id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    audience_response_id TEXT NOT NULL UNIQUE,
    audience_id          TEXT NOT NULL,
    institute_id         TEXT NOT NULL,
    raw_score            INTEGER NOT NULL DEFAULT 0,
    percentile_rank      DECIMAL(5,2) DEFAULT 50.0,
    scoring_factors_json TEXT,
    last_calculated_at   TIMESTAMP NOT NULL DEFAULT NOW(),
    created_at           TIMESTAMP DEFAULT NOW(),
    updated_at           TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lead_score_audience ON lead_score(audience_id, raw_score);
CREATE INDEX IF NOT EXISTS idx_lead_score_response ON lead_score(audience_response_id);

-- 3. Add deduplication columns to audience_response
ALTER TABLE audience_response ADD COLUMN IF NOT EXISTS dedupe_key VARCHAR(64);
ALTER TABLE audience_response ADD COLUMN IF NOT EXISTS is_duplicate BOOLEAN DEFAULT false;
ALTER TABLE audience_response ADD COLUMN IF NOT EXISTS primary_response_id TEXT;

CREATE INDEX IF NOT EXISTS idx_ar_dedupe ON audience_response(audience_id, dedupe_key) WHERE dedupe_key IS NOT NULL;

-- 4. Add notes enhancement columns to timeline_event
ALTER TABLE timeline_event ADD COLUMN IF NOT EXISTS is_pinned BOOLEAN DEFAULT false;
ALTER TABLE timeline_event ADD COLUMN IF NOT EXISTS student_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_timeline_student ON timeline_event(student_user_id) WHERE student_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_timeline_pinned ON timeline_event(type, type_id, is_pinned) WHERE is_pinned = true;
