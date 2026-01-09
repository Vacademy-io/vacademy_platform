-- Add support for fixed/static variables in channel flow config
-- This allows templates to use both dynamic (user data) and fixed (database stored) variables
-- Backward compatible: existing flows without fixed_variables_config will continue to work

ALTER TABLE channel_flow_config
ADD COLUMN fixed_variables_config TEXT;

COMMENT ON COLUMN channel_flow_config.fixed_variables_config IS 'JSON storing fixed/static variables for templates. Example: {"template_name": {"var1": "value1", "var2": "value2"}}';
