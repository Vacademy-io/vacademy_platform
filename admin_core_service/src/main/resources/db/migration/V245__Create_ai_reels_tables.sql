-- Migration: Create ai_reels + ai_reel_candidates tables for the
--            reels-from-long-video pipeline.
-- Description: ai_reels is the sibling of ai_gen_video for short-form
--              clips derived from an indexed source video. ai_reel_candidates
--              is the TTL'd Gate-1 scan output that /preview enriches and
--              /render consumes.
-- Date: 2026-05-11
-- Depends on: rename_input_videos_to_input_assets.sql (ai_input_assets must exist)

BEGIN;

-- Required for gen_random_uuid(). No-op if already enabled in the target DB.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ===========================================================================
-- ai_reels — one row per rendered short clip
-- ===========================================================================

CREATE TABLE IF NOT EXISTS ai_reels (
    id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    reel_id              VARCHAR(255) NOT NULL UNIQUE,
    institute_id         TEXT NOT NULL,
    input_asset_id       UUID NOT NULL,
    parent_candidate_id  UUID,

    status               VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    current_stage        VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    progress             INTEGER NOT NULL DEFAULT 0,
    error_message        TEXT,

    config               JSONB NOT NULL DEFAULT '{}'::jsonb,
    source_window        JSONB NOT NULL DEFAULT '{}'::jsonb,
    trim_map             JSONB,
    stages               JSONB NOT NULL DEFAULT '[]'::jsonb,

    s3_urls              JSONB NOT NULL DEFAULT '{}'::jsonb,
    metadata             JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_by_user_id   TEXT,
    created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    completed_at         TIMESTAMPTZ,

    CONSTRAINT ai_reels_status_check
        CHECK (status IN ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'FAILED')),
    CONSTRAINT ai_reels_progress_range
        CHECK (progress >= 0 AND progress <= 100)
);

CREATE INDEX IF NOT EXISTS idx_ar_institute            ON ai_reels (institute_id);
CREATE INDEX IF NOT EXISTS idx_ar_input_asset          ON ai_reels (input_asset_id);
CREATE INDEX IF NOT EXISTS idx_ar_status               ON ai_reels (status);
CREATE INDEX IF NOT EXISTS idx_ar_institute_created    ON ai_reels (institute_id, created_at DESC);

COMMENT ON TABLE  ai_reels                IS 'AI-generated short-form reels derived from indexed input videos.';
COMMENT ON COLUMN ai_reels.input_asset_id IS 'FK to ai_input_assets.id (kind=video, status=COMPLETED at render time).';
COMMENT ON COLUMN ai_reels.parent_candidate_id IS 'FK to ai_reel_candidates.id — which scan candidate produced this reel.';
COMMENT ON COLUMN ai_reels.current_stage  IS 'PENDING | AUDIO_EDIT | SOURCE_CLIP | STYLE_GUIDE | DIRECTOR | HTML | ASSEMBLE | RENDER | COMPLETED | FAILED';
COMMENT ON COLUMN ai_reels.stages         IS 'Per-stage progress array: [{stage, progress}]. Powers stage-by-stage FE status UI (§13.11).';
COMMENT ON COLUMN ai_reels.config         IS 'Full RenderRequest body — audit trail + re-render input.';
COMMENT ON COLUMN ai_reels.source_window  IS '{t_start, t_end, original_duration_s} in source video coords (pre-cut).';
COMMENT ON COLUMN ai_reels.trim_map       IS 'Spans kept after silence + word cuts: [{orig_t_start, orig_t_end, new_t_start, new_t_end}]. NULL until AUDIO_EDIT runs.';
COMMENT ON COLUMN ai_reels.s3_urls        IS 'Output artifact URLs: speaker_clip, speaker_fg, time_based_frame, video, captions.';

-- ===========================================================================
-- ai_reel_candidates — TTL'd Gate-1 scan output, enriched by Gate 2
-- ===========================================================================

CREATE TABLE IF NOT EXISTS ai_reel_candidates (
    id                            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id                  TEXT NOT NULL,
    input_asset_id                UUID NOT NULL,

    -- SHA-256 of (input_asset_id + scan request fields) for /scan idempotency.
    config_hash                   VARCHAR(64) NOT NULL,

    rank                          INTEGER NOT NULL,

    source_t_start                DOUBLE PRECISION NOT NULL,
    source_t_end                  DOUBLE PRECISION NOT NULL,
    source_duration_s             DOUBLE PRECISION NOT NULL,
    predicted_output_duration_s   DOUBLE PRECISION NOT NULL,

    score                         JSONB NOT NULL,
    breakdown                     JSONB NOT NULL DEFAULT '{}'::jsonb,

    transcript_snippet            TEXT NOT NULL,
    thumbnail_strip_url           TEXT,

    -- Populated by Gate 2 (/preview) — null until then.
    -- {title, rationale, word_importance: [...], cut_plan: [...]}
    enriched                      JSONB,

    ttl_at                        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
    created_at                    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    CONSTRAINT ai_reel_candidates_rank_pos CHECK (rank >= 1),
    CONSTRAINT ai_reel_candidates_window
        CHECK (source_t_end > source_t_start AND source_t_start >= 0)
);

-- Cache-hit path during /scan: lookup by (input_asset, config_hash) ordered
-- by rank. UNIQUE so that two concurrent /scan calls with the same config
-- can't double-insert candidates — the second one trips the constraint and
-- the application falls back to find_cached.
CREATE UNIQUE INDEX IF NOT EXISTS idx_arc_lookup
    ON ai_reel_candidates (input_asset_id, config_hash, rank);

-- Reaper job (later phase) selects expired rows by ttl_at.
CREATE INDEX IF NOT EXISTS idx_arc_ttl ON ai_reel_candidates (ttl_at);

COMMENT ON TABLE  ai_reel_candidates              IS 'Gate-1 scan output for reels-from-video; 24h TTL. /preview enriches the row; /render consumes the enriched cut_plan.';
COMMENT ON COLUMN ai_reel_candidates.config_hash  IS 'SHA-256 of (input_asset_id + scan request fields). Idempotency key for /scan cache.';
COMMENT ON COLUMN ai_reel_candidates.enriched     IS 'Gate-2 LLM output: {title, rationale, word_importance, cut_plan}. NULL until /preview runs for this candidate.';

-- ===========================================================================
-- Cross-table FK: ai_reels.parent_candidate_id → ai_reel_candidates.id
-- ===========================================================================
-- Candidates have a 24h TTL; the reaper deletes them. We don't want that to
-- cascade-delete reels (the reel's `config` + `source_window` carry the
-- audit-relevant info from the candidate). Use SET NULL so the reel remains
-- valid; the parent-link just goes null after the candidate is reaped.
ALTER TABLE ai_reels
    DROP CONSTRAINT IF EXISTS ai_reels_parent_candidate_fk;
ALTER TABLE ai_reels
    ADD CONSTRAINT ai_reels_parent_candidate_fk
    FOREIGN KEY (parent_candidate_id)
    REFERENCES ai_reel_candidates(id)
    ON DELETE SET NULL;

COMMIT;
