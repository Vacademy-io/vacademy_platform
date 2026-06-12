-- Logged-out ("guest") query intake: a guest doubt has user_id = NULL and carries the visitor's
-- contact directly, so admins can see who asked and reply notifications can be emailed to the raw
-- address (no auth_service user exists for guests).
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS guest_name VARCHAR(255);
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS guest_email VARCHAR(255);
