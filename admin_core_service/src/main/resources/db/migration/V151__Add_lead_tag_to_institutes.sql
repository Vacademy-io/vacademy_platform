-- Add lead_tag column to institutes table for categorizing institutes
ALTER TABLE institutes ADD COLUMN IF NOT EXISTS lead_tag VARCHAR(50) DEFAULT 'PROD';

-- Set default for all existing institutes
UPDATE institutes SET lead_tag = 'PROD' WHERE lead_tag IS NULL;
