-- Migration script to create templates table for email and WhatsApp notifications
-- This table will store multiple templates for different notification types

CREATE TABLE IF NOT EXISTS templates (
    id VARCHAR(36) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,
    vendor_id VARCHAR(36),
    institute_id VARCHAR(36) NOT NULL,
    name VARCHAR(255) NOT NULL,
    subject VARCHAR(500),
    content TEXT,
    content_type VARCHAR(50),
    setting_json TEXT,
    can_delete BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by VARCHAR(36),
    updated_by VARCHAR(36)
);

-- Create indexes for better performance
CREATE INDEX idx_templates_institute_id ON templates(institute_id);
CREATE INDEX idx_templates_type ON templates(type);
CREATE INDEX idx_templates_vendor_id ON templates(vendor_id);
CREATE INDEX idx_templates_institute_type ON templates(institute_id, type);
CREATE INDEX idx_templates_institute_type_vendor ON templates(institute_id, type, vendor_id);
CREATE INDEX idx_templates_name ON templates(name);
CREATE INDEX idx_templates_created_at ON templates(created_at);
CREATE INDEX idx_templates_can_delete ON templates(can_delete);

-- Create unique constraint to prevent duplicate template names within the same institute
CREATE UNIQUE INDEX idx_templates_institute_name_unique ON templates(institute_id, name);

-- Add foreign key constraints if the referenced tables exist
-- Note: These are commented out as they depend on the actual table structure
-- ALTER TABLE templates ADD CONSTRAINT fk_templates_institute FOREIGN KEY (institute_id) REFERENCES institutes(id);
-- ALTER TABLE templates ADD CONSTRAINT fk_templates_created_by FOREIGN KEY (created_by) REFERENCES users(id);
-- ALTER TABLE templates ADD CONSTRAINT fk_templates_updated_by FOREIGN KEY (updated_by) REFERENCES users(id);

-- Insert some sample templates for testing (optional)
INSERT INTO templates (id, type, institute_id, name, subject, content, content_type, setting_json, can_delete, created_by, updated_by) VALUES
('template-email-welcome-001', 'EMAIL', 'sample-institute-001', 'Welcome Email Template', 
 'Welcome to {{institute_name}}!', 
 '<h1>Welcome to {{institute_name}}!</h1><p>Dear {{student_name}},</p><p>Welcome to our platform. We are excited to have you join us.</p><p>Best regards,<br>{{institute_name}} Team</p>', 
 'HTML', 
 '{"from_email": "noreply@{{institute_domain}}", "reply_to": "support@{{institute_domain}}"}', 
 TRUE, 'system', 'system'),

('template-whatsapp-reminder-001', 'WHATSAPP', 'sample-institute-001', 'Class Reminder Template', 
 'Class Reminder - {{class_name}}', 
 'Hi {{student_name}}! This is a reminder that your class "{{class_name}}" is scheduled for {{class_time}} on {{class_date}}. Please join on time. - {{institute_name}}', 
 'TEXT', 
 '{"template_id": "class_reminder_001", "language": "en", "category": "UTILITY"}', 
 TRUE, 'system', 'system'),

('template-email-certificate-001', 'EMAIL', 'sample-institute-001', 'Certificate Email Template', 
 'Certificate of Completion - {{course_name}}', 
 '<h2>Congratulations {{student_name}}!</h2><p>You have successfully completed the course "{{course_name}}" at {{institute_name}}.</p><p>Your certificate is attached to this email.</p><p>Congratulations on your achievement!</p>', 
 'HTML', 
 '{"attachment": "certificate.pdf", "from_email": "certificates@{{institute_domain}}"}', 
 TRUE, 'system', 'system');

-- Create function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger to automatically update updated_at on row update
CREATE TRIGGER update_templates_updated_at 
    BEFORE UPDATE ON templates 
    FOR EACH ROW 
    EXECUTE FUNCTION update_updated_at_column();

-- Add comments to the table and columns (PostgreSQL syntax)
COMMENT ON TABLE templates IS 'Templates table for storing email and WhatsApp notification templates for institutes';
COMMENT ON COLUMN templates.id IS 'Primary key (UUID)';
COMMENT ON COLUMN templates.type IS 'Template type: EMAIL, WHATSAPP, SMS, etc.';
COMMENT ON COLUMN templates.vendor_id IS 'Vendor ID for vendor-specific templates';
COMMENT ON COLUMN templates.institute_id IS 'Institute ID this template belongs to';
COMMENT ON COLUMN templates.name IS 'Template name (unique per institute)';
COMMENT ON COLUMN templates.subject IS 'Email subject line or notification title';
COMMENT ON COLUMN templates.content IS 'Template content/body';
COMMENT ON COLUMN templates.content_type IS 'Content type: HTML, TEXT, JSON, etc.';
COMMENT ON COLUMN templates.setting_json IS 'Additional settings in JSON format';
COMMENT ON COLUMN templates.can_delete IS 'Whether this template can be deleted';
COMMENT ON COLUMN templates.created_at IS 'Creation timestamp';
COMMENT ON COLUMN templates.updated_at IS 'Last update timestamp';
COMMENT ON COLUMN templates.created_by IS 'User ID who created this template';
COMMENT ON COLUMN templates.updated_by IS 'User ID who last updated this template';
