-- Add idempotency_generation_setting column to workflow_trigger table
-- This column stores JSON configuration for idempotency key generation strategies
-- to prevent duplicate workflow executions in trigger-based workflows

ALTER TABLE workflow_trigger
ADD COLUMN idempotency_generation_setting TEXT NULL;

-- Add comment for documentation
COMMENT ON COLUMN workflow_trigger.idempotency_generation_setting IS 
'JSON configuration for idempotency key generation. Defines strategy (NONE, UUID, TIME_WINDOW, CONTEXT_BASED, CONTEXT_TIME_WINDOW, EVENT_BASED, CUSTOM_EXPRESSION) and related settings (ttlMinutes, contextFields, etc.). Example: {"strategy":"CONTEXT_BASED","contextFields":["userId"]}';
