-- V386: Engagement Engines — Phase 1a (the brain, read-only: decisions become tasks).
-- Design: docs/engagement/ENGAGEMENT_ENGINES.md. Companion: notification_service V31
-- (notification_log.correlation_id — engagement_action.id is the correlation key).

CREATE TABLE IF NOT EXISTS engagement_engine (
    id                VARCHAR(255) PRIMARY KEY,
    institute_id      VARCHAR(255) NOT NULL,
    name              VARCHAR(255) NOT NULL,
    objective         TEXT,
    status            VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',  -- DRAFT|TEMPLATES_PENDING|DRY_RUN|ACTIVE|PAUSED|ARCHIVED
    language          VARCHAR(10)  NOT NULL DEFAULT 'en',     -- en | hi | hinglish
    data_points       JSONB        NOT NULL DEFAULT '[]',
    channels          JSONB        NOT NULL DEFAULT '{}',     -- {WHATSAPP:{enabled,auto,autoReply},EMAIL:{...},IN_APP:{...},AI_CALL:{...}}
    audience          JSONB        NOT NULL DEFAULT '[]',     -- selectors: [{type:PACKAGE_SESSION|AUDIENCE|USER, id}]
    quiet_hours       JSONB        NOT NULL DEFAULT '{}',     -- {startHour,endHour,timezone} — may TIGHTEN the institute floor
    cadence_hours     INT          NOT NULL DEFAULT 72,       -- default re-check cadence; the prompt may shorten per decision
    next_due_at       TIMESTAMP,                              -- driver cursor: institute selection is O(engines)
    last_swept_at     TIMESTAMP,
    created_by        VARCHAR(255),
    created_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at        TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ee_due ON engagement_engine (next_due_at)
    WHERE status IN ('ACTIVE', 'DRY_RUN');
CREATE INDEX IF NOT EXISTS idx_ee_institute ON engagement_engine (institute_id);

CREATE TABLE IF NOT EXISTS engagement_member (
    id                   VARCHAR(255) PRIMARY KEY,
    engine_id            VARCHAR(255) NOT NULL,
    institute_id         VARCHAR(255) NOT NULL,
    user_id              VARCHAR(255),           -- NULLABLE: an unconverted lead has no user_id
    audience_response_id VARCHAR(255),           -- the lead row when the subject is a lead
    status               VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',  -- ACTIVE|PAUSED|EXITED|OPTED_OUT
    tier                 SMALLINT    NOT NULL DEFAULT 2,          -- 0 HOT .. 3 DORMANT
    next_action_at       TIMESTAMP   NOT NULL,
    last_decided_at      TIMESTAMP,
    consecutive_no_ops   SMALLINT    NOT NULL DEFAULT 0,
    wake_fingerprint     VARCHAR(64),            -- QUANTIZED feature hash (bands, never raw values)
    window_open_until    TIMESTAMP,              -- WhatsApp 24h reply window
    memory_json          JSONB       NOT NULL DEFAULT '{}',
    created_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at           TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_em_subject CHECK (user_id IS NOT NULL OR audience_response_id IS NOT NULL)
);
-- NULLs are DISTINCT in Postgres: a naive UNIQUE(engine_id, user_id) would let the same
-- unconverted lead (user_id NULL) enrol N times = N independent decisions = N messages.
CREATE UNIQUE INDEX IF NOT EXISTS ux_em_subject ON engagement_member
    (engine_id, COALESCE(user_id, ''), COALESCE(audience_response_id, ''));
CREATE INDEX IF NOT EXISTS idx_em_due ON engagement_member (engine_id, tier, next_action_at)
    WHERE status = 'ACTIVE';
CREATE INDEX IF NOT EXISTS idx_em_subject_user ON engagement_member (institute_id, user_id)
    WHERE user_id IS NOT NULL;

-- decision = ledger = task = audit: ONE row. id doubles as notification_log.correlation_id.
CREATE TABLE IF NOT EXISTS engagement_action (
    id                 VARCHAR(255) PRIMARY KEY,
    engine_id          VARCHAR(255) NOT NULL,
    member_id          VARCHAR(255) NOT NULL,
    institute_id       VARCHAR(255) NOT NULL,
    prompt_version_id  VARCHAR(255),
    kind               VARCHAR(20) NOT NULL,    -- SEND|TASK|REPLY|NO_OP
    action_type        VARCHAR(30),             -- SEND_MESSAGE|SHARE_LINK|CALL|BOOK_MEETING|UPDATE_CRM
    channel            VARCHAR(20),             -- WHATSAPP|EMAIL|IN_APP|AI_CALL
    status             VARCHAR(20) NOT NULL,    -- PENDING|DISPATCHING|SENT|FAILED|UNKNOWN|SIMULATED|OPEN|ACKED|DONE|DISMISSED|EXPIRED
    assigned_to        VARCHAR(255),            -- NULL in Phase 1 (unassigned institute-wide inbox)
    template_name      VARCHAR(255),
    variables_json     JSONB,
    draft_body         TEXT,                    -- the human-editable draft
    sent_body          TEXT,                    -- what actually went out (EDITED label source)
    rationale          TEXT,                    -- "why did it decide this?" — the trust surface
    priority           NUMERIC(5,2),
    scheduled_for      TIMESTAMP,
    expires_at         TIMESTAMP,
    dispatched_at      TIMESTAMP,
    completed_at       TIMESTAMP,
    outcome            VARCHAR(30),             -- ACCEPTED|EDITED|DISMISSED|ESCALATED
    error_message      TEXT,
    llm_tokens_in      INT,
    llm_tokens_out     INT,
    created_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ea_inbox ON engagement_action
    (institute_id, status, priority DESC, scheduled_for)
    WHERE kind IN ('TASK', 'REPLY');
CREATE INDEX IF NOT EXISTS idx_ea_member ON engagement_action (member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ea_engine ON engagement_action (engine_id, created_at DESC);

CREATE TABLE IF NOT EXISTS engagement_prompt_version (
    id            VARCHAR(255) PRIMARY KEY,
    engine_id     VARCHAR(255) NOT NULL,
    institute_id  VARCHAR(255) NOT NULL,
    version       INT  NOT NULL,
    base_text     TEXT NOT NULL,          -- IMMUTABLE: the admin's original brief, never re-summarized
    delta_text    TEXT,                   -- what the admin typed THIS time
    compiled_text TEXT NOT NULL,          -- base + deltas, deterministically assembled
    source        VARCHAR(20) NOT NULL,   -- ADMIN|AUTOTUNE
    status        VARCHAR(20) NOT NULL,   -- ACTIVE|SHADOW|SUPERSEDED|REJECTED
    created_by    VARCHAR(255),
    created_at    TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS ux_epv ON engagement_prompt_version (engine_id, version);

-- Phase 1b's template negotiation state machine (table now; wired in 1b).
CREATE TABLE IF NOT EXISTS engagement_template_proposal (
    id                        VARCHAR(255) PRIMARY KEY,
    engine_id                 VARCHAR(255) NOT NULL,
    institute_id              VARCHAR(255) NOT NULL,
    notification_template_id  VARCHAR(255),
    name                      VARCHAR(255),
    language                  VARCHAR(10),
    proposed_body             TEXT NOT NULL,
    proposed_category         VARCHAR(20) NOT NULL,   -- AI proposes; a human ALWAYS confirms
    meta_category             VARCHAR(20),            -- what Meta actually assigned — may differ
    status                    VARCHAR(30) NOT NULL,   -- AI_PROPOSED|USER_APPROVED|SUBMITTED|META_PENDING|META_APPROVED|META_REJECTED|META_RECATEGORISED|USER_REVIEW|SUPERSEDED|WITHDRAWN
    rejection_reason          TEXT,
    round                     INT NOT NULL DEFAULT 1,
    created_by                VARCHAR(255),
    created_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at                TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_etp_engine ON engagement_template_proposal (engine_id, status);
