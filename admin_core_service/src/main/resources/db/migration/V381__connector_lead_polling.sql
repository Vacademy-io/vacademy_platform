-- V381: Per-connector lead POLLING cursor.
--
-- Realtime (webhook) delivery requires the Vacademy app to be assigned as a CRM
-- in Meta's Lead Access Manager. When that assignment is missing/revoked
-- ("CRM access revoked"), Meta refuses to PUSH leads even though the stored Page
-- token can still PULL them via GET /{form_id}/leads (which authorizes off the
-- page token's own leads_retrieval permission, not the CRM push assignment).
--
-- The poller (MetaLeadPollingJob) reuses the exact same normalize→map→route→
-- submitLeadFromFormWebhook pipeline as the webhook, driven by a timer instead of
-- a push. It runs as a universal backstop next to the webhook; dedup (same
-- person → same user → existsByAudienceIdAndUserId) makes double-delivery a no-op.

-- Watermark: only leads created after this instant are pulled on the next poll.
-- NULL means "never polled" → the job seeds a going-forward cursor (now minus a
-- small initial-lookback) so a first run never mass-imports 90 days of history.
ALTER TABLE form_webhook_connector
    ADD COLUMN IF NOT EXISTS last_polled_at TIMESTAMP;

-- Meta lead id (leadgen_id) of the most recent lead ingested by the poller.
-- Diagnostic only — the time watermark above drives the query.
ALTER TABLE form_webhook_connector
    ADD COLUMN IF NOT EXISTS last_polled_lead_id VARCHAR(255);

-- Per-connector kill switch for polling. Defaults TRUE so the backstop covers
-- every Meta connector; set FALSE to opt a connector out (e.g. one where realtime
-- is healthy and polling is redundant).
ALTER TABLE form_webhook_connector
    ADD COLUMN IF NOT EXISTS polling_enabled BOOLEAN DEFAULT TRUE;
