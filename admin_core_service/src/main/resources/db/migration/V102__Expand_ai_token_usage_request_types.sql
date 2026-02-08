-- Migration to expand request_type values for AI Token Usage table
-- Adds additional request types to support all AI services across the platform

-- PostgreSQL doesn't support ALTER TYPE ... ADD VALUE in a transaction easily,
-- so we need to drop and recreate the constraint

-- First, drop the existing constraint
ALTER TABLE ai_token_usage DROP CONSTRAINT IF EXISTS ai_token_usage_request_type_check;

-- Add the new constraint with expanded request types
ALTER TABLE ai_token_usage ADD CONSTRAINT ai_token_usage_request_type_check 
    CHECK (request_type IN (
        -- Original types
        'outline',      -- Course outline generation
        'image',        -- Image generation (Gemini)
        'content',      -- Generic content generation
        'video',        -- Video generation pipeline
        
        -- New types for comprehensive logging
        'tts',          -- Text-to-Speech (Google Cloud TTS)
        'embedding',    -- Embedding generation (Gemini)
        'evaluation',   -- Answer evaluation
        'presentation', -- Presentation generation
        'conversation', -- Chat/conversation
        'lecture',      -- Lecture generation
        'course_content', -- Course content generation
        'pdf_questions',  -- PDF to questions processing
        'agent',          -- AI Agent interactions
        'analytics',      -- Student analytics
        'copilot'         -- Instructor copilot
    ));

-- Add tts_provider column to track which TTS provider was used
ALTER TABLE ai_token_usage 
ADD COLUMN IF NOT EXISTS tts_provider VARCHAR(50) NULL;

-- Add character_count column for TTS usage (since TTS charges by character, not token)
ALTER TABLE ai_token_usage 
ADD COLUMN IF NOT EXISTS character_count INTEGER NULL;

-- Comments for new columns
COMMENT ON COLUMN ai_token_usage.tts_provider IS 'TTS provider used: google, edge, elevenlabs';
COMMENT ON COLUMN ai_token_usage.character_count IS 'Character count for TTS requests (TTS is charged by character)';
COMMENT ON COLUMN ai_token_usage.request_type IS 'Type of AI request: outline, image, content, video, tts, embedding, evaluation, presentation, conversation, lecture, course_content, pdf_questions, agent, analytics, copilot';

