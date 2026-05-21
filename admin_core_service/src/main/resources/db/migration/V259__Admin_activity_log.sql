-- Admin activity audit log (transactional outbox pattern).
-- Rows are written from the AuditableAspect *inside* the business transaction,
-- so an entry exists iff its triggering mutation also committed.

CREATE TABLE admin_activity_log (
    id                 VARCHAR(36)  PRIMARY KEY,
    institute_id       VARCHAR(255) NOT NULL,
    actor_id           VARCHAR(255),
    actor_name         VARCHAR(255),
    actor_email        VARCHAR(255),
    entity_type        VARCHAR(64)  NOT NULL,
    entity_id          VARCHAR(255),
    action             VARCHAR(64)  NOT NULL,
    http_method        VARCHAR(8),
    endpoint           VARCHAR(512),
    description        TEXT,
    request_payload    JSONB,
    -- Snapshot of the entity *before* the mutation, populated only when
    -- @Auditable(captureBefore = "...") is set. Lets the audit UI render a
    -- before/after diff for UPDATE actions.
    before_payload     JSONB,
    ip_address         VARCHAR(64),
    user_agent         VARCHAR(512),
    response_status    INTEGER,
    response_time_ms   BIGINT,
    created_at         TIMESTAMP    NOT NULL DEFAULT now()
);

-- Three composite indexes cover the read patterns:
--   1. "Recent activity in my org"          -> idx_aal_inst_created
--   2. "What did user X do?"                -> idx_aal_inst_actor_time
--   3. "History of entity (type, id)"       -> idx_aal_inst_entity
-- BRIN on created_at supports the retention sweep cheaply.

CREATE INDEX idx_aal_inst_created
    ON admin_activity_log (institute_id, created_at DESC);

CREATE INDEX idx_aal_inst_actor_time
    ON admin_activity_log (institute_id, actor_id, created_at DESC);

CREATE INDEX idx_aal_inst_entity
    ON admin_activity_log (institute_id, entity_type, entity_id, created_at DESC);

CREATE INDEX idx_aal_created_brin
    ON admin_activity_log USING BRIN (created_at);
