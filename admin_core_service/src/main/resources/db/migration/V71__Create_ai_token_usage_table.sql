-- Migration for AI Token Usage table
-- This table tracks token usage for AI API calls (OpenAI/OpenRouter and Gemini)
-- Used by ai-service for usage tracking, billing, and monitoring

CREATE TABLE IF NOT EXISTS ai_token_usage (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Entity identification (optional, for tracking usage per institute/user)
    institute_id UUID NULL,
    user_id UUID NULL,
    
    -- API provider and model information
    api_provider VARCHAR(50) NOT NULL CHECK (api_provider IN ('openai', 'gemini')),
    model VARCHAR(255) NULL,
    
    -- Token usage metrics
    prompt_tokens INTEGER NOT NULL DEFAULT 0,
    completion_tokens INTEGER NOT NULL DEFAULT 0,
    total_tokens INTEGER NOT NULL DEFAULT 0,
    
    -- Request context
    request_type VARCHAR(50) NOT NULL CHECK (request_type IN ('outline', 'image', 'content', 'video')),
    request_id VARCHAR(255) NULL,
    
    -- Additional metadata
    metadata TEXT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_ai_token_usage_institute_created 
    ON ai_token_usage(institute_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_user_created 
    ON ai_token_usage(user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_provider_created 
    ON ai_token_usage(api_provider, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_type_created 
    ON ai_token_usage(request_type, created_at);

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_total_tokens 
    ON ai_token_usage(total_tokens);

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_request_id 
    ON ai_token_usage(request_id) 
    WHERE request_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ai_token_usage_created_at 
    ON ai_token_usage(created_at);

-- Comments for documentation
COMMENT ON TABLE ai_token_usage IS 'Tracks token usage for AI API calls for billing and monitoring';
COMMENT ON COLUMN ai_token_usage.institute_id IS 'Institute UUID (optional, for per-institute tracking)';
COMMENT ON COLUMN ai_token_usage.user_id IS 'User UUID (optional, for per-user tracking)';
COMMENT ON COLUMN ai_token_usage.api_provider IS 'API provider: openai or gemini';
COMMENT ON COLUMN ai_token_usage.model IS 'Model identifier used for the API call';
COMMENT ON COLUMN ai_token_usage.prompt_tokens IS 'Number of tokens in the prompt';
COMMENT ON COLUMN ai_token_usage.completion_tokens IS 'Number of tokens in the completion';
COMMENT ON COLUMN ai_token_usage.total_tokens IS 'Total tokens used (prompt + completion)';
COMMENT ON COLUMN ai_token_usage.request_type IS 'Type of request: outline, image, content, or video';
COMMENT ON COLUMN ai_token_usage.request_id IS 'Optional request identifier for correlation';



