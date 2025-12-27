-- Add drip_condition_json column to package, chapter, and slide tables
-- for content dripping functionality

-- Add to package table
ALTER TABLE package ADD COLUMN drip_condition_json TEXT;

-- Add to chapter table
ALTER TABLE chapter ADD COLUMN drip_condition_json TEXT;

-- Add to slide table
ALTER TABLE slide ADD COLUMN drip_condition_json TEXT;
