-- =============================================================================
-- V346: Manual call disposition for the team calling dashboard.
--
-- Until now the ONLY call with an outcome was an AI (Aavtaar) call — its
-- disposition arrives on the end-of-call webhook and lives in
-- ai_call_result.disposition. A human (Exotel/Airtel) call has a system status
-- (COMPLETED / NO_ANSWER / …) but NO human-set outcome.
--
-- The calling dashboard adds a "quick disposition" a counsellor sets AFTER a
-- call ("Interested", "Callback", "RNR", "Wrong Number", …). This migration:
--   1. a per-institute call-outcome vocabulary (call_disposition_catalog), each
--      outcome optionally mapped to a lead_status so setting it auto-advances the
--      lead's pipeline status everywhere (audience_response + user_lead_profile +
--      history + workflow trigger) via the existing LeadStatusService rails;
--   2. the disposition + callback columns ON the call-log row itself (the human
--      disposition is authoritative & operational; the AI's stays in
--      ai_call_result and is surfaced read-time as today);
--   3. indexes for the team dashboard's institute+time scan and the
--      "callbacks due" worklist chip.
--
-- NOTE: the "view full numbers" gate (VIEW_CALL_NUMBERS) is a JWT authority
-- granted to roles in auth_service — NOT a row here, so there is nothing to seed.
-- The catalog is seeded lazily per-institute on first use (institutes are
-- created dynamically), not globally here.
-- =============================================================================

CREATE TABLE call_disposition_catalog (
    id                     VARCHAR(36)  PRIMARY KEY,
    institute_id           VARCHAR(36)  NOT NULL,
    -- Stable code, e.g. INTERESTED / CALLBACK / RNR / WRONG_NUMBER / NOT_INTERESTED.
    disposition_key        VARCHAR(64)  NOT NULL,
    label                  VARCHAR(128) NOT NULL,
    color                  VARCHAR(20),
    -- Grouping for the UI + the dashboard chips. CALLBACK-category outcomes feed
    -- the "callbacks due" worklist; NOT_CONNECTED ones are RNR/Busy/etc.
    category               VARCHAR(24)  NOT NULL DEFAULT 'OTHER',
                           -- CONNECTED | NOT_CONNECTED | CALLBACK | OTHER
    -- Optional mapping: when set, choosing this disposition routes the lead to
    -- this lead_status via LeadStatusService.changeLeadStatus (one authoritative
    -- write that mirrors response + profile + history + trigger). NULL = the
    -- disposition is recorded on the call but never touches lead status.
    maps_to_lead_status_id VARCHAR(36),
    display_order          INTEGER      NOT NULL DEFAULT 0,
    is_active              BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at             TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- One row per (institute, key). Re-seeding / upserts are idempotent on this.
CREATE UNIQUE INDEX uk_cdc_institute_key
    ON call_disposition_catalog(institute_id, disposition_key);

-- Picker / filter-options read: active outcomes for an institute in display order.
CREATE INDEX idx_cdc_institute
    ON call_disposition_catalog(institute_id, display_order)
    WHERE is_active = TRUE;

-- -----------------------------------------------------------------------------
-- Manual disposition + callback ON the call-log row.
-- -----------------------------------------------------------------------------
ALTER TABLE telephony_call_log
    ADD COLUMN disposition_key   VARCHAR(64),   -- references call_disposition_catalog.disposition_key (per institute)
    ADD COLUMN disposition_notes TEXT,
    ADD COLUMN dispositioned_by  VARCHAR(36),   -- counsellor/leader user_id who set it
    ADD COLUMN dispositioned_at  TIMESTAMP,
    -- Promised call-back time (human "Callback" disposition). The AI equivalent
    -- stays in ai_call_result.callback_at; the dashboard COALESCEs the two.
    ADD COLUMN callback_at       TIMESTAMP;

-- Team-dashboard backbone: institute + time-window scan (the search/metrics
-- queries filter on institute_id and COALESCE(start_time, created_at)).
CREATE INDEX idx_tcl_institute_created
    ON telephony_call_log(institute_id, created_at DESC);

-- "Callbacks due" worklist chip: only rows that actually promised a call-back.
CREATE INDEX idx_tcl_callback_due
    ON telephony_call_log(institute_id, callback_at)
    WHERE callback_at IS NOT NULL;
