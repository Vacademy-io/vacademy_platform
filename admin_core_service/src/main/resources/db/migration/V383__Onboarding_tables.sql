-- Onboarding Flow feature: flow/step definitions + per-subject progress tables.
--
-- Independent domain: no FK to audience_response/student/ssigm. institute_custom_field_id
-- is a soft reference (no FK) into the shared institute_custom_fields table, matching the
-- existing posture of custom_field_values.custom_field_id. subject_user_id is an
-- auth_service users.id with NO FK -- it is the one identifier stable across "still a
-- lead" and "already a student" states, keeping this domain independent of
-- audience_response/student/ssigm.
--
-- Role access (ADMIN/STUDENT/PARENT view+edit) and the FORM step's attached-field config are
-- both stored as JSON directly on onboarding_step rather than as separate join tables: both are
-- small, bounded lists always read/written as a whole per step (never queried/filtered on their
-- own, and nothing outside this domain holds a FK to their individual rows -- the shared
-- institute_custom_fields table already carries its own type=ONBOARDING_STEP/typeId=step.id
-- tagging independently of this). A JSON column avoids extra tables and joins for data with no
-- independent relational access pattern.
--
-- No separate step-instance history table: v1's step transitions are strictly linear
-- (PENDING -> IN_PROGRESS -> COMPLETED/SKIPPED, each happening once), so the instance
-- row itself (status/entered_at/completed_at/completed_by_user_id/completed_by_role/
-- skip_reason) already captures everything a history table would add. Revisit if a
-- future step type needs re-entrant/multi-attempt transitions.

-- ── Flow / step definitions ─────────────────────────────────────────────────

CREATE TABLE onboarding_flow (
    id VARCHAR(36) PRIMARY KEY,
    institute_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(32) NOT NULL DEFAULT 'DRAFT', -- DRAFT, ACTIVE, ARCHIVED
    start_mode VARCHAR(32) NOT NULL DEFAULT 'MANUAL', -- MANUAL, AUTO, BOTH (UI metadata only)
    created_by_user_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_onboarding_flow_institute ON onboarding_flow (institute_id, status);

CREATE TABLE onboarding_step (
    id VARCHAR(36) PRIMARY KEY,
    flow_id VARCHAR(36) NOT NULL REFERENCES onboarding_flow (id) ON DELETE CASCADE,
    step_order INTEGER NOT NULL,
    step_name VARCHAR(255) NOT NULL,
    step_type VARCHAR(64) NOT NULL DEFAULT 'FORM',
    step_type_config TEXT, -- JSON, shape depends on step_type
    is_optional BOOLEAN NOT NULL DEFAULT FALSE,
    grants_student_role BOOLEAN NOT NULL DEFAULT FALSE,
    sends_login_credentials BOOLEAN NOT NULL DEFAULT FALSE,
    role_access TEXT, -- JSON array: [{role_key, can_view, can_edit}]
    fields_config TEXT, -- JSON array: [{institute_custom_field_id, field_order, is_mandatory, is_hidden, role_access}]
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE, ARCHIVED
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_onboarding_step_flow_order UNIQUE (flow_id, step_order)
);

CREATE INDEX idx_onboarding_step_flow ON onboarding_step (flow_id);

-- ── Per-subject progress ─────────────────────────────────────────────────────

CREATE TABLE onboarding_instance (
    id VARCHAR(36) PRIMARY KEY,
    flow_id VARCHAR(36) NOT NULL REFERENCES onboarding_flow (id),
    institute_id VARCHAR(255) NOT NULL,
    subject_user_id VARCHAR(255) NOT NULL,
    current_step_id VARCHAR(36) REFERENCES onboarding_step (id) ON DELETE SET NULL,
    status VARCHAR(32) NOT NULL DEFAULT 'IN_PROGRESS', -- IN_PROGRESS, COMPLETED, ABANDONED, CANCELLED
    started_by VARCHAR(16) NOT NULL DEFAULT 'MANUAL', -- MANUAL, AUTO
    started_by_user_id VARCHAR(255),
    source_event_name VARCHAR(128),
    source_event_id VARCHAR(255),
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_onboarding_instance_subject ON onboarding_instance (subject_user_id);
CREATE INDEX idx_onboarding_instance_flow ON onboarding_instance (flow_id, status);
CREATE INDEX idx_onboarding_instance_institute ON onboarding_instance (institute_id, status);

CREATE TABLE onboarding_step_instance (
    id VARCHAR(36) PRIMARY KEY,
    onboarding_instance_id VARCHAR(36) NOT NULL REFERENCES onboarding_instance (id) ON DELETE CASCADE,
    step_id VARCHAR(36) NOT NULL REFERENCES onboarding_step (id),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING', -- PENDING, IN_PROGRESS, COMPLETED, SKIPPED
    entered_at TIMESTAMP,
    completed_at TIMESTAMP,
    completed_by_user_id VARCHAR(255),
    completed_by_role VARCHAR(16), -- ADMIN, STUDENT, PARENT, SYSTEM
    skip_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_step_instance UNIQUE (onboarding_instance_id, step_id)
);

CREATE INDEX idx_step_instance_instance ON onboarding_step_instance (onboarding_instance_id);
