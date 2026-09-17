ALTER TABLE ai_call_api_key ADD COLUMN IF NOT EXISTS api_key_encrypted TEXT;

-- Existing hashed keys cannot be recovered. They remain for rollback/audit; keys
-- are re-issued into the encrypted column after deployment.
