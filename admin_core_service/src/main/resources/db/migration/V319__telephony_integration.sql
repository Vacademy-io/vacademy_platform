-- =============================================================================
-- Telephony integration: provider config, ExoPhones, call log.
--
-- All three tables ship as one migration because they form a single feature
-- and have hard FK dependencies (numbers → config, call_log → numbers).
-- Splitting them across migrations would mean intermediate states where the
-- code can't run because table B references table A that doesn't exist yet.
--
-- Layout mirrors the SOLID core in features/telephony — see
-- docs/EXOTEL_CALL_INTEGRATION.md for the full design.
-- =============================================================================


-- ── 1. Per-institute provider configuration ─────────────────────────────────
-- Provider-neutral on purpose: Exotel today, Plivo / Twilio / Knowlarity
-- tomorrow. The api_username / api_password / api_account_id columns map to
-- whatever the provider calls its HTTP-Basic-Auth pair + account id:
--   Exotel:  api_account_id = Account SID, api_username = "API Key", api_password = "API Token"
--   Plivo:   api_account_id = Auth ID,     api_username = Auth ID,    api_password = Auth Token
CREATE TABLE institute_telephony_config (
    id                     VARCHAR(36)  PRIMARY KEY,
    institute_id           VARCHAR(36)  NOT NULL UNIQUE,
    provider_type          VARCHAR(32)  NOT NULL,
    api_account_id         VARCHAR(128) NOT NULL,
    api_username_enc       TEXT         NOT NULL,
    api_password_enc       TEXT         NOT NULL,
    -- Optional: when set, every incoming Exotel StatusCallback must carry
    -- ?token=<this-secret>. When NULL, the institute is in "open webhook"
    -- mode and we accept all callbacks for that institute's calls (still
    -- matched by our own ?corr= correlation id). Useful for dev / local
    -- testing where managing a shared secret is friction.
    webhook_token_enc      TEXT,
    record_calls           BOOLEAN      NOT NULL DEFAULT TRUE,
    default_selector_key   VARCHAR(32)  NOT NULL DEFAULT 'STICKY_PER_LEAD',
    enabled                BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_itc_institute_enabled
    ON institute_telephony_config(institute_id, enabled);


-- ── 2. One row per ExoPhone (or equivalent number) ──────────────────────────
-- Multiple numbers per institute. Selector strategies route between them:
--   STICKY_PER_LEAD  - reuse last number this lead saw
--   ROUND_ROBIN      - rotate by priority then id
--   REGION_MATCH     - match lead's STD/country code to `region`
CREATE TABLE telephony_provider_number (
    id                       VARCHAR(36) PRIMARY KEY,
    config_id                VARCHAR(36) NOT NULL,
    institute_id             VARCHAR(36) NOT NULL,
    provider_type            VARCHAR(32) NOT NULL,
    phone_number             VARCHAR(20) NOT NULL,
    provider_resource_id     VARCHAR(64),
    label                    VARCHAR(64),
    region                   VARCHAR(64),
    priority                 INT         NOT NULL DEFAULT 100,
    enabled                  BOOLEAN     NOT NULL DEFAULT TRUE,
    created_at               TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP   NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tpn_config FOREIGN KEY (config_id) REFERENCES institute_telephony_config(id)
);

CREATE INDEX idx_tpn_institute_enabled ON telephony_provider_number(institute_id, enabled);
CREATE INDEX idx_tpn_config_enabled    ON telephony_provider_number(config_id, enabled);
CREATE UNIQUE INDEX uk_tpn_config_number
    ON telephony_provider_number(config_id, phone_number);


-- ── 3. One row per call attempt ─────────────────────────────────────────────
-- id = our correlation UUID, generated before we hit the provider, used as
-- the ?corr= query param on the StatusCallback URL so the webhook can match
-- by PK even if the provider hasn't given us their CallSid yet.
CREATE TABLE telephony_call_log (
    id                       VARCHAR(36) PRIMARY KEY,
    institute_id             VARCHAR(36) NOT NULL,
    provider_type            VARCHAR(32) NOT NULL,
    provider_call_id         VARCHAR(64),
    provider_number_id       VARCHAR(36),
    response_id              VARCHAR(36),
    user_id                  VARCHAR(36) NOT NULL,
    counsellor_user_id       VARCHAR(36) NOT NULL,
    direction                VARCHAR(16) NOT NULL,
    from_number              VARCHAR(20),
    to_number                VARCHAR(20),
    caller_id                VARCHAR(20),
    status                   VARCHAR(24) NOT NULL,
    termination_reason       VARCHAR(48),
    start_time               TIMESTAMP,
    answer_time              TIMESTAMP,
    end_time                 TIMESTAMP,
    duration_seconds         INTEGER,
    price                    NUMERIC(8,4),
    recording_url            TEXT,
    recording_storage_key    VARCHAR(255),
    recording_fetch_attempts INTEGER NOT NULL DEFAULT 0,
    recording_logged         BOOLEAN NOT NULL DEFAULT FALSE,
    raw_payload_json         TEXT,
    created_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_tcl_number FOREIGN KEY (provider_number_id) REFERENCES telephony_provider_number(id)
);

CREATE UNIQUE INDEX uk_tcl_provider_call
    ON telephony_call_log(provider_type, provider_call_id)
    WHERE provider_call_id IS NOT NULL;
CREATE INDEX idx_tcl_user       ON telephony_call_log(user_id, created_at DESC);
CREATE INDEX idx_tcl_response   ON telephony_call_log(response_id, created_at DESC);
CREATE INDEX idx_tcl_counsellor ON telephony_call_log(counsellor_user_id, created_at DESC);
CREATE INDEX idx_tcl_institute  ON telephony_call_log(institute_id, created_at DESC);
-- Powers STICKY_PER_LEAD: most recent number-id this lead saw.
-- Partial — the lookup query has provider_number_id IS NOT NULL in its WHERE
-- clause, so a partial index skips null rows entirely.
CREATE INDEX idx_tcl_sticky
    ON telephony_call_log(user_id, provider_number_id, created_at DESC)
    WHERE provider_number_id IS NOT NULL;
