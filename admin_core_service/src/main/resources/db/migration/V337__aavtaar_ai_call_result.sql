-- =============================================================================
-- Aavtaar AI-calling: end-of-call webhook landing zone.
--
-- Aavtaar (an autonomous AI voice agent, Plivo-backed) POSTs a SINGLE report
-- AFTER each call ends — there are no per-state events. Unlike the Exotel flow
-- (where we create the telephony_call_log row first and the provider posts back
-- against our correlation id), an Aavtaar call — especially INBOUND — usually
-- has no pre-existing row. So this table is a standalone, idempotent landing
-- zone: every payload is captured here keyed by Aavtaar's call_uuid, the raw
-- body is always retained, and later phases promote it to telephony_call_log +
-- bind it to a lead + resume the workflow.
--
-- See docs/crm/AAVTAAR_AI_CALLING.md.
-- =============================================================================

CREATE TABLE ai_call_result (
    id                     VARCHAR(36)  PRIMARY KEY,
    provider               VARCHAR(32)  NOT NULL DEFAULT 'AAVTAAR',
    -- Aavtaar/Plivo call id. The idempotency key for re-POSTs. Nullable so a
    -- malformed payload is still captured (partial unique index skips nulls).
    call_uuid              VARCHAR(64),
    -- Tenant. Carried on the webhook URL (?instituteId=) we hand Aavtaar.
    institute_id           VARCHAR(36),
    -- Set when this result is promoted to a telephony_call_log row (later phase).
    call_log_id            VARCHAR(36),
    -- Set when the call was workflow-driven (outbound) — drives the resume bridge.
    workflow_execution_id  VARCHAR(36),
    -- Our reference echoed back in metadata{} on outbound calls (correlation).
    correlation_id         VARCHAR(64),

    direction              VARCHAR(16),
    campaign_type          VARCHAR(32),
    campaign_id            VARCHAR(64),
    phone_number           VARCHAR(20),
    dial_code              VARCHAR(8),
    call_retry             INTEGER,
    customer_name          VARCHAR(255),
    customer_email         VARCHAR(255),

    status                 VARCHAR(32),
    disposition            VARCHAR(64),
    lead_response          VARCHAR(64),
    lead_rating            INTEGER,
    call_rating            INTEGER,
    interest_level         VARCHAR(64),
    ai_summary             TEXT,
    -- Structured Q&A the bot extracted (Child's Class, Marks, Program Discussed,
    -- Key Concern, …). Campaign-specific keys, so kept as JSON, not columns.
    extracted_qa           JSONB,
    -- Our metadata bag echoed back (when Aavtaar supports it) — kept verbatim.
    metadata               JSONB,

    callback               BOOLEAN,
    callback_at            TIMESTAMPTZ,
    callback_time_text     VARCHAR(128),

    transfer_call          BOOLEAN,
    nine_pressed           BOOLEAN,
    transfer_status        VARCHAR(64),
    transfer_triggered     VARCHAR(64),

    hangup_cause           VARCHAR(64),
    hangup_code            INTEGER,
    hangup_source          VARCHAR(32),

    recording_url          TEXT,
    duration_seconds       INTEGER,
    call_start             TIMESTAMPTZ,
    transcript             TEXT,

    -- Entire original POST body, always retained even if parsing partially fails.
    raw_payload            TEXT         NOT NULL,
    -- RECEIVED → (later) PROCESSED / FAILED, for the downstream promoter job.
    processing_status      VARCHAR(24)  NOT NULL DEFAULT 'RECEIVED',

    received_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Idempotency: a re-POST of the same call updates in place. Partial so the rare
-- null-uuid (unparseable) row is still inserted rather than rejected.
CREATE UNIQUE INDEX uk_acr_provider_call_uuid
    ON ai_call_result(provider, call_uuid)
    WHERE call_uuid IS NOT NULL;

CREATE INDEX idx_acr_institute   ON ai_call_result(institute_id, received_at DESC);
CREATE INDEX idx_acr_phone       ON ai_call_result(phone_number);
-- Powers the (later) promoter job that drains RECEIVED rows.
CREATE INDEX idx_acr_processing  ON ai_call_result(processing_status, received_at)
    WHERE processing_status = 'RECEIVED';
-- Resume bridge: find the result for a workflow-driven outbound call.
CREATE INDEX idx_acr_exec        ON ai_call_result(workflow_execution_id)
    WHERE workflow_execution_id IS NOT NULL;
