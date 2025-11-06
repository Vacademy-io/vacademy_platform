-- Create audience table for campaign/form management
-- This table stores campaign definitions for lead capture

CREATE TABLE IF NOT EXISTS audience (
    -- Primary Key
    id                      VARCHAR(50) PRIMARY KEY,
    
    -- Institute Association
    institute_id            VARCHAR(50) NOT NULL,
    
    -- Campaign Information
    campaign_name           VARCHAR(255) NOT NULL,
    campaign_type           TEXT,                           -- Comma-separated: "WEBSITE,GOOGLE_ADS,FACEBOOK_ADS"
    description             TEXT,
    campaign_objective      VARCHAR(50),                    -- LEAD_GENERATION, EVENT_REGISTRATION, etc.
    
    -- Campaign Period
    start_date              TIMESTAMP,
    end_date                TIMESTAMP,
    
    -- Status
    status                  VARCHAR(20) DEFAULT 'ACTIVE',   -- ACTIVE, PAUSED, COMPLETED, ARCHIVED
    
    -- Web Metadata (webhook URLs, configuration)
    json_web_metadata       TEXT,
    
    -- Audit Fields
    created_by_user_id      VARCHAR(50),
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Key Constraint
    CONSTRAINT fk_audience_institute 
        FOREIGN KEY (institute_id) 
        REFERENCES institutes(id) 
        ON DELETE CASCADE
);

-- Create indexes for better query performance
CREATE INDEX idx_audience_institute_id ON audience(institute_id);
CREATE INDEX idx_audience_status ON audience(status);
CREATE INDEX idx_audience_created_at ON audience(created_at);
CREATE INDEX idx_audience_dates ON audience(start_date, end_date);

-- Add comments for documentation
COMMENT ON TABLE audience IS 'Stores campaign/form definitions for lead capture across multiple channels';
COMMENT ON COLUMN audience.id IS 'Unique identifier for the campaign';
COMMENT ON COLUMN audience.institute_id IS 'Links to institutes table';
COMMENT ON COLUMN audience.campaign_name IS 'Human-readable name of the campaign';
COMMENT ON COLUMN audience.campaign_type IS 'Comma-separated list of channels: WEBSITE,GOOGLE_ADS,FACEBOOK_ADS';
COMMENT ON COLUMN audience.description IS 'Detailed description of the campaign';
COMMENT ON COLUMN audience.campaign_objective IS 'Purpose: LEAD_GENERATION, EVENT_REGISTRATION, etc.';
COMMENT ON COLUMN audience.status IS 'Campaign status: ACTIVE, PAUSED, COMPLETED, ARCHIVED';
COMMENT ON COLUMN audience.json_web_metadata IS 'JSON field for webhook URLs, secrets, and other metadata';
COMMENT ON COLUMN audience.created_by_user_id IS 'User who created this campaign';

