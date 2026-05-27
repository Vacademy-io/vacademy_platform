-- Human-readable name of the ad platform form (e.g. "Wakad_leadform_2026").
-- Stored at connector-create time so the admin connector list can show form
-- names instead of opaque numeric IDs. Nullable: older rows and Google
-- connectors leave it null.
ALTER TABLE form_webhook_connector
    ADD COLUMN IF NOT EXISTS platform_form_name VARCHAR(255);
