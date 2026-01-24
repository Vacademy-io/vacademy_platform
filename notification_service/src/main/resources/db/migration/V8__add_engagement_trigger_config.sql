-- Create engagement trigger configuration table for time-based auto-triggering
-- Supports video watch time, PDF view time, and other engagement-based triggers

CREATE TABLE engagement_trigger_config (
    id VARCHAR(255) PRIMARY KEY,
    institute_id VARCHAR(255) NOT NULL,
    channel_type VARCHAR(50) NOT NULL,       -- 'WHATSAPP', 'EMAIL', 'SMS'
    
    -- Engagement Source Definition
    source_type VARCHAR(50) NOT NULL,        -- 'VIDEO', 'PDF', 'WEB_PAGE'
    source_identifier VARCHAR(255),          -- mediaId, documentId, pageUrl
    
    -- Trigger Condition
    threshold_seconds INT NOT NULL,          -- e.g., 30 seconds
    threshold_type VARCHAR(50) DEFAULT 'CUMULATIVE',  -- 'CUMULATIVE' or 'CONTINUOUS'
    
    -- Action to Take
    template_name TEXT NOT NULL,             -- WhatsApp template / Email template name
    template_variables TEXT,                 -- JSON: {"name": "{{1}}", "score": "{{2}}"}
    
    -- Status
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Index for efficient lookup during engagement processing
CREATE INDEX idx_engagement_lookup ON engagement_trigger_config(
    institute_id, channel_type, source_type, source_identifier, is_active
);


