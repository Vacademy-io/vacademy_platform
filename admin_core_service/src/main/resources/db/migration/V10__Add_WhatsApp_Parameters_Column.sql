-- Migration script to add dynamic_parameters column to templates table
-- This column will store JSON key-value pairs for template dynamic parameters based on contentType

ALTER TABLE templates ADD COLUMN dynamic_parameters TEXT;

-- Add comment to explain the column purpose
COMMENT ON COLUMN templates.dynamic_parameters IS 'JSON string containing key-value pairs for template dynamic parameters based on contentType (WHATSAPP, EMAIL, etc.)';
