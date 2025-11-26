-- Create audience_response table for lead submissions
-- This table stores individual lead responses from all channels (website, Google Ads, Facebook Ads, etc.)

CREATE TABLE IF NOT EXISTS audience_response (
    -- Primary Key
    id                      VARCHAR(50) PRIMARY KEY,
    
    -- Campaign Association
    audience_id             VARCHAR(50) NOT NULL,
    
    -- User Association (NULL until converted to student)
    user_id                 VARCHAR(50),
    
    -- Source Tracking (differentiates between website form, Google Ads, Facebook Ads, etc.)
    source_type             VARCHAR(50) NOT NULL,           -- WEBSITE, GOOGLE_ADS, FACEBOOK_ADS, LINKEDIN_ADS, etc.
    source_id               VARCHAR(100),                   -- Landing page ID, Ad campaign ID, etc.
    
    -- Timestamps
    submitted_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    -- Foreign Key Constraint
    CONSTRAINT fk_audience_response_audience 
        FOREIGN KEY (audience_id) 
        REFERENCES audience(id) 
        ON DELETE CASCADE
    
    -- Note: user_id references users table in auth_service (no FK constraint across services)
);

-- Create indexes for better query performance
CREATE INDEX idx_audience_response_audience_id ON audience_response(audience_id);
CREATE INDEX idx_audience_response_user_id ON audience_response(user_id);
CREATE INDEX idx_audience_response_source_type ON audience_response(source_type);
CREATE INDEX idx_audience_response_submitted_at ON audience_response(submitted_at);
CREATE INDEX idx_audience_response_created_at ON audience_response(created_at);

-- Composite index for common queries
CREATE INDEX idx_audience_response_audience_source ON audience_response(audience_id, source_type);
CREATE INDEX idx_audience_response_audience_submitted ON audience_response(audience_id, submitted_at DESC);

-- Add comments for documentation
COMMENT ON TABLE audience_response IS 'Stores lead submissions from all channels (website forms, ad platforms, etc.)';
COMMENT ON COLUMN audience_response.id IS 'Unique identifier for the response';
COMMENT ON COLUMN audience_response.audience_id IS 'Links to audience (campaign) table';
COMMENT ON COLUMN audience_response.user_id IS 'References users.id in auth_service after conversion to student (NULL before conversion, no FK constraint)';
COMMENT ON COLUMN audience_response.source_type IS 'Source of lead: WEBSITE, GOOGLE_ADS, FACEBOOK_ADS, LINKEDIN_ADS, etc.';
COMMENT ON COLUMN audience_response.source_id IS 'Identifier of source (landing page ID, ad campaign ID, etc.)';
COMMENT ON COLUMN audience_response.submitted_at IS 'When the lead submitted the form or webhook was received';

