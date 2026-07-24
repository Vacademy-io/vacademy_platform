-- Engagement Engine — the Meta language code a WhatsApp task's template is registered under.
-- Without it, the dispatcher can't tell notification_service which locale of the template to send
-- (Meta identifies a template by name+language), so a non-English engine's WhatsApp send fails.
-- Nullable: only WhatsApp tasks with an attached template carry it; every other action leaves it NULL.
ALTER TABLE engagement_action
    ADD COLUMN IF NOT EXISTS template_language VARCHAR(10);
