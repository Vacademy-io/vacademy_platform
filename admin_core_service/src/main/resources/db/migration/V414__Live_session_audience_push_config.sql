-- Per-session "save registrants to audience list(s)" config for public live classes.
-- JSON: {"enabled": true, "audience_ids": ["..."]} — same TEXT-JSON pattern as
-- bbb_config_json / feedback_config_json / recording_auto_link_json.
ALTER TABLE live_session ADD COLUMN IF NOT EXISTS audience_push_config_json TEXT;
