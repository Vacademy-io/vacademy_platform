ALTER TABLE whatsapp_template ADD COLUMN IF NOT EXISTS body_variable_names TEXT;

-- Backfill: for templates with body_sample_values, auto-generate variable names
-- e.g. body_text "Hello {{1}}, welcome to {{2}}" with sample_values ["John", "Math"]
-- → variable_names ["name", "course_name"] (snake_case of generic labels)
-- This is a best-effort guess; admins can edit via UI.
