-- Migration for AI Generated Video tracking table
-- This table tracks the generation progress and files for AI-generated videos
-- Used by ai-service to manage video generation lifecycle

CREATE TABLE IF NOT EXISTS ai_gen_video (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    video_id VARCHAR(255) NOT NULL UNIQUE,
    
    -- Current stage of video generation
    current_stage VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    -- Possible values: PENDING, SCRIPT, TTS, WORDS, HTML, RENDER, COMPLETED, FAILED
    
    -- Status of the generation process
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING',
    -- Possible values: PENDING, IN_PROGRESS, COMPLETED, FAILED
    
    -- JSON object storing file IDs for each stage
    -- Example: {"script": "file-uuid-1", "audio": "file-uuid-2", "timeline": "file-uuid-3", "words": "file-uuid-4", "video": "file-uuid-5"}
    file_ids JSONB DEFAULT '{}'::jsonb,
    
    -- JSON object storing S3 URLs for each stage
    -- Example: {"script": "https://s3.../script.txt", "audio": "https://s3.../audio.mp3", ...}
    s3_urls JSONB DEFAULT '{}'::jsonb,
    
    -- Original prompt/input for video generation
    prompt TEXT,
    
    -- Language for video generation (e.g., English, Hindi, Spanish)
    language VARCHAR(50) DEFAULT 'English',
    
    -- Error message if generation failed
    error_message TEXT,
    
    -- Additional metadata (can store generation options, resolution, etc.)
    metadata JSONB DEFAULT '{}'::jsonb,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP WITH TIME ZONE
);

-- Index for faster lookups by video_id
CREATE INDEX IF NOT EXISTS idx_ai_gen_video_video_id ON ai_gen_video(video_id);

-- Index for filtering by status
CREATE INDEX IF NOT EXISTS idx_ai_gen_video_status ON ai_gen_video(status);

-- Index for filtering by current_stage
CREATE INDEX IF NOT EXISTS idx_ai_gen_video_current_stage ON ai_gen_video(current_stage);

-- Index for timestamp-based queries
CREATE INDEX IF NOT EXISTS idx_ai_gen_video_created_at ON ai_gen_video(created_at);

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_ai_gen_video_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_ai_gen_video_updated_at
    BEFORE UPDATE ON ai_gen_video
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_gen_video_updated_at();

-- Comments for documentation
COMMENT ON TABLE ai_gen_video IS 'Tracks AI-generated video creation progress and associated files';
COMMENT ON COLUMN ai_gen_video.video_id IS 'Unique identifier for the generated video';
COMMENT ON COLUMN ai_gen_video.current_stage IS 'Current stage of generation: PENDING, SCRIPT, TTS, WORDS, HTML, RENDER, COMPLETED, FAILED';
COMMENT ON COLUMN ai_gen_video.status IS 'Overall status: PENDING, IN_PROGRESS, COMPLETED, FAILED';
COMMENT ON COLUMN ai_gen_video.file_ids IS 'JSON mapping of stage names to file IDs stored in system';
COMMENT ON COLUMN ai_gen_video.s3_urls IS 'JSON mapping of stage names to S3 public URLs';
COMMENT ON COLUMN ai_gen_video.prompt IS 'Original text prompt used to generate the video';
COMMENT ON COLUMN ai_gen_video.language IS 'Language for video narration and content';
COMMENT ON COLUMN ai_gen_video.error_message IS 'Error details if generation failed';
COMMENT ON COLUMN ai_gen_video.metadata IS 'Additional configuration and generation metadata';

