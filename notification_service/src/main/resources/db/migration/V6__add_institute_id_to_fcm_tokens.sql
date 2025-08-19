-- Add institute_id to fcm_tokens for multi-tenant Firebase support
ALTER TABLE fcm_tokens
    ADD COLUMN IF NOT EXISTS institute_id VARCHAR(255);

CREATE INDEX IF NOT EXISTS idx_fcm_tokens_institute_id ON fcm_tokens(institute_id);

