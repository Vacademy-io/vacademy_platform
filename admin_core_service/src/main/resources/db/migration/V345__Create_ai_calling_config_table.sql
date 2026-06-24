-- Aavtaar (AI-calling) credentials were reused into institute_telephony_config,
-- which is UNIQUE(institute_id) — so adding Aavtaar to an institute clobbered its
-- Airtel/Exotel row. Move AI-calling creds into their own table so an institute can
-- hold an outbound telephony provider AND one-or-more AI-calling accounts at once.
-- (The outbound telephony path is left completely untouched.)
CREATE TABLE IF NOT EXISTS ai_calling_config (
    id                  VARCHAR(36)  PRIMARY KEY,
    institute_id        VARCHAR(36)  NOT NULL,
    provider            VARCHAR(32)  NOT NULL DEFAULT 'AAVTAAR',
    company_code        VARCHAR(255) NOT NULL,
    token_enc           TEXT,
    webhook_secret_enc  TEXT,
    enabled             BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
    -- multiple accounts per provider, keyed by company code
    CONSTRAINT uq_ai_calling_config_account UNIQUE (institute_id, provider, company_code)
);
CREATE INDEX IF NOT EXISTS idx_ai_calling_config_active
    ON ai_calling_config (institute_id, provider, enabled);

-- Move existing Aavtaar configs over (company_code = api_account_id, token =
-- api_password_enc, webhook secret = webhook_token_enc), then free the institute's
-- telephony row so Airtel/Exotel can occupy it.
INSERT INTO ai_calling_config
    (id, institute_id, provider, company_code, token_enc, webhook_secret_enc, enabled, created_at, updated_at)
SELECT gen_random_uuid()::text, institute_id, 'AAVTAAR', api_account_id,
       api_password_enc, webhook_token_enc, COALESCE(enabled, TRUE), NOW(), NOW()
FROM institute_telephony_config
WHERE provider_type = 'AAVTAAR' AND api_account_id IS NOT NULL
ON CONFLICT (institute_id, provider, company_code) DO NOTHING;

DELETE FROM institute_telephony_config WHERE provider_type = 'AAVTAAR';
