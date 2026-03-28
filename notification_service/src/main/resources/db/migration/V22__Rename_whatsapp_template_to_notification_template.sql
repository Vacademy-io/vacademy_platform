-- Rename whatsapp_template → notification_template (unified template storage)
ALTER TABLE whatsapp_template RENAME TO notification_template;

-- Add email/general template columns
ALTER TABLE notification_template ADD COLUMN IF NOT EXISTS channel_type VARCHAR(20) DEFAULT 'WHATSAPP';
ALTER TABLE notification_template ADD COLUMN IF NOT EXISTS subject TEXT;
ALTER TABLE notification_template ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE notification_template ADD COLUMN IF NOT EXISTS content_type VARCHAR(20);
ALTER TABLE notification_template ADD COLUMN IF NOT EXISTS setting_json TEXT;
ALTER TABLE notification_template ADD COLUMN IF NOT EXISTS dynamic_parameters TEXT;
ALTER TABLE notification_template ADD COLUMN IF NOT EXISTS can_delete BOOLEAN DEFAULT true;
ALTER TABLE notification_template ADD COLUMN IF NOT EXISTS template_category VARCHAR(50);

-- Backfill existing rows as WHATSAPP
UPDATE notification_template SET channel_type = 'WHATSAPP' WHERE channel_type IS NULL;

-- Relax NOT NULL on body_text (email templates use content instead)
ALTER TABLE notification_template ALTER COLUMN body_text DROP NOT NULL;

-- Relax NOT NULL on category (email templates may not have WhatsApp category)
ALTER TABLE notification_template ALTER COLUMN category DROP NOT NULL;

-- Index for channel-based lookups
CREATE INDEX IF NOT EXISTS idx_notification_template_channel ON notification_template(institute_id, channel_type);
CREATE INDEX IF NOT EXISTS idx_notification_template_name_channel ON notification_template(institute_id, name, channel_type);
