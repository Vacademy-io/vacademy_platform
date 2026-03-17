-- V118: Add explicit workflow boundaries (is_first, is_last) to application_stage
-- This helps in identifying the start and end of a workflow without relying on sequence sorting

-- 1. Add columns with default FALSE
ALTER TABLE application_stage
    ADD COLUMN IF NOT EXISTS is_first BOOLEAN DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS is_last BOOLEAN DEFAULT FALSE;

-- 2. Create Indexes for fast lookup
CREATE INDEX IF NOT EXISTS idx_application_stage_first
    ON application_stage(institute_id, workflow_type, is_first);

CREATE INDEX IF NOT EXISTS idx_application_stage_last
    ON application_stage(institute_id, workflow_type, is_last);
