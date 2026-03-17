-- Migration V11: Add notification_type and channel_type columns to notification_template_day_map
-- Purpose: Support multiple notification types (outgoing/incoming) and multiple channels (WhatsApp, Email, SMS)

-- Add notification_type column (OUTGOING or INCOMING)
ALTER TABLE notification_template_day_map 
ADD COLUMN notification_type VARCHAR(50) NOT NULL DEFAULT 'WHATSAPP_MESSAGE_OUTGOING';

-- Add channel_type column (WHATSAPP, EMAIL, SMS, etc.)
ALTER TABLE notification_template_day_map 
ADD COLUMN channel_type VARCHAR(50) NOT NULL DEFAULT 'WHATSAPP';

-- Add comment for clarity
COMMENT ON COLUMN notification_template_day_map.notification_type IS 'Type of notification: WHATSAPP_MESSAGE_OUTGOING, WHATSAPP_MESSAGE_INCOMING, EMAIL_OUTGOING, etc.';
COMMENT ON COLUMN notification_template_day_map.channel_type IS 'Communication channel: WHATSAPP, EMAIL, SMS, PUSH_NOTIFICATION, etc.';

-- Create index for performance on commonly filtered columns
CREATE INDEX idx_template_day_map_notification_type ON notification_template_day_map(notification_type);
CREATE INDEX idx_template_day_map_channel_type ON notification_template_day_map(channel_type);

-- Update unique constraint to include notification_type and channel_type
-- First drop the old constraint
ALTER TABLE notification_template_day_map 
DROP CONSTRAINT IF EXISTS notification_template_day_map_institute_id_sender_business_ch_key;

-- Add new unique constraint
ALTER TABLE notification_template_day_map 
ADD CONSTRAINT notification_template_day_map_unique_key 
UNIQUE(institute_id, sender_business_channel_id, day_number, template_identifier, notification_type, channel_type);
