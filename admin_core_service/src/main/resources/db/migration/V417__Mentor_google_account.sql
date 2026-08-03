-- Per-mentor Google account: each mentor connects THEIR OWN Google account so their
-- bookings use it for Meet + Calendar (event on the mentor's own calendar), rather
-- than the single per-institute default. mentor.google_account_id points at the
-- institute_live_session_provider_mapping row id (GoogleAccount.id).
ALTER TABLE mentor ADD COLUMN IF NOT EXISTS google_account_id VARCHAR(255);

-- Carry the mentor link through the Google OAuth connect flow: /initiate stores the
-- mentor id on the state row, /callback reads it back to set mentor.google_account_id.
ALTER TABLE oauth_connect_state ADD COLUMN IF NOT EXISTS mentor_id VARCHAR(255);
