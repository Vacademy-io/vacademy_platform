-- Add event_applied_type column to workflow_trigger
ALTER TABLE workflow_trigger ADD COLUMN event_applied_type VARCHAR(50) NULL;

-- Index for filtering
CREATE INDEX idx_workflow_trigger_event_applied_type ON workflow_trigger(event_applied_type);
