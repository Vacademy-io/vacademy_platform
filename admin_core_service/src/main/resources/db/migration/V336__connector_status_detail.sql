-- Surface WHY an ad-platform connector isn't delivering leads.
--
-- Until now subscribePageToWebhooks() was fire-and-forget: if the per-page
-- POST /{page}/subscribed_apps call failed (most often Meta error #200 — the
-- connecting account lacks Full control / the MANAGE task on the Page) the
-- connector was still saved with connection_status = 'ACTIVE' and nothing
-- recorded the failure, so leads silently never arrived.
--
-- connection_status now also takes the value 'ACTION_REQUIRED'; status_detail
-- holds the human remediation, and last_checked_at records when the health
-- check last ran.

ALTER TABLE form_webhook_connector
    ADD COLUMN IF NOT EXISTS status_detail TEXT;

ALTER TABLE form_webhook_connector
    ADD COLUMN IF NOT EXISTS last_checked_at TIMESTAMP;

COMMENT ON COLUMN form_webhook_connector.status_detail IS
    'Human-readable reason / remediation when connection_status is not ACTIVE (e.g. page subscription failed: needs Full control + 2FA).';
COMMENT ON COLUMN form_webhook_connector.last_checked_at IS
    'When the connector health check last ran.';
