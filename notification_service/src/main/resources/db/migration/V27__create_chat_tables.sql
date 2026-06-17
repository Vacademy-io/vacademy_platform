-- Conversation-centric chat: DM (1:1) + batch groups + institute community channel.
-- Layered on top of the existing announcement subsystem; reuses rich_text_data for message bodies
-- and SSEConnectionManager for real-time delivery. Timestamps are naive-UTC (TIMESTAMP, not TIMESTAMPTZ)
-- to honour the UTC-JVM invariant the rest of the platform relies on.

CREATE TABLE IF NOT EXISTS chat_conversations (
    id                      VARCHAR(255) PRIMARY KEY,
    type                    VARCHAR(32)  NOT NULL,            -- DIRECT | BATCH_GROUP | COMMUNITY
    institute_id            VARCHAR(255) NOT NULL,
    reference_id            VARCHAR(255),                     -- package_session_id for BATCH_GROUP
    pair_key                VARCHAR(512),                     -- canonical "<minUser>::<maxUser>" for DIRECT dedupe
    title                   VARCHAR(512),
    created_by              VARCHAR(255),
    is_active               BOOLEAN      NOT NULL DEFAULT TRUE,
    last_message_seq        BIGINT       NOT NULL DEFAULT 0,  -- per-conversation monotonic counter
    last_message_at         TIMESTAMP,
    last_message_preview    VARCHAR(512),
    last_message_sender_id  VARCHAR(255),
    rules                   JSONB,                            -- in-channel rules override; null = use institute defaults
    rules_version           INTEGER      NOT NULL DEFAULT 0,  -- bumped on any rules change -> forces re-acknowledgement
    created_at              TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at              TIMESTAMP    NOT NULL DEFAULT now()
);

-- One DM per ordered pair, one group per batch, one community per institute (race-safe).
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_conv_direct_pair   ON chat_conversations (institute_id, pair_key)     WHERE type = 'DIRECT';
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_conv_batch         ON chat_conversations (institute_id, reference_id) WHERE type = 'BATCH_GROUP';
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_conv_community     ON chat_conversations (institute_id)               WHERE type = 'COMMUNITY';
CREATE INDEX        IF NOT EXISTS idx_chat_conv_inst_lastmsg ON chat_conversations (institute_id, last_message_at DESC);


CREATE TABLE IF NOT EXISTS chat_conversation_members (
    id                          VARCHAR(255) PRIMARY KEY,
    conversation_id             VARCHAR(255) NOT NULL,
    user_id                     VARCHAR(255) NOT NULL,
    user_role                   VARCHAR(64),                  -- snapshot: STUDENT | TEACHER | ADMIN (normalized)
    member_role                 VARCHAR(32)  NOT NULL DEFAULT 'MEMBER', -- MEMBER | MODERATOR | OWNER
    last_read_seq               BIGINT       NOT NULL DEFAULT 0,
    last_read_message_id        VARCHAR(255),
    last_read_at                TIMESTAMP,
    muted                       BOOLEAN      NOT NULL DEFAULT FALSE,
    is_active                   BOOLEAN      NOT NULL DEFAULT TRUE,
    rules_acknowledged_version  INTEGER      NOT NULL DEFAULT 0, -- 0 = not yet acknowledged
    rules_acknowledged_at       TIMESTAMP,
    joined_at                   TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_member       ON chat_conversation_members (conversation_id, user_id);
CREATE INDEX        IF NOT EXISTS idx_chat_member_user ON chat_conversation_members (user_id, is_active);


CREATE TABLE IF NOT EXISTS chat_messages (
    id                  VARCHAR(255) PRIMARY KEY,
    conversation_id     VARCHAR(255) NOT NULL,
    sender_id           VARCHAR(255) NOT NULL,
    sender_name         VARCHAR(255),                         -- denormalized snapshot (survives deleted users)
    sender_role         VARCHAR(64),
    content_type        VARCHAR(32)  NOT NULL DEFAULT 'TEXT', -- TEXT | IMAGE | FILE
    rich_text_id        VARCHAR(255),                         -- FK rich_text_data (body)
    attachment_url      VARCHAR(2048),
    attachment_name     VARCHAR(512),
    attachment_mime     VARCHAR(128),
    attachment_size     BIGINT,
    reply_to_message_id VARCHAR(255),
    client_dedup_key    VARCHAR(255),
    seq                 BIGINT       NOT NULL,                -- per-conversation ordering key
    is_edited           BOOLEAN      NOT NULL DEFAULT FALSE,
    is_deleted          BOOLEAN      NOT NULL DEFAULT FALSE,
    is_flagged          BOOLEAN      NOT NULL DEFAULT FALSE,  -- auto-moderation hit
    flag_reason         VARCHAR(255),
    created_at          TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at          TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX        IF NOT EXISTS idx_chat_msg_conv_seq     ON chat_messages (conversation_id, seq);
CREATE INDEX        IF NOT EXISTS idx_chat_msg_conv_created ON chat_messages (conversation_id, created_at DESC, id DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_msg_dedup         ON chat_messages (conversation_id, sender_id, client_dedup_key) WHERE client_dedup_key IS NOT NULL;


CREATE TABLE IF NOT EXISTS chat_message_reports (
    id              VARCHAR(255) PRIMARY KEY,
    institute_id    VARCHAR(255) NOT NULL,
    conversation_id VARCHAR(255) NOT NULL,
    message_id      VARCHAR(255),                             -- nullable: report can target a whole conversation
    reporter_id     VARCHAR(255) NOT NULL,                    -- literal 'SYSTEM' for auto-moderation flags
    reason          VARCHAR(64)  NOT NULL,                    -- SPAM | ABUSE | HARASSMENT | INAPPROPRIATE | AUTO_MODERATION | OTHER
    details         TEXT,
    status          VARCHAR(32)  NOT NULL DEFAULT 'OPEN',     -- OPEN | REVIEWING | ACTIONED | DISMISSED
    reviewed_by     VARCHAR(255),
    reviewed_at     TIMESTAMP,
    created_at      TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX        IF NOT EXISTS idx_chat_report_inst_status ON chat_message_reports (institute_id, status, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS uq_chat_report_once         ON chat_message_reports (message_id, reporter_id) WHERE message_id IS NOT NULL;
