-- Migration: Add workflow_activate_day_at column to audience_response table
-- Purpose: Separate workflow filtering date from record creation timestamp

-- Step 1: Rename existing created_at to workflow_activate_day_at
ALTER TABLE audience_response RENAME COLUMN created_at TO workflow_activate_day_at;

-- Step 2: Add new created_at column with default current timestamp
ALTER TABLE audience_response ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;

-- Step 3: Populate new created_at with workflow_activate_day_at values for existing records
UPDATE audience_response SET created_at = workflow_activate_day_at WHERE created_at IS NULL;

-- Step 4: Add index on workflow_activate_day_at for workflow query performance
CREATE INDEX IF NOT EXISTS idx_audience_response_workflow_activate_day 
ON audience_response(audience_id, workflow_activate_day_at);
