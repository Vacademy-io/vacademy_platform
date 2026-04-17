-- Add default_values_json column to form_webhook_connector
-- This column stores center-specific default values as JSON that are merged
-- into form data during webhook processing (e.g., center name, schedule link, location link)
ALTER TABLE form_webhook_connector
ADD COLUMN IF NOT EXISTS default_values_json TEXT;
