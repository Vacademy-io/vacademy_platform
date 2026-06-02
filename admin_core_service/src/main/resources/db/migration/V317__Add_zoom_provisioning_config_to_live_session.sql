-- Persist the Zoom account + meeting-settings chosen for a session so the
-- provisioning retry job can re-create meetings for occurrences whose up-front
-- async provisioning was interrupted (process restart / partial failure),
-- without re-asking the admin UI. Mirrors the existing bbb_config_json column.
ALTER TABLE live_session ADD COLUMN IF NOT EXISTS zoom_account_id VARCHAR(255);
ALTER TABLE live_session ADD COLUMN IF NOT EXISTS zoom_config_json TEXT;
