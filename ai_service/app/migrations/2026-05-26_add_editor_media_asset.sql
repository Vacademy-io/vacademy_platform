-- Migration: Create editor_media_asset table for the AI video editor's
--            saved media library (media picker).
-- Description: Per-institute reusable image/video assets — uploaded, AI-
--              generated, or stock (Pexels/Pixabay) re-hosted to our S3.
--              Auto-populated on insert via the editor media picker so the
--              Library tab surfaces recently-used media.
-- Date: 2026-05-26
-- Depends on: ai_gen_video (Base / pgcrypto extension)

BEGIN;

-- Required for gen_random_uuid(). No-op if already enabled in the target DB.
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS editor_media_asset (
    id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id        TEXT NOT NULL,
    created_by_user_id  TEXT,

    url                 TEXT NOT NULL,
    thumb_url           TEXT,

    kind                VARCHAR(16) NOT NULL,
    source              VARCHAR(16) NOT NULL,

    prompt              TEXT,
    source_url          TEXT,
    photographer        TEXT,

    width               INTEGER,
    height              INTEGER,
    duration            DOUBLE PRECISION,

    tags                JSONB NOT NULL DEFAULT '[]'::jsonb,
    metadata            JSONB NOT NULL DEFAULT '{}'::jsonb,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT editor_media_asset_kind_chk   CHECK (kind IN ('image', 'video')),
    CONSTRAINT editor_media_asset_source_chk CHECK (source IN ('upload', 'pexels', 'pixabay', 'ai'))
);

CREATE INDEX IF NOT EXISTS idx_ema_institute ON editor_media_asset (institute_id);
CREATE INDEX IF NOT EXISTS idx_ema_institute_kind_created
    ON editor_media_asset (institute_id, kind, created_at DESC);

COMMENT ON TABLE editor_media_asset IS
    'Per-institute saved media library for the AI video editor media picker.';

COMMIT;
