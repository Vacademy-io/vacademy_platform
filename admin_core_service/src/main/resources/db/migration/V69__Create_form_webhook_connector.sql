-- Create form_webhook_connector table
-- This table stores the configuration for form webhook integrations from external providers
-- allowing dynamic field mapping and multi-form support

CREATE TABLE IF NOT EXISTS form_webhook_connector (
    id                      VARCHAR(255) PRIMARY KEY,
    vendor                  VARCHAR(50) NOT NULL,
    vendor_id               VARCHAR(255) NOT NULL,
    institute_id            VARCHAR(255) NOT NULL,
    audience_id             VARCHAR(255) NOT NULL,
    type                    VARCHAR(50),
    sample_map_json         TEXT,
    is_active               BOOLEAN DEFAULT TRUE,
    created_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uk_vendor_vendor_id UNIQUE (vendor, vendor_id),
    CONSTRAINT fk_form_webhook_connector_institute 
        FOREIGN KEY (institute_id) 
        REFERENCES institutes(id) 
        ON DELETE CASCADE,
    CONSTRAINT fk_form_webhook_connector_audience 
        FOREIGN KEY (audience_id) 
        REFERENCES audience(id) 
        ON DELETE CASCADE
);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_vendor_vendor_id ON form_webhook_connector(vendor, vendor_id);
CREATE INDEX IF NOT EXISTS idx_audience_id ON form_webhook_connector(audience_id);
CREATE INDEX IF NOT EXISTS idx_institute_id ON form_webhook_connector(institute_id);
CREATE INDEX IF NOT EXISTS idx_is_active ON form_webhook_connector(is_active);

-- Add column comments for documentation
COMMENT ON TABLE form_webhook_connector IS 'Stores configuration for form webhook integrations from providers like Zoho Forms, Google Forms, etc.';
COMMENT ON COLUMN form_webhook_connector.id IS 'Primary key';
COMMENT ON COLUMN form_webhook_connector.vendor IS 'Form provider type (ZOHO_FORMS, GOOGLE_FORMS, MICROSOFT_FORMS)';
COMMENT ON COLUMN form_webhook_connector.vendor_id IS 'Unique identifier from form provider (e.g., Zoho form ID)';
COMMENT ON COLUMN form_webhook_connector.institute_id IS 'Institute ID that owns this connector';
COMMENT ON COLUMN form_webhook_connector.audience_id IS 'Audience/Campaign ID to link submissions to';
COMMENT ON COLUMN form_webhook_connector.type IS 'Optional type/category for the connector (e.g., LEAD_GENERATION, CONTACT_FORM)';
COMMENT ON COLUMN form_webhook_connector.sample_map_json IS 'JSON mapping configuration for field names. Maps form field names to standardized fields';
COMMENT ON COLUMN form_webhook_connector.is_active IS 'Whether this connector is active and should process webhooks';
COMMENT ON COLUMN form_webhook_connector.created_at IS 'Timestamp when the record was created';
COMMENT ON COLUMN form_webhook_connector.updated_at IS 'Timestamp when the record was last updated';
