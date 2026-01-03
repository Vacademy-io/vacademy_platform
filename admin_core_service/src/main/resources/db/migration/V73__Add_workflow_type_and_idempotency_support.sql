-- Add workflow_type and workflow_trigger_id to workflow_execution table
-- Distinguishes between SCHEDULED and EVENT_DRIVEN workflow executions

-- Add workflow_type column (defaults to SCHEDULED for backward compatibility)
ALTER TABLE workflow_execution
ADD COLUMN workflow_type VARCHAR(20) NOT NULL DEFAULT 'SCHEDULED';

-- Add workflow_trigger_id column for event-driven workflows
ALTER TABLE workflow_execution
ADD COLUMN workflow_trigger_id VARCHAR(36) NULL;

-- Add foreign key constraint for workflow_trigger_id
ALTER TABLE workflow_execution
ADD CONSTRAINT fk_workflow_execution_trigger 
FOREIGN KEY (workflow_trigger_id) REFERENCES workflow_trigger(id);


-- Allow workflow_schedule_id to be NULL
ALTER TABLE workflow_execution
ALTER COLUMN workflow_schedule_id DROP NOT NULL;
