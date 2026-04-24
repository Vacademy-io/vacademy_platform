-- Add feedback configuration column to live_session table.
-- Stores JSON config controlling post-session learner feedback questions.
ALTER TABLE live_session ADD COLUMN IF NOT EXISTS feedback_config_json TEXT;
