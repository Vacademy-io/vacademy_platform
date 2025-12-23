ALTER TABLE engagement_trigger_config
ADD COLUMN previous_template_name TEXT,
ADD COLUMN require_previous_template BOOLEAN DEFAULT FALSE;