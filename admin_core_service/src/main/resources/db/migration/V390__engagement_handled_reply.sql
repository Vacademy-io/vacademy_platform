-- Engagement Engine — the at-most-once SET of inbound WhatsApp messages the auto-reply has handled.
-- The per-member last_reply_wamid stamp is a single slot, which re-claims in two edge windows: a
-- member matching the phone becomes newly ACTIVE between overlapping sweeps (activation/enrolment/
-- reconcile), or an overrunning sweep interleaves and the slot ping-pongs between two wamids. A set
-- keyed (institute_id, wamid) with INSERT ... ON CONFLICT DO NOTHING is the race-proof gate: exactly
-- one caller ever inserts a given message. Rows are pruned after 48h (the reply window is 24h).
CREATE TABLE IF NOT EXISTS engagement_handled_reply (
    institute_id VARCHAR(255) NOT NULL,
    wamid        VARCHAR(255) NOT NULL,
    claimed_at   TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (institute_id, wamid)
);
CREATE INDEX IF NOT EXISTS idx_ehr_claimed ON engagement_handled_reply (claimed_at);
