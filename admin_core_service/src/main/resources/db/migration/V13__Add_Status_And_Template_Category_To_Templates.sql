-- Migration script to add status and template_category columns to templates table
-- This adds two new fields to support template status management and categorization

-- Add status column to templates table
ALTER TABLE templates ADD COLUMN status VARCHAR(50);

-- Add template_category column to templates table
ALTER TABLE templates ADD COLUMN template_category VARCHAR(50);

-- Create indexes for better performance on new columns
CREATE INDEX idx_templates_status ON templates(status);
CREATE INDEX idx_templates_template_category ON templates(template_category);
CREATE INDEX idx_templates_institute_status ON templates(institute_id, status);
CREATE INDEX idx_templates_institute_template_category ON templates(institute_id, template_category);
CREATE INDEX idx_templates_institute_status_template_category ON templates(institute_id, status, template_category);

-- Add comments to the new columns (PostgreSQL syntax)
COMMENT ON COLUMN templates.status IS 'Template status: ACTIVE, INACTIVE, DRAFT, etc.';
COMMENT ON COLUMN templates.template_category IS 'Template category: NOTIFICATION, MARKETING, SYSTEM, etc.';

-- Update existing templates to have default values (optional)
-- You can uncomment these lines if you want to set default values for existing records
-- UPDATE templates SET status = 'ACTIVE' WHERE status IS NULL;
-- UPDATE templates SET template_category = 'NOTIFICATION' WHERE template_category IS NULL;
