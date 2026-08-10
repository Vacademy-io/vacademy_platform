-- Offline Content Download & Sync -- Part A4: idempotent batched sync ingestion.
--
-- offline_sync_event is the dedup ledger for the offline sync batch endpoint.
-- It is NOT the same thing as activity_log's client-id upsert (that is
-- merge semantics for a single evolving activity); this ledger exists so a
-- retried batch (same clientEventId set) can be replayed any number of times
-- without double-dispatching to the tracking services underneath, including
-- the delete-then-insert quiz/question paths that are not otherwise
-- replay-safe. See OfflineSyncService / OfflineSyncEventProcessor.
--
-- Terminal states are ACCEPTED and DUPLICATE (DUPLICATE is a response-only
-- status, never persisted -- see the service). FAILED rows are NOT terminal:
-- OfflineSyncEventProcessor re-attempts dispatch for a retried clientEventId
-- whose stored status is FAILED.
CREATE TABLE IF NOT EXISTS offline_sync_event (
    client_event_id     VARCHAR(255) PRIMARY KEY,
    device_id            VARCHAR(255) NOT NULL,
    user_id               VARCHAR(255) NOT NULL,
    seq                   BIGINT,
    client_ts             TIMESTAMP,
    event_type            VARCHAR(32)  NOT NULL,
    slide_id              VARCHAR(255),
    package_session_id    VARCHAR(255),
    status                VARCHAR(16)  NOT NULL DEFAULT 'ACCEPTED', -- ACCEPTED | FAILED
    error_code            VARCHAR(64),
    processed_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Sort-and-replay ordering per device (A4 processing step 2: sort by
-- (seq, clientTs) before dispatch) and the monotonic-position-write guard
-- (MAX(client_ts) of ACCEPTED rows for a device+slide).
CREATE INDEX IF NOT EXISTS idx_offline_sync_event_device_seq
    ON offline_sync_event (device_id, seq);

CREATE INDEX IF NOT EXISTS idx_offline_sync_event_device_slide_status
    ON offline_sync_event (device_id, slide_id, status);

-- Field-level differences between what an offline client claimed (tampered
-- or simply stale local scoring) and what the server's re-scoring computed
-- for QUESTION/QUIZ replay -- see OfflineQuizRescoringService. Reviewed by
-- admins via AdminOfflineTelemetryController.
CREATE TABLE IF NOT EXISTS offline_sync_discrepancy (
    id                    VARCHAR(255) PRIMARY KEY,
    client_event_id       VARCHAR(255),
    activity_id           VARCHAR(255),
    user_id               VARCHAR(255) NOT NULL,
    slide_id              VARCHAR(255),
    package_session_id    VARCHAR(255),
    question_id           VARCHAR(255),
    field                 VARCHAR(64)  NOT NULL,
    client_value          VARCHAR(500),
    server_value          VARCHAR(500),
    status                VARCHAR(16)  NOT NULL DEFAULT 'OPEN', -- OPEN | REVIEWED
    created_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_offline_sync_discrepancy_package_session_status
    ON offline_sync_discrepancy (package_session_id, status);
