-- Per-field settings for assessment registration form fields (help text, default value,
-- checkbox heading/consent body, file constraints...). Stored as one JSON blob rather than a
-- column per setting, matching custom_fields.config in admin_core_service.
-- Nullable: every existing row simply has no extra settings.
ALTER TABLE assessment_custom_fields ADD COLUMN config TEXT;
