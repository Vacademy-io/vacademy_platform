-- Migration: Add thumbnails JSONB column to ai_gen_video.
-- Description: Stores intent-aware thumbnail options (Seedream-generated) per
--              video, plus the user-selected option id. Vimotion v1 surfaces
--              these in the Recent grid and production view.
-- Date: 2026-05-12
-- Depends on: existing ai_gen_video table.
--
-- Shape:
-- {
--   "selected_id": "thumb_1",
--   "intent": "ad",
--   "orientation": "landscape",
--   "generated_at": 1715520000000,
--   "options": [
--     {
--       "id": "thumb_1",
--       "image_url": "https://.../thumb_1.png",
--       "headline": "Build Faster",
--       "layout": "bottom_band",
--       "subject_focus": "object",
--       "intent_style": "ad"
--     }
--   ]
-- }

BEGIN;

ALTER TABLE ai_gen_video
    ADD COLUMN IF NOT EXISTS thumbnails JSONB NOT NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN ai_gen_video.thumbnails IS
    'Intent-aware thumbnail set: {selected_id, intent, orientation, generated_at, options:[{id, image_url, headline, layout, subject_focus, intent_style}]}. Empty {} until thumbnail stage runs.';

COMMIT;
