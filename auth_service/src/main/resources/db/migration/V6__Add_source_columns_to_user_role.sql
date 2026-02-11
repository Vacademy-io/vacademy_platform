-- Add source tracking columns to user_role table
-- This enables tracking the origin of each role assignment (e.g., from audience campaigns, manual entry, referrals)

ALTER TABLE user_role
ADD COLUMN source_type VARCHAR(255),
ADD COLUMN source_id VARCHAR(255);

-- Add indexes for common queries
CREATE INDEX idx_user_role_source_type ON user_role(source_type);
CREATE INDEX idx_user_role_source_id ON user_role(source_id);

