-- =============================================================================
-- Airtel IQ Business Connect (Vonage VBC) — CCR/CDR-to-S3 import landing zone.
--
-- Airtel exports, to an S3 bucket WE own (vacademy-airtel-ccr), under a
-- <YYYYMMDD>/<accountId>/ key prefix, two streams:
--   • Cdr/<uuid>.json              — one Call Detail Record per call (all calls)
--   • Rec/<uuid>.mp3 + <uuid>_metadata.csv — recording audio + metadata sidecar
--                                    (only calls a recording rule captured)
--
-- Unlike the Exotel flow (where we create the telephony_call_log row first and
-- the provider posts back against our correlation id), these land asynchronously
-- and, critically, telephony_call_log requires a NON-NULL counsellor_user_id +
-- user_id (lead) — which we can't resolve until (a) the Airtel adapter places
-- calls through us, and (b) an extension->counsellor map exists. So this is a
-- standalone, idempotent LANDING ZONE keyed by the S3 object key: every object
-- is captured here, and a later promoter resolves institute (account_id) +
-- counsellor (source_extension) + lead (counterparty) and promotes/enriches a
-- telephony_call_log row, attaching the recording.
--
-- Mirrors the ai_call_result pattern (V337). See docs/crm/VONAGE_VBC_INTEGRATION.md.
-- =============================================================================

CREATE TABLE airtel_call_import (
    id                       VARCHAR(36)  PRIMARY KEY,
    -- 'CDR' (a Cdr/*.json) | 'RECORDING' (a Rec/*.mp3, with its _metadata.csv sidecar)
    kind                     VARCHAR(16)  NOT NULL,
    -- The S3 object key. Idempotency key — a re-poll of the same object is a no-op.
    -- For RECORDING this is the .mp3 key.
    s3_key                   VARCHAR(512) NOT NULL,
    -- Airtel VBC account number carried in the S3 path (.../<accountId>/...), e.g. 439357.
    account_id               VARCHAR(32),
    -- Resolved at promotion (account_id -> institute_telephony_config). Nullable here.
    institute_id             VARCHAR(36),

    -- CDR identity (from the JSON).
    call_id                  VARCHAR(64),   -- CDR "callId" (== the json filename)
    cdr_id                   VARCHAR(64),   -- CDR "cdrId"
    -- RECORDING identity (the mp3 uuid; recordings carry NO callId, matched by attributes).
    recording_object_id      VARCHAR(64),

    direction                VARCHAR(16),   -- INBOUND | OUTBOUND
    disposition              VARCHAR(128),  -- free-ish text, e.g. Answered / Caller Abandoned …
    source_extension         VARCHAR(32),   -- counsellor extension (e.g. 447)
    source_user_id           VARCHAR(64),   -- Airtel user id (e.g. SauravSN)
    source_user_full_name    VARCHAR(255),  -- counsellor display name
    caller_id_number         VARCHAR(32),
    -- The external party (the lead) as given by Airtel (E.164-ish, varies by field).
    counterparty_number      VARCHAR(32),
    -- Last-10 digits of the lead number — the join key for matching (India: full mobile).
    counterparty_msisdn10    VARCHAR(10),
    date_start               TIMESTAMPTZ,
    date_end                 TIMESTAMPTZ,
    duration_seconds         INTEGER,
    is_recorded              BOOLEAN,

    -- Set after we copy the mp3 into media_service (RECORDING rows only).
    recording_storage_key    VARCHAR(255),
    recording_length_seconds INTEGER,

    -- Full original object body (json text / csv text) — always retained.
    raw_payload              TEXT         NOT NULL,
    -- RECEIVED -> PROMOTED / FAILED / SKIPPED, for the (later) promoter job.
    processing_status        VARCHAR(24)  NOT NULL DEFAULT 'RECEIVED',
    process_detail           TEXT,
    -- Set when promoted/bound to a telephony_call_log row (later phase).
    call_log_id              VARCHAR(36),

    received_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Idempotency: one row per S3 object; a re-poll updates in place / is skipped.
CREATE UNIQUE INDEX uk_aci_s3_key ON airtel_call_import(s3_key);
-- Powers the (later) promoter draining RECEIVED rows oldest-first.
CREATE INDEX idx_aci_processing ON airtel_call_import(processing_status, received_at)
    WHERE processing_status = 'RECEIVED';
-- CDR <-> our outbound row correlation by Airtel call id.
CREATE INDEX idx_aci_call_id ON airtel_call_import(call_id) WHERE call_id IS NOT NULL;
-- Recording <-> call attribute match (lead number + time).
CREATE INDEX idx_aci_msisdn ON airtel_call_import(counterparty_msisdn10, date_start);
CREATE INDEX idx_aci_account ON airtel_call_import(account_id, received_at DESC);
