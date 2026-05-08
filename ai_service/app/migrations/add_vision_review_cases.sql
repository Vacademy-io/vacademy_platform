-- Migration: Vision review case bank
-- Description: One row per shot whose generated HTML was flagged by the
--              vision reviewer (or its corrective regen). Used for prompt-tuning
--              analysis — engineers query top issue codes to identify systemic
--              defect patterns and update base prompts accordingly.
-- Date: 2026-05-08
-- Backward compatible: Yes (additive table)

CREATE TABLE IF NOT EXISTS vision_review_cases (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),

    -- Locator (which video, which shot)
    video_id        VARCHAR(64) NOT NULL,
    shot_idx        INTEGER NOT NULL,
    shot_type       VARCHAR(64),
    quality_tier    VARCHAR(32) NOT NULL,
    prompt_version  VARCHAR(32),                 -- Reviewer rubric version (bump on prompt edits)

    -- Reviewer outcome
    issue_codes     TEXT[] NOT NULL,             -- e.g. {LEGIBILITY,PALETTE} — fast filter
    severity_max    INTEGER NOT NULL,            -- 0..3
    shipped         VARCHAR(16) NOT NULL,        -- 'first_try' | 'regen' | 'ship_original'

    -- Before / after artifacts (S3 URLs; HTML is large so we link, not inline)
    original_html_url      TEXT,
    regen_html_url         TEXT,
    screenshots_pre_urls   TEXT[],               -- 1..3 PNG URLs at early/mid/exit pre-regen
    screenshots_post_urls  TEXT[],               -- nullable when no regen fired

    -- Reviewer raw output (full issues array, descriptions, suggestions)
    reviewer_pre_json      JSONB NOT NULL,
    reviewer_post_json     JSONB,

    -- Cost / latency
    review_ms              INTEGER,
    review_cost_usd        NUMERIC(10, 6),
    regen_ms               INTEGER,
    regen_cost_usd         NUMERIC(10, 6),

    -- Context for analysis (denormalized so a single row is self-contained)
    shot_meta              JSONB,                -- shot dict from Director (narration excerpt, sync_points, ...)
    shot_pack              JSONB,                -- design tokens active for this shot
    host_present           BOOLEAN NOT NULL DEFAULT FALSE,

    created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for the analysis queries spec'd in the plan:
-- (1) "show last week's defects for this video" → idx_vrc_video_id + idx_vrc_created_at
-- (2) "top issue codes by shot_type" → idx_vrc_shot_type + GIN(issue_codes)
-- (3) "worst tier × shot_type combos by sev-3 rate" → idx_vrc_quality_tier + idx_vrc_severity_max
CREATE INDEX IF NOT EXISTS idx_vrc_video_id        ON vision_review_cases (video_id);
CREATE INDEX IF NOT EXISTS idx_vrc_quality_tier    ON vision_review_cases (quality_tier);
CREATE INDEX IF NOT EXISTS idx_vrc_shot_type       ON vision_review_cases (shot_type);
CREATE INDEX IF NOT EXISTS idx_vrc_severity_max    ON vision_review_cases (severity_max);
CREATE INDEX IF NOT EXISTS idx_vrc_issue_codes_gin ON vision_review_cases USING GIN (issue_codes);
CREATE INDEX IF NOT EXISTS idx_vrc_created_at      ON vision_review_cases (created_at);

COMMENT ON TABLE  vision_review_cases               IS 'One row per shot flagged by the vision reviewer. Drives manual prompt-tuning review.';
COMMENT ON COLUMN vision_review_cases.prompt_version IS 'Frozen reviewer rubric version. Bump on every prompt edit so rows are comparable across time.';
COMMENT ON COLUMN vision_review_cases.shipped       IS 'first_try (regen not fired), regen (regen succeeded), ship_original (regen worse — reverted to original).';
COMMENT ON COLUMN vision_review_cases.severity_max  IS 'Max severity across all issues: 0=clean, 1=minor, 2=notable, 3=blocking.';
