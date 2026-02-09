-- ================================================================================
-- V84: AI Models Registry
-- 
-- Centralized model registry for:
-- 1. Model metadata (name, provider, capabilities)
-- 2. Pricing (input/output token costs, credit multiplier)
-- 3. Free tier tracking (easily update when providers change free models)
-- 4. Use case recommendations (which models work best for what)
-- 5. Enables frontend to dynamically fetch available models
-- ================================================================================

-- ================================================================================
-- 1. AI Models Table - Centralized model registry
-- ================================================================================
CREATE TABLE IF NOT EXISTS ai_models (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Model identification
    model_id VARCHAR(100) NOT NULL UNIQUE,           -- e.g., "google/gemini-2.5-flash:free"
    name VARCHAR(200) NOT NULL,                       -- Human-readable name
    provider VARCHAR(50) NOT NULL,                    -- OpenRouter, Google, OpenAI, etc.
    
    -- Categorization
    category VARCHAR(30) NOT NULL DEFAULT 'general', -- general, coding, vision, embedding, image, tts, etc.
    tier VARCHAR(20) NOT NULL DEFAULT 'standard',    -- free, standard, premium, ultra
    
    -- Capabilities
    max_tokens INTEGER,                               -- Max output tokens
    context_window INTEGER,                           -- Total context size
    supports_streaming BOOLEAN DEFAULT TRUE,
    supports_images BOOLEAN DEFAULT FALSE,
    supports_function_calling BOOLEAN DEFAULT FALSE,
    supports_json_mode BOOLEAN DEFAULT FALSE,
    
    -- Pricing (per 1M tokens, in USD)
    input_price_per_1m DECIMAL(10,6) DEFAULT 0,      -- $0 for free models
    output_price_per_1m DECIMAL(10,6) DEFAULT 0,
    
    -- Credit system integration (multiplier for our credit calculations)
    credit_multiplier DECIMAL(4,2) DEFAULT 1.0,      -- 1.0 = standard, 2.0 = premium, etc.
    
    -- Free tier handling
    is_free BOOLEAN DEFAULT FALSE,                    -- Easy toggle for free tier
    free_until TIMESTAMP,                             -- Optional: free tier expiry date
    
    -- Recommendations
    recommended_for TEXT[],                           -- ['content', 'outline', 'evaluation', 'copilot']
    not_recommended_for TEXT[],                       -- Negative recommendations
    quality_score INTEGER DEFAULT 3,                  -- 1-5 quality rating
    speed_score INTEGER DEFAULT 3,                    -- 1-5 speed rating
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,                   -- Can be disabled without deleting
    is_default BOOLEAN DEFAULT FALSE,                 -- Mark one as default
    is_default_free BOOLEAN DEFAULT FALSE,            -- Mark one as default free model
    display_order INTEGER DEFAULT 100,                -- For UI ordering
    
    -- Metadata
    description TEXT,
    notes TEXT,                                        -- Internal notes about the model
    external_docs_url VARCHAR(500),                   -- Link to provider docs
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for common queries
CREATE INDEX IF NOT EXISTS idx_ai_models_provider ON ai_models(provider);
CREATE INDEX IF NOT EXISTS idx_ai_models_tier ON ai_models(tier);
CREATE INDEX IF NOT EXISTS idx_ai_models_category ON ai_models(category);
CREATE INDEX IF NOT EXISTS idx_ai_models_is_free ON ai_models(is_free);
CREATE INDEX IF NOT EXISTS idx_ai_models_is_active ON ai_models(is_active);
CREATE INDEX IF NOT EXISTS idx_ai_models_display_order ON ai_models(display_order);

-- ================================================================================
-- 2. Seed Initial Models Data
-- ================================================================================

-- Free tier models (OpenRouter)
INSERT INTO ai_models (model_id, name, provider, category, tier, is_free, credit_multiplier, 
                       recommended_for, quality_score, speed_score, display_order, description, is_default_free)
VALUES 
    -- 1. mimo-v2-flash (13 columns)
    ('xiaomi/mimo-v2-flash:free', 'MIMO v2 Flash', 'OpenRouter', 'general', 'free', TRUE, 0.0,
     ARRAY['content', 'outline', 'copilot'], 3, 5, 1, 'Fast free model for general tasks', TRUE),
    
    -- 2. devstral-2512 (13 columns)
    ('mistralai/devstral-2512:free', 'Devstral 2512', 'OpenRouter', 'coding', 'free', TRUE, 0.0,
     ARRAY['content', 'copilot'], 3, 4, 2, 'Mistral''s free model, good for coding', FALSE),
     
    -- 3. nemotron-3-nano (13 columns)
    ('nvidia/nemotron-3-nano-30b-a3b:free', 'Nemotron 3 Nano', 'OpenRouter', 'general', 'free', TRUE, 0.0,
     ARRAY['content', 'outline'], 3, 4, 3, 'NVIDIA''s free model', FALSE),
     
    -- 4. gemini-2.0-flash-exp (13 columns)
    ('google/gemini-2.0-flash-exp:free', 'Gemini 2.0 Flash Exp', 'OpenRouter', 'general', 'free', TRUE, 0.0,
     ARRAY['content', 'video', 'image'], 4, 5, 4, 'Google''s experimental flash model - great for video generation', FALSE),
     
    -- 5. trinity-large-preview (13 columns)
    ('arcee-ai/trinity-large-preview:free', 'Trinity Large Preview', 'OpenRouter', 'general', 'free', TRUE, 0.0,
     ARRAY['content', 'outline'], 3, 4, 5, 'Arcee AI''s preview model', FALSE),
     
    -- 6. deepseek-r1t2-chimera (13 columns) - Added closing parentheses and comma appropriately
    ('tngtech/deepseek-r1t2-chimera:free', 'DeepSeek R1T2 Chimera', 'OpenRouter', 'reasoning', 'free', TRUE, 0.0,
     ARRAY['evaluation', 'analytics'], 4, 3, 6, 'DeepSeek reasoning model', FALSE)
     
ON CONFLICT (model_id) DO UPDATE SET
    name = EXCLUDED.name,
    is_free = EXCLUDED.is_free,
    tier = EXCLUDED.tier,
    updated_at = CURRENT_TIMESTAMP;

-- Standard tier models
INSERT INTO ai_models (model_id, name, provider, category, tier, is_free, credit_multiplier,
                       max_tokens, context_window, input_price_per_1m, output_price_per_1m,
                       recommended_for, quality_score, speed_score, display_order, description, is_default_free)
VALUES 
    ('google/gemini-2.5-flash', 'Gemini 2.5 Flash', 'Google', 'general', 'standard', FALSE, 1.0,
     1048576, 1048576, 0.3, 2.5, ARRAY['content', 'outline', 'copilot', 'video'], 4, 5, 10, 
     'Fast Gemini model with great price/performance', FALSE),
     
    ('google/gemini-2.5-flash-lite', 'Gemini 2.5 Flash Lite', 'Google', 'general', 'standard', FALSE, 0.8,
     1048576, 1048576, 0.1, 0.4, ARRAY['content', 'copilot'], 3, 5, 11, 
     'Lightweight Gemini for simple tasks', FALSE),
     
    ('deepseek/deepseek-v3.2', 'DeepSeek V3.2', 'DeepSeek', 'general', 'standard', FALSE, 1.0,
     163840, 163840, 0.25, 0.38, ARRAY['content', 'outline', 'evaluation'], 4, 4, 12, 
     'Great value model with strong reasoning', FALSE),
     
    ('x-ai/grok-code-fast-1', 'Grok Code Fast', 'xAI', 'coding', 'standard', FALSE, 1.0,
     256000, 256000, 0.2, 1.5, ARRAY['copilot', 'content'], 4, 5, 13, 
     'Fast code-focused model', FALSE),
     
    ('openai/gpt-3.5-turbo', 'GPT-3.5 Turbo', 'OpenAI', 'general', 'standard', FALSE, 1.0,
     16384, 16384, 0.5, 1.5, ARRAY['content', 'copilot'], 3, 5, 14, 
     'Fast and cost-effective OpenAI model', FALSE),
     
    ('openai/gpt-4o-mini', 'GPT-4o Mini', 'OpenAI', 'general', 'standard', FALSE, 1.2,
     16384, 128000, 0.15, 0.6, ARRAY['content', 'outline', 'copilot'], 4, 5, 15, 
     'Affordable GPT-4o variant', FALSE)
     
ON CONFLICT (model_id) DO UPDATE SET
    name = EXCLUDED.name,
    input_price_per_1m = EXCLUDED.input_price_per_1m,
    output_price_per_1m = EXCLUDED.output_price_per_1m,
    updated_at = CURRENT_TIMESTAMP;

-- Premium tier models
INSERT INTO ai_models (model_id, name, provider, category, tier, is_free, credit_multiplier,
                       max_tokens, context_window, input_price_per_1m, output_price_per_1m,
                       recommended_for, quality_score, speed_score, display_order, description, is_default_free)
VALUES 
    ('google/gemini-2.5-pro', 'Gemini 2.5 Pro', 'Google', 'general', 'premium', FALSE, 2.0,
     8192, 1048576, 1.25, 5.0, ARRAY['evaluation', 'analytics', 'outline'], 5, 4, 20, 
     'Google''s most capable Gemini model', FALSE),
     
    ('google/gemini-3-flash-preview', 'Gemini 3 Flash Preview', 'Google', 'general', 'premium', FALSE, 2.0,
     1048576, 1048576, 0.5, 3.0, ARRAY['content', 'video', 'evaluation'], 5, 5, 21, 
     'Gemini 3 preview with excellent quality', FALSE),
     
    ('anthropic/claude-3.5-sonnet', 'Claude 3.5 Sonnet', 'Anthropic', 'general', 'premium', FALSE, 2.0,
     200000, 200000, 3.0, 15.0, ARRAY['evaluation', 'content', 'analytics'], 5, 4, 22, 
     'Anthropic''s balanced model', FALSE),
     
    ('anthropic/claude-sonnet-4.5', 'Claude Sonnet 4.5', 'Anthropic', 'general', 'premium', FALSE, 2.0,
     1000000, 1000000, 3.0, 15.0, ARRAY['evaluation', 'analytics', 'content'], 5, 4, 23, 
     'Latest Claude Sonnet with 1M context', FALSE),
     
    ('openai/gpt-4-turbo', 'GPT-4 Turbo', 'OpenAI', 'general', 'premium', FALSE, 2.0,
     128000, 128000, 10.0, 30.0, ARRAY['evaluation', 'analytics'], 5, 4, 24, 
     'High-performance GPT-4', FALSE),
     
    ('x-ai/grok-4.1-fast', 'Grok 4.1 Fast', 'xAI', 'general', 'premium', FALSE, 2.0,
     2000000, 2000000, 0.2, 0.5, ARRAY['content', 'evaluation'], 4, 5, 25, 
     'xAI''s fast model with massive context', FALSE)
     
ON CONFLICT (model_id) DO UPDATE SET
    name = EXCLUDED.name,
    input_price_per_1m = EXCLUDED.input_price_per_1m,
    output_price_per_1m = EXCLUDED.output_price_per_1m,
    updated_at = CURRENT_TIMESTAMP;

-- Ultra tier models
INSERT INTO ai_models (model_id, name, provider, category, tier, is_free, credit_multiplier,
                       max_tokens, context_window, input_price_per_1m, output_price_per_1m,
                       recommended_for, quality_score, speed_score, display_order, description, is_default_free)
VALUES 
    ('openai/gpt-4o', 'GPT-4o', 'OpenAI', 'general', 'ultra', FALSE, 4.0,
     128000, 128000, 5.0, 15.0, ARRAY['evaluation', 'analytics'], 5, 4, 30, 
     'Most capable GPT-4 model', FALSE),
     
    ('anthropic/claude-opus-4.5', 'Claude Opus 4.5', 'Anthropic', 'general', 'ultra', FALSE, 4.0,
     200000, 200000, 5.0, 25.0, ARRAY['evaluation', 'analytics', 'content'], 5, 3, 31, 
     'Most capable Claude model', FALSE),
     
    ('google/gemini-3-pro-preview', 'Gemini 3 Pro Preview', 'Google', 'general', 'ultra', FALSE, 4.0,
     1048576, 1048576, 2.0, 12.0, ARRAY['evaluation', 'analytics', 'video'], 5, 4, 32, 
     'Google''s most capable preview model', FALSE)
     
ON CONFLICT (model_id) DO UPDATE SET
    name = EXCLUDED.name,
    input_price_per_1m = EXCLUDED.input_price_per_1m,
    output_price_per_1m = EXCLUDED.output_price_per_1m,
    updated_at = CURRENT_TIMESTAMP;

-- Specialized models (embeddings, image, TTS)
INSERT INTO ai_models (model_id, name, provider, category, tier, is_free, credit_multiplier,
                       input_price_per_1m, output_price_per_1m,
                       recommended_for, quality_score, speed_score, display_order, description, is_default_free)
VALUES 
    ('openai/text-embedding-3-large', 'Text Embedding 3 Large', 'OpenAI', 'embedding', 'standard', FALSE, 0.5,
     0.13, 0, ARRAY['embedding'], 5, 5, 40, 'Best quality embeddings', FALSE),
     
    ('openai/text-embedding-3-small', 'Text Embedding 3 Small', 'OpenAI', 'embedding', 'standard', FALSE, 0.3,
     0.02, 0, ARRAY['embedding'], 4, 5, 41, 'Cost-effective embeddings', FALSE),
     
    ('google/gemini-2.5-flash-image', 'Gemini 2.5 Flash Image', 'Google', 'image', 'standard', FALSE, 1.5,
     0, 0, ARRAY['image'], 4, 4, 50, 'Image generation with Gemini', FALSE)
     
ON CONFLICT (model_id) DO UPDATE SET
    name = EXCLUDED.name,
    updated_at = CURRENT_TIMESTAMP;

-- ================================================================================
-- 3. Model Use Case Defaults - Which model to use for what
-- ================================================================================
CREATE TABLE IF NOT EXISTS ai_model_defaults (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    use_case VARCHAR(50) NOT NULL UNIQUE,             -- content, outline, evaluation, video, image, tts, embedding, copilot, agent, analytics
    default_model_id VARCHAR(100) NOT NULL,           -- References ai_models.model_id
    fallback_model_id VARCHAR(100),                    -- Fallback if default unavailable
    free_tier_model_id VARCHAR(100),                   -- Default for free tier users
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Seed use case defaults
INSERT INTO ai_model_defaults (use_case, default_model_id, fallback_model_id, free_tier_model_id, description)
VALUES 
    ('content', 'google/gemini-2.5-flash', 'deepseek/deepseek-v3.2', 'xiaomi/mimo-v2-flash:free', 'Content generation'),
    ('outline', 'google/gemini-2.5-flash', 'deepseek/deepseek-v3.2', 'xiaomi/mimo-v2-flash:free', 'Course outline generation'),
    ('video', 'google/gemini-2.0-flash-exp:free', 'google/gemini-2.5-flash', 'google/gemini-2.0-flash-exp:free', 'Video generation'),
    ('image', 'google/gemini-2.5-flash-image', 'google/gemini-2.5-flash', 'google/gemini-2.0-flash-exp:free', 'Image generation'),
    ('evaluation', 'google/gemini-2.5-pro', 'anthropic/claude-3.5-sonnet', 'nvidia/nemotron-3-nano-30b-a3b:free', 'Answer evaluation'),
    ('embedding', 'openai/text-embedding-3-small', 'openai/text-embedding-3-large', 'openai/text-embedding-3-small', 'Text embeddings'),
    ('copilot', 'google/gemini-2.5-flash', 'openai/gpt-4o-mini', 'xiaomi/mimo-v2-flash:free', 'Student/instructor copilot'),
    ('agent', 'google/gemini-2.5-flash', 'anthropic/claude-3.5-sonnet', 'mistralai/devstral-2512:free', 'AI agent interactions'),
    ('analytics', 'google/gemini-2.5-pro', 'anthropic/claude-sonnet-4.5', 'tngtech/deepseek-r1t2-chimera:free', 'Student analytics'),
    ('tts', 'openai/tts-1', 'openai/tts-1-hd', 'openai/tts-1', 'Text-to-speech')
ON CONFLICT (use_case) DO UPDATE SET
    default_model_id = EXCLUDED.default_model_id,
    fallback_model_id = EXCLUDED.fallback_model_id,
    free_tier_model_id = EXCLUDED.free_tier_model_id,
    updated_at = CURRENT_TIMESTAMP;

-- ================================================================================
-- 4. Update model_pricing to reference ai_models (backward compatibility)
-- ================================================================================
-- The model_pricing table from V83 is kept for backward compatibility but
-- the credit_multiplier in ai_models should be the source of truth going forward.

-- Add view for easy querying of active free models
CREATE OR REPLACE VIEW active_free_models AS
SELECT model_id, name, provider, category, description, quality_score, speed_score
FROM ai_models
WHERE is_free = TRUE AND is_active = TRUE
ORDER BY display_order;

-- Add view for model recommendations by use case
CREATE OR REPLACE VIEW model_recommendations AS
SELECT 
    m.model_id,
    m.name,
    m.provider,
    m.tier,
    m.is_free,
    m.quality_score,
    m.speed_score,
    m.input_price_per_1m,
    m.output_price_per_1m,
    m.credit_multiplier,
    unnest(m.recommended_for) as use_case
FROM ai_models m
WHERE m.is_active = TRUE
ORDER BY m.quality_score DESC, m.speed_score DESC;
