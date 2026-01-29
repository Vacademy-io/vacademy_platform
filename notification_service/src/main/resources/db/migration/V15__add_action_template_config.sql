-- Migration: Add action_template_config column to channel_flow_config table
-- This column stores workflow/verification action configurations

ALTER TABLE channel_flow_config 
ADD COLUMN IF NOT EXISTS action_template_config TEXT;

-- Example usage:
-- {
--   "rules": [
--     {"trigger": "hello", "match_type": "exact", "actions": [{"type": "WORKFLOW", "workflowId": "wf_onboarding"}]},
--     {"trigger": "\\d{4,6}", "match_type": "regex", "actions": [{"type": "VERIFICATION"}]}
--   ]
-- }

COMMENT ON COLUMN channel_flow_config.action_template_config IS 
  'JSON config for workflow/verification actions. Processed BEFORE response_template_config.';
