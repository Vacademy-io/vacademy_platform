-- ================================================================================
-- V83: Institute Credit System Tables
-- 
-- This migration adds tables for the AI credit system:
-- 1. institute_credits: Tracks credit balance per institute
-- 2. credit_transactions: Audit log of all credit changes
-- 3. credit_pricing: Configurable pricing per request type
-- 4. model_pricing: Model tier multipliers
-- 5. credit_alerts: Low balance alerts
-- ================================================================================

-- ================================================================================
-- 1. Institute Credits Table - Tracks balance for each institute
-- ================================================================================
CREATE TABLE IF NOT EXISTS institute_credits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institute_id VARCHAR(255) NOT NULL UNIQUE,
    total_credits DECIMAL(12,2) DEFAULT 0,         -- Total credits ever allocated
    used_credits DECIMAL(12,2) DEFAULT 0,          -- Total credits consumed
    current_balance DECIMAL(12,2) DEFAULT 0,       -- total - used (denormalized for performance)
    low_balance_threshold DECIMAL(12,2) DEFAULT 50, -- Alert when balance drops below
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_institute_credits_institute_id ON institute_credits(institute_id);
CREATE INDEX IF NOT EXISTS idx_institute_credits_balance ON institute_credits(current_balance);

-- ================================================================================
-- 2. Credit Transactions - Audit log of all credit changes
-- ================================================================================
CREATE TABLE IF NOT EXISTS credit_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institute_id VARCHAR(255) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,         -- 'INITIAL_GRANT', 'ADMIN_GRANT', 'USAGE_DEDUCTION', 'REFUND'
    amount DECIMAL(12,4) NOT NULL,                 -- Positive for grants, negative for usage
    balance_after DECIMAL(12,2) NOT NULL,          -- Balance after this transaction
    description TEXT,                               -- "Initial signup bonus", "Admin grant by X"
    reference_id UUID,                              -- Links to ai_token_usage.id for usage deductions
    request_type VARCHAR(50),                       -- For usage: content, image, embedding, etc.
    model_name VARCHAR(100),                        -- For usage: the model used
    granted_by VARCHAR(255),                        -- User ID of admin who granted (for grants)
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credit_transactions_institute_id ON credit_transactions(institute_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_reference_id ON credit_transactions(reference_id);

-- ================================================================================
-- 3. Credit Pricing - Configurable rates per request type
-- ================================================================================
CREATE TABLE IF NOT EXISTS credit_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    request_type VARCHAR(50) NOT NULL UNIQUE,
    base_cost DECIMAL(8,4) NOT NULL DEFAULT 0.5,   -- Fixed cost per request
    token_rate DECIMAL(10,8) NOT NULL DEFAULT 0.0001, -- Cost per token (or character for TTS)
    minimum_charge DECIMAL(8,4) NOT NULL DEFAULT 0.5, -- Minimum credit cost
    unit_type VARCHAR(20) DEFAULT 'tokens',        -- 'tokens', 'characters', 'none'
    description VARCHAR(200),                       -- Human-readable description
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default pricing
INSERT INTO credit_pricing (request_type, base_cost, token_rate, minimum_charge, unit_type, description) VALUES
('content', 0.5, 0.0001, 0.5, 'tokens', 'Standard text/content generation'),
('agent', 0.5, 0.0001, 0.5, 'tokens', 'AI agent interactions'),
('copilot', 0.5, 0.0001, 0.5, 'tokens', 'Instructor/student copilot'),
('analytics', 0.5, 0.0001, 0.5, 'tokens', 'Student analytics generation'),
('outline', 0.5, 0.0001, 0.5, 'tokens', 'Course outline generation'),
('evaluation', 1.0, 0.00015, 1.0, 'tokens', 'Answer evaluation (more complex)'),
('embedding', 0.1, 0.00002, 0.1, 'tokens', 'Text embeddings (cheaper)'),
('image', 3.0, 0, 3.0, 'none', 'Image generation (flat rate)'),
('video', 5.0, 0, 5.0, 'none', 'Video generation (flat rate)'),
('tts', 0.2, 0.0001, 0.2, 'characters', 'Text-to-speech (per character)')
ON CONFLICT (request_type) DO NOTHING;

-- ================================================================================
-- 4. Model Pricing - Tier multipliers for different models
-- ================================================================================
CREATE TABLE IF NOT EXISTS model_pricing (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    model_pattern VARCHAR(100) NOT NULL UNIQUE,    -- e.g., 'google/gemini-2.5-pro%'
    tier VARCHAR(20) NOT NULL DEFAULT 'standard',  -- 'standard', 'premium', 'ultra'
    multiplier DECIMAL(4,2) NOT NULL DEFAULT 1.0,
    description VARCHAR(200),
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Insert default model tiers
INSERT INTO model_pricing (model_pattern, tier, multiplier, description) VALUES
('google/gemini-2.0-flash%', 'standard', 1.0, 'Gemini 2.0 Flash - Standard tier'),
('google/gemini-2.5-flash%', 'standard', 1.0, 'Gemini 2.5 Flash - Standard tier'),
('google/gemini-2.5-pro%', 'premium', 2.0, 'Gemini 2.5 Pro - Premium tier'),
('deepseek%', 'standard', 1.0, 'DeepSeek models - Standard tier'),
('gpt-3.5%', 'standard', 1.0, 'GPT-3.5 - Standard tier'),
('gpt-4-turbo%', 'premium', 2.0, 'GPT-4 Turbo - Premium tier'),
('gpt-4o%', 'ultra', 4.0, 'GPT-4o - Ultra tier'),
('claude-3-haiku%', 'standard', 1.0, 'Claude 3 Haiku - Standard tier'),
('claude-3-sonnet%', 'premium', 2.0, 'Claude 3 Sonnet - Premium tier'),
('claude-3-opus%', 'ultra', 4.0, 'Claude 3 Opus - Ultra tier'),
('text-embedding%', 'standard', 1.0, 'Embedding models - Standard tier')
ON CONFLICT (model_pattern) DO NOTHING;

-- ================================================================================
-- 5. Credit Alerts - Track low balance alerts to prevent flooding
-- ================================================================================
CREATE TABLE IF NOT EXISTS credit_alerts (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    institute_id VARCHAR(255) NOT NULL,
    alert_type VARCHAR(50) NOT NULL,               -- 'LOW_BALANCE', 'ZERO_BALANCE', 'NEGATIVE_BALANCE'
    threshold_value DECIMAL(12,2),                 -- What threshold triggered this
    current_balance DECIMAL(12,2),                 -- Balance when alert was created
    acknowledged BOOLEAN DEFAULT FALSE,
    acknowledged_by VARCHAR(255),                  -- User who acknowledged
    acknowledged_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credit_alerts_institute_id ON credit_alerts(institute_id);
CREATE INDEX IF NOT EXISTS idx_credit_alerts_acknowledged ON credit_alerts(acknowledged);
CREATE INDEX IF NOT EXISTS idx_credit_alerts_type ON credit_alerts(alert_type);

-- ================================================================================
-- Add credits_used column to ai_token_usage for linking
-- ================================================================================
ALTER TABLE ai_token_usage ADD COLUMN IF NOT EXISTS credits_used DECIMAL(10,4);

-- ================================================================================
-- Grant initial credits to existing institutes (200 credits each)
-- ================================================================================
INSERT INTO institute_credits (institute_id, total_credits, used_credits, current_balance)
SELECT id, 200, 0, 200
FROM institute
WHERE id NOT IN (SELECT institute_id FROM institute_credits)
ON CONFLICT (institute_id) DO NOTHING;

-- Record the initial grant transaction for existing institutes
INSERT INTO credit_transactions (institute_id, transaction_type, amount, balance_after, description)
SELECT ic.institute_id, 'INITIAL_GRANT', 200, 200, 'Initial signup bonus (migration)'
FROM institute_credits ic
WHERE NOT EXISTS (
    SELECT 1 FROM credit_transactions ct 
    WHERE ct.institute_id = ic.institute_id 
    AND ct.transaction_type = 'INITIAL_GRANT'
);
