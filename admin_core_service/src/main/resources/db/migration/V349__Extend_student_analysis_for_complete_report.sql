-- Migration: V344__Extend_student_analysis_for_complete_report.sql
-- Additive-only: new NULLABLE columns with defaults on student_analysis_process.
-- No existing columns are altered or dropped. App boots cleanly on a pre-existing
-- DB with old rows intact; old rows get report_version = 'v1' by the DEFAULT.

ALTER TABLE student_analysis_process
    ADD COLUMN IF NOT EXISTS report_version     VARCHAR(20)  DEFAULT 'v1',
    ADD COLUMN IF NOT EXISTS name               VARCHAR(255),
    ADD COLUMN IF NOT EXISTS send_email         BOOLEAN      DEFAULT TRUE,
    ADD COLUMN IF NOT EXISTS pdf_file_id        VARCHAR(255),
    ADD COLUMN IF NOT EXISTS batch_id           VARCHAR(255),
    ADD COLUMN IF NOT EXISTS package_session_id VARCHAR(255),
    ADD COLUMN IF NOT EXISTS included_modules   TEXT;

-- Index to filter by version (v1 vs v2)
CREATE INDEX IF NOT EXISTS idx_sap_report_version   ON student_analysis_process (report_version);
