-- Engagement Engine — the last inbound WhatsApp message id (wamid) the auto-reply has handled for a
-- member. The reply sweep runs every 2 min with an overlapping 3-min lookback, so the SAME reply
-- appears in consecutive sweeps; a CAS on this column ("claim this wamid") is what makes the
-- auto-reply answer each inbound message AT MOST ONCE. NULL = no reply handled yet.
ALTER TABLE engagement_member
    ADD COLUMN IF NOT EXISTS last_reply_wamid VARCHAR(255);
