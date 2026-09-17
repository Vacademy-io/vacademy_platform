ALTER TABLE ai_call_api_key ADD COLUMN IF NOT EXISTS api_key VARCHAR(255);
ALTER TABLE ai_call_api_key ALTER COLUMN api_key DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_call_api_key_plaintext ON ai_call_api_key (api_key);
