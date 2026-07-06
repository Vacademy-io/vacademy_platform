-- Bulk "Call all with AI" idempotency: stamped when a bulk AI-call campaign is
-- started for an audience, so a re-fire of the SAME list within the cooldown window
-- is rejected (via an atomic conditional UPDATE that claims it) instead of
-- double-dialing — and double-billing — every lead. Nullable; existing rows untouched.
ALTER TABLE audience ADD COLUMN IF NOT EXISTS last_ai_campaign_started_at TIMESTAMP;
