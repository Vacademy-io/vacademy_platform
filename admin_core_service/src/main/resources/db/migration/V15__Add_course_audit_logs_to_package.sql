-- Add course_audit_logs column to package for JSON audit trail
-- Stores an array of audit events as JSON text

ALTER TABLE package
ADD COLUMN IF NOT EXISTS course_audit_logs TEXT;


