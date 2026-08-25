-- Scheduled reporting: run state + delivery audit.
--
-- report_run is one row per generated DOCUMENT, not per schedule: a subject-scoped
-- schedule across 30 subjects produces 30 rows (and, once Phase 2 wires billing,
-- 30 charges). Recipients do not multiply it — "2 credits per report to any number
-- of users" is expressed by charging on this table, never on the recipient table.
--
-- The unique index is the whole safety story. admin_core runs 4 replicas and jobs
-- retry, so without it a report is sent — and later charged — several times. It is
-- deliberately an expression index over COALESCE(scope_id,'') because scope_id is
-- NULL for institute-wide runs and NULLs do not collide in a plain unique index,
-- which would defeat the guarantee for exactly the most common case.

CREATE TABLE IF NOT EXISTS report_run (
    id                 VARCHAR(255) PRIMARY KEY,
    institute_id       VARCHAR(255) NOT NULL,
    schedule_id        VARCHAR(255) NOT NULL,
    window_start       TIMESTAMPTZ  NOT NULL,
    window_end         TIMESTAMPTZ  NOT NULL,
    scope_type         VARCHAR(32)  NOT NULL,
    scope_id           VARCHAR(255),
    scope_label        VARCHAR(512),
    -- PENDING -> CHARGED -> SENT, or SKIPPED / FAILED. A retry resumes from the
    -- last recorded state so a crash between charge and send cannot double-charge.
    status             VARCHAR(32)  NOT NULL,
    skip_reason        VARCHAR(255),
    credits_charged    NUMERIC(12,2) DEFAULT 0,
    sections_included  TEXT,
    recipient_count    INTEGER      DEFAULT 0,
    named_learners     INTEGER      DEFAULT 0,
    error_message      TEXT,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_report_run_idempotency
    ON report_run (schedule_id, window_start, COALESCE(scope_id, ''));

CREATE INDEX IF NOT EXISTS idx_report_run_institute_created
    ON report_run (institute_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_report_run_status
    ON report_run (status);

-- Delivery audit. Mandatory rather than nice-to-have: reports name students, so
-- there must always be an answer to "who received my child's name, and when".
-- Surfaced to the institute admin, not just kept internally.
CREATE TABLE IF NOT EXISTS report_run_recipient (
    id                 VARCHAR(255) PRIMARY KEY,
    run_id             VARCHAR(255) NOT NULL REFERENCES report_run (id) ON DELETE CASCADE,
    user_id            VARCHAR(255),
    email              VARCHAR(512),
    role               VARCHAR(64),
    -- Sections that survived this recipient's role filter — two people can receive
    -- materially different documents from one run, and the audit must show which.
    sections_sent      TEXT,
    named_learners     INTEGER      DEFAULT 0,
    delivered          BOOLEAN      NOT NULL DEFAULT FALSE,
    error_message      TEXT,
    created_at         TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_report_run_recipient_run
    ON report_run_recipient (run_id);

CREATE INDEX IF NOT EXISTS idx_report_run_recipient_user
    ON report_run_recipient (user_id, created_at DESC);
