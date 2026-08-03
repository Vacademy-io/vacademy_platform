-- Custom intake questions asked on a booking page's public form, independent of any
-- audience list (so a mentor can collect answers without CRM/lead coupling). Serialized
-- list of {id, label, field_type, required, options} in form_fields_json. Answers are
-- stored on booking_instance.custom_field_values_json, keyed by the field id.
ALTER TABLE booking_page ADD COLUMN IF NOT EXISTS form_fields_json TEXT;
