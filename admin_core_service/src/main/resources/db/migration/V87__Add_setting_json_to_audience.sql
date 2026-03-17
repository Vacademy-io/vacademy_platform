-- Add setting_json column to audience table
ALTER TABLE audience
ADD COLUMN setting_json TEXT;
