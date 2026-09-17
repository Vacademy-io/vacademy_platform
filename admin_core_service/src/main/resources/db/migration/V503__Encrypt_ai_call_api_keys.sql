-- ================================================================================
-- V500: External AI-Calling API keys
-- ================================================================================
--
-- Lets any client use the AI-calling platform programmatically (click-to-call,
-- bulk call, call status) with an issued key instead of a Vacademy JWT.
--
-- The plaintext key is shown exactly once at issue time and NEVER stored — this
-- table holds only its SHA-256 hash. That means a leaked database dump cannot be
-- replayed against the public calling API, in the same way a password hash
-- protects a login. The trade-off is deliberate: a lost key must be revoked and
-- re-issued, not "recovered".
--
-- key_prefix (the first characters of the plaintext) IS stored in the clear so
-- the admin portal can show "vak_live_ab12…" and the operator can tell keys
-- apart without the secret.
--
-- Each key is bound to ONE institute: every call placed and every status read
-- through it is scoped to that institute, so a client can never dial on another
-- tenant's credits or read another tenant's call logs. This is the same guard
-- InstituteAccessValidator applies to JWT callers — the API key replaces the
-- JWT, not the tenancy check.
-- ================================================================================

CREATE TABLE IF NOT EXISTS ai_call_api_key (
    id            VARCHAR(50) PRIMARY KEY,
    institute_id  VARCHAR(50) NOT NULL,
    key_name      VARCHAR(100),                    -- operator label, e.g. "client-xyz production"
    key_prefix    VARCHAR(16)  NOT NULL,           -- visible head of the plaintext, for identification
    api_key_encrypted TEXT NOT NULL,               -- encrypted full key
    status        VARCHAR(20)  NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE | REVOKED
    created_by    VARCHAR(50),                     -- admin user id that issued it
    created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
    last_used_at  TIMESTAMPTZ,                     -- best-effort stamp on each authenticated call
    revoked_at    TIMESTAMPTZ
);

-- The presented key is hashed and looked up by hash — this index IS the auth path.
CREATE INDEX IF NOT EXISTS ix_ai_call_api_key_institute
    ON ai_call_api_key (institute_id);

COMMENT ON TABLE ai_call_api_key IS
    'API keys for the external AI-Calling API (/admin-core-service/open/ai-calling/v1); stores SHA-256 hashes only, plaintext shown once at issue';

ALTER TABLE ai_call_api_key ADD COLUMN IF NOT EXISTS api_key VARCHAR(255);
ALTER TABLE ai_call_api_key ALTER COLUMN api_key DROP NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS ux_ai_call_api_key_plaintext ON ai_call_api_key (api_key);
