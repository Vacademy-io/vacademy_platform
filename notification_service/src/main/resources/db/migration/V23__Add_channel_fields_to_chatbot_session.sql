-- Add channel_type and business_channel_id to chatbot_flow_session
-- Required for delay node: after delay fires, the engine needs to know
-- which provider to use for sending messages.
ALTER TABLE chatbot_flow_session ADD COLUMN IF NOT EXISTS channel_type VARCHAR(50);
ALTER TABLE chatbot_flow_session ADD COLUMN IF NOT EXISTS business_channel_id VARCHAR(100);
