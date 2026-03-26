-- Notification rate limiting table
CREATE TABLE IF NOT EXISTS notification_rate_limit (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    institute_id VARCHAR(255) NOT NULL,
    channel VARCHAR(50) NOT NULL, -- EMAIL, WHATSAPP, SMS, PUSH
    daily_limit INTEGER NOT NULL DEFAULT 1000,
    daily_used INTEGER NOT NULL DEFAULT 0,
    reset_date DATE NOT NULL DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(institute_id, channel)
);

-- Backfill: create default limits for all existing institutes
INSERT INTO notification_rate_limit (institute_id, channel, daily_limit)
SELECT DISTINCT w.institute_id, ch.channel, 1000
FROM workflow w
CROSS JOIN (VALUES ('EMAIL'), ('WHATSAPP'), ('SMS'), ('PUSH')) AS ch(channel)
ON CONFLICT (institute_id, channel) DO NOTHING;

-- Webhook support columns on workflow_trigger
ALTER TABLE workflow_trigger ADD COLUMN IF NOT EXISTS webhook_secret VARCHAR(255);
ALTER TABLE workflow_trigger ADD COLUMN IF NOT EXISTS webhook_url_slug VARCHAR(255);
CREATE UNIQUE INDEX IF NOT EXISTS idx_wf_trigger_webhook_slug
    ON workflow_trigger(webhook_url_slug) WHERE webhook_url_slug IS NOT NULL;
