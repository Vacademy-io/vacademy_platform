-- Migration: Create ai_video_casts — saved storybook/drama casts (characters
--            with verbatim portraits, reference sheet URLs, and voice mapping)
--            so a series of videos reuses the same faces + voices.
-- Date: 2026-07-03
-- Note: the app also ensures this schema at startup (ensure_ai_video_cast_schema);
--       this file is the external-migration mirror.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ai_video_casts (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id    TEXT NOT NULL,
    name            VARCHAR(120) NOT NULL,
    characters      JSONB NOT NULL DEFAULT '[]'::jsonb,
    source_video_id VARCHAR(255),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_video_casts_institute ON ai_video_casts (institute_id);

COMMIT;
