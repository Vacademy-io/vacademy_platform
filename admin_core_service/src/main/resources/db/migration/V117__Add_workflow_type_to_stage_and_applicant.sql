-- V114: Add workflow_type to application_stage and applicant tables
-- Enables stage lookup to be scoped by workflow (APPLICATION vs ADMISSION)

-- 1. Add workflow_type to application_stage
ALTER TABLE application_stage
    ADD COLUMN IF NOT EXISTS workflow_type VARCHAR(50);

-- Default existing stages to APPLICATION (backward compatible)
UPDATE application_stage SET workflow_type = 'APPLICATION' WHERE workflow_type IS NULL;

-- Index for fast lookup: institute + workflow_type
CREATE INDEX IF NOT EXISTS idx_application_stage_workflow_type
    ON application_stage(institute_id, workflow_type);

-- 2. Add workflow_type to applicant (tracks which workflow created this applicant)
ALTER TABLE applicant
    ADD COLUMN IF NOT EXISTS workflow_type VARCHAR(50);

-- Default existing applicants to APPLICATION
UPDATE applicant SET workflow_type = 'APPLICATION' WHERE workflow_type IS NULL;

-- 3. Make audience_response.audience_id nullable
-- ADMISSION workflow creates AudienceResponse without a campaign (no audience_id)
ALTER TABLE audience_response
    ALTER COLUMN audience_id DROP NOT NULL;
