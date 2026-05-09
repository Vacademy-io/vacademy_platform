-- Migration: Rename ai_input_videos to ai_input_assets and generalize for images
-- Description: Polymorphic asset table supporting both videos and images.
--              Videos keep their existing columns; images add width/height and
--              image_metadata_url alongside the existing context/spatial URLs.
-- Date: 2026-05-08
-- Backward compatible: Existing rows get kind='video'. Old columns retained.

BEGIN;

-- 1. Rename the table.
ALTER TABLE IF EXISTS ai_input_videos RENAME TO ai_input_assets;

-- 2. Rename existing institute index to match new table name (if it exists).
ALTER INDEX IF EXISTS idx_aiv_institute RENAME TO idx_aia_institute;
ALTER INDEX IF EXISTS idx_aiv_status    RENAME TO idx_aia_status;

-- 3. Add `kind` discriminator. Default 'video' so existing rows backfill cleanly.
ALTER TABLE ai_input_assets
  ADD COLUMN IF NOT EXISTS kind VARCHAR(16) NOT NULL DEFAULT 'video';

-- Drop the default once backfilled — new inserts must specify kind explicitly.
ALTER TABLE ai_input_assets ALTER COLUMN kind DROP DEFAULT;

-- 4. Image-specific columns (nullable; videos leave them NULL).
ALTER TABLE ai_input_assets ADD COLUMN IF NOT EXISTS width  INTEGER;
ALTER TABLE ai_input_assets ADD COLUMN IF NOT EXISTS height INTEGER;
ALTER TABLE ai_input_assets ADD COLUMN IF NOT EXISTS image_metadata_url TEXT;

-- 5. Constraints.
--    `kind` ∈ ('video', 'image').
--    `mode` ∈ {video modes} ∪ {image modes} — gated by kind in the app layer too.
ALTER TABLE ai_input_assets
  DROP CONSTRAINT IF EXISTS ai_input_assets_kind_check;
ALTER TABLE ai_input_assets
  ADD CONSTRAINT ai_input_assets_kind_check
  CHECK (kind IN ('video', 'image'));

ALTER TABLE ai_input_assets
  DROP CONSTRAINT IF EXISTS ai_input_assets_mode_check;
-- NOT VALID: skip validation of existing rows. Defensive — if any pre-existing
-- row has a non-canonical mode (case mismatch, legacy value), we don't want
-- the migration to abort. New inserts are fully validated.
ALTER TABLE ai_input_assets
  ADD CONSTRAINT ai_input_assets_mode_check
  CHECK (mode IN ('podcast', 'demo', 'photo', 'screenshot', 'diagram'))
  NOT VALID;

-- 6. Index for the most common list query: institute + kind, newest first.
CREATE INDEX IF NOT EXISTS idx_aia_institute_kind_created
  ON ai_input_assets (institute_id, kind, created_at DESC);

-- 7. Comments for documentation.
COMMENT ON TABLE  ai_input_assets             IS 'AI-indexed institute assets (videos and images). Each row tracks one upload through the indexing pipeline.';
COMMENT ON COLUMN ai_input_assets.kind        IS 'Asset kind: video | image. Determines which extractor pipeline runs and which output URLs are populated.';
COMMENT ON COLUMN ai_input_assets.mode        IS 'Sub-mode within kind. Video: podcast | demo. Image: photo | screenshot | diagram.';
COMMENT ON COLUMN ai_input_assets.width       IS 'Pixel width. Populated for images; videos use resolution string.';
COMMENT ON COLUMN ai_input_assets.height      IS 'Pixel height. Populated for images; videos use resolution string.';
COMMENT ON COLUMN ai_input_assets.image_metadata_url IS 'S3 URL to image_metadata.json (image kind only). Mirrors context_json_url for videos.';

COMMIT;
