-- =============================================================================
-- Per-counsellor provider endpoint mapping.
--
-- Providers without a shared number pool (Airtel/Vonage VBC) give each counsellor
-- their OWN extension + DID. We need that mapping in two places:
--   • Outbound: the origination resolver turns counsellor_user_id → the `from`
--     extension + caller-ID DID for click2dial.
--   • Promotion: the CDR/recording importer turns an Airtel extension /
--     sourceUserId back into our counsellor_user_id to attribute the call.
--
-- Exotel (pooled) doesn't use this table. See docs/crm/AIRTEL_VBC_INTEGRATION_STATUS.md.
-- =============================================================================

CREATE TABLE telephony_counsellor_endpoint (
    id                  VARCHAR(36) PRIMARY KEY,
    institute_id        VARCHAR(36) NOT NULL,
    counsellor_user_id  VARCHAR(36) NOT NULL,
    provider_type       VARCHAR(32) NOT NULL,
    -- Provider extension / SIP user (Airtel VBC extension, e.g. "447").
    extension           VARCHAR(32),
    -- Provider's own user id (Airtel `sourceUserId`, e.g. "SauravSN") — an
    -- alternate match key when a CDR carries the user id but not the extension.
    provider_user_id    VARCHAR(64),
    -- The DID the lead sees as caller-ID on an outbound call (optional).
    did                 VARCHAR(20),
    enabled             BOOLEAN NOT NULL DEFAULT TRUE,
    created_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    -- One endpoint per counsellor per provider.
    CONSTRAINT uk_tce_counsellor UNIQUE (counsellor_user_id, provider_type)
);

CREATE INDEX idx_tce_institute     ON telephony_counsellor_endpoint (institute_id, enabled);
CREATE INDEX idx_tce_extension     ON telephony_counsellor_endpoint (provider_type, extension)
    WHERE extension IS NOT NULL;
CREATE INDEX idx_tce_provider_user ON telephony_counsellor_endpoint (provider_type, provider_user_id)
    WHERE provider_user_id IS NOT NULL;
