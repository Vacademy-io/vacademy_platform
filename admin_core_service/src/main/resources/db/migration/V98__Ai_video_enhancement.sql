-- Migration: Add content_type column to ai_gen_video table
-- Description: Supports multiple content types (VIDEO, QUIZ, STORYBOOK, etc.)
-- Date: 2026-02-02
-- Backward compatible: Yes (defaults to VIDEO)

-- Add content_type column with default value 'VIDEO' for backward compatibility
ALTER TABLE ai_gen_video 
ADD COLUMN IF NOT EXISTS content_type VARCHAR(50) NOT NULL DEFAULT 'VIDEO';

-- Add index for efficient queries by content type
CREATE INDEX IF NOT EXISTS idx_ai_gen_video_content_type 
ON ai_gen_video(content_type);

-- Update any existing NULL values to 'VIDEO' (safety measure)
UPDATE ai_gen_video 
SET content_type = 'VIDEO' 
WHERE content_type IS NULL;

-- Add comment for documentation
COMMENT ON COLUMN ai_gen_video.content_type IS 'Content type for multi-format support: VIDEO, QUIZ, STORYBOOK, INTERACTIVE_GAME, PUZZLE_BOOK, SIMULATION, FLASHCARDS, MAP_EXPLORATION';
