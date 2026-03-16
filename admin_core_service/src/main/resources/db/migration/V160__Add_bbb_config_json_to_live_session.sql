-- Add BBB meeting configuration column to live_session
ALTER TABLE live_session ADD COLUMN IF NOT EXISTS bbb_config_json TEXT;
