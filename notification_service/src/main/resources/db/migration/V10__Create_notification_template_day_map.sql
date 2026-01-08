-- Create notification_template_day_map table for analytics tracking
CREATE TABLE notification_template_day_map (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    
    -- Required for filtering/matching
    institute_id UUID NOT NULL,
    sender_business_channel_id VARCHAR(255) NOT NULL,
    
    -- Day information
    day_number INT NOT NULL,
    day_label VARCHAR(255) NOT NULL,
    
    -- Template matching (what to look for in notification_log.body)
    template_identifier VARCHAR(255) NOT NULL,
    
    -- Sub-template label (for Level 1, Level 2, Morning, Evening, etc.)
    sub_template_label VARCHAR(255),
    
    -- Status
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    
    -- Ensure no duplicate templates
    CONSTRAINT unique_template UNIQUE(institute_id, sender_business_channel_id, template_identifier)
);

-- Index for fast lookups
CREATE INDEX idx_notification_template_lookup 
    ON notification_template_day_map(institute_id, sender_business_channel_id, is_active);

CREATE INDEX idx_notification_day_lookup
    ON notification_template_day_map(day_number);

-- Comments for documentation
COMMENT ON TABLE notification_template_day_map IS 'Maps workflow day templates to notification_log for analytics tracking';
COMMENT ON COLUMN notification_template_day_map.template_identifier IS 'Identifier to match in notification_log.body using LIKE pattern';
COMMENT ON COLUMN notification_template_day_map.sub_template_label IS 'Label for sub-templates like Level 1, Level 2, Morning, Evening';
