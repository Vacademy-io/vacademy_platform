-- Add template_name column for unified send (replaces templateId → Template entity lookup)
ALTER TABLE notification_event_config ADD COLUMN IF NOT EXISTS template_name VARCHAR(255);

-- Backfill template_name from templates table
UPDATE notification_event_config nec
SET template_name = t.name
FROM templates t
WHERE nec.template_id = t.id
  AND nec.template_name IS NULL;
