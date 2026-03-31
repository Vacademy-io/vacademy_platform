-- Add sender_name to notification_log for WhatsApp profile names (inbox feature)
ALTER TABLE notification_log ADD COLUMN IF NOT EXISTS sender_name VARCHAR(255);

-- Indexes for inbox queries (conversation list + message history)
CREATE INDEX IF NOT EXISTS idx_nl_channel_date ON notification_log(channel_id, notification_date DESC);
CREATE INDEX IF NOT EXISTS idx_nl_sender_channel_type_date ON notification_log(sender_business_channel_id, notification_type, notification_date DESC);
