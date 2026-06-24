-- =============================================================================
-- Telephony: make the per-institute credential model provider-agnostic.
--
-- Until now institute_telephony_config hard-coded Exotel's HTTP-Basic triplet
-- (api_account_id / api_username_enc / api_password_enc), all NOT NULL. A second
-- provider (Airtel/Vonage VBC) authenticates completely differently — an OAuth2
-- password grant with a consumerKey/consumerSecret pair against a separate token
-- host — and has nowhere to put those.
--
-- This migration adds a schema-driven credential model that every provider
-- shares, WITHOUT touching the Exotel rows:
--   * provider_secrets_enc — ONE AES-256-GCM-encrypted JSON blob {key -> value}
--     holding whatever secret fields the provider's adapter declares
--     (clientId/clientSecret/password/…). Encrypted as a single blob via the
--     existing TokenEncryptionService so we keep at-rest encryption without a
--     column per field.
--   * provider_config — non-secret JSON {key -> value} (region, base_url,
--     token_url, account_id, application_id, …). Plaintext on purpose: it is
--     not sensitive and the admin UI renders it back.
--   * auth_type — the provider's auth scheme (BASIC, OAUTH2_PASSWORD, …) so the
--     adapter/token-broker knows how to mint a token.
--
-- The legacy triplet stays (Exotel keeps using it) but is no longer mandatory,
-- so a non-Exotel row can be saved with only the generic columns populated.
-- See docs/crm/VONAGE_VBC_INTEGRATION.md.
-- =============================================================================

ALTER TABLE institute_telephony_config
    ADD COLUMN IF NOT EXISTS provider_secrets_enc TEXT;

ALTER TABLE institute_telephony_config
    ADD COLUMN IF NOT EXISTS provider_config TEXT;

ALTER TABLE institute_telephony_config
    ADD COLUMN IF NOT EXISTS auth_type VARCHAR(32);

-- The Exotel-shaped triplet is now optional — providers that use the generic
-- secrets blob leave these null. (DROP NOT NULL on an already-nullable column
-- is a no-op, so this stays idempotent across re-runs.)
ALTER TABLE institute_telephony_config ALTER COLUMN api_account_id   DROP NOT NULL;
ALTER TABLE institute_telephony_config ALTER COLUMN api_username_enc DROP NOT NULL;
ALTER TABLE institute_telephony_config ALTER COLUMN api_password_enc DROP NOT NULL;

COMMENT ON COLUMN institute_telephony_config.provider_secrets_enc IS
    'AES-256-GCM-encrypted JSON {credKey -> value} of provider secret fields (per the adapter ProviderConfigSchema). Replaces the Exotel-only api_*_enc triplet for new providers.';
COMMENT ON COLUMN institute_telephony_config.provider_config IS
    'Non-secret JSON {key -> value} provider config (region, base_url, token_url, account_id, application_id, …). Plaintext — rendered back by the admin UI.';
COMMENT ON COLUMN institute_telephony_config.auth_type IS
    'Provider auth scheme: BASIC (Exotel) | OAUTH2_PASSWORD (Vonage/Airtel VBC) | … — tells the token broker how to authenticate.';
