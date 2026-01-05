-- Migration for AI API Keys table
-- This table stores institute-level and user-level API keys for AI services
-- Used by ai-service to manage API keys with hierarchical resolution

CREATE TABLE IF NOT EXISTS ai_api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Entity identification (mutually exclusive)
    institute_id UUID NULL,
    user_id UUID NULL,
    
    -- API Keys (should be encrypted in production)
    openai_key TEXT NULL,
    gemini_key TEXT NULL,
    
    -- Default model preference
    default_model VARCHAR(255) NULL,
    
    -- Metadata
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    notes TEXT NULL,
    
    -- Timestamps
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_by UUID NULL,
    
    -- Constraints
    CONSTRAINT chk_entity_type CHECK (
        (institute_id IS NOT NULL AND user_id IS NULL) OR
        (institute_id IS NULL AND user_id IS NOT NULL)
    )
);

-- Indexes for efficient lookups
CREATE INDEX IF NOT EXISTS idx_ai_api_keys_institute_id_lookup 
    ON ai_api_keys(institute_id, is_active) 
    WHERE is_active = TRUE AND user_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_ai_api_keys_user_id_lookup 
    ON ai_api_keys(user_id, is_active) 
    WHERE is_active = TRUE;

CREATE INDEX IF NOT EXISTS idx_ai_api_keys_created_at 
    ON ai_api_keys(created_at);

-- Trigger for updated_at
CREATE OR REPLACE FUNCTION update_ai_api_keys_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_ai_api_keys_updated_at
    BEFORE UPDATE ON ai_api_keys
    FOR EACH ROW
    EXECUTE FUNCTION update_ai_api_keys_updated_at();

-- Comments for documentation
COMMENT ON TABLE ai_api_keys IS 'Stores API keys for AI services at institute or user level';
COMMENT ON COLUMN ai_api_keys.institute_id IS 'Institute UUID (mutually exclusive with user_id)';
COMMENT ON COLUMN ai_api_keys.user_id IS 'User UUID (mutually exclusive with institute_id)';
COMMENT ON COLUMN ai_api_keys.openai_key IS 'OpenAI/OpenRouter API key';
COMMENT ON COLUMN ai_api_keys.gemini_key IS 'Google Gemini API key';
COMMENT ON COLUMN ai_api_keys.default_model IS 'Default LLM model preference';
COMMENT ON COLUMN ai_api_keys.is_active IS 'Whether the keys are active (soft delete flag)';



