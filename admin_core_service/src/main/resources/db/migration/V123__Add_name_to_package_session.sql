-- V123: Add 'name' column to package_session for subgroup/batch naming
-- Safe and backward compatible: nullable and IF NOT EXISTS.

ALTER TABLE package_session
ADD COLUMN IF NOT EXISTS name VARCHAR(255);

