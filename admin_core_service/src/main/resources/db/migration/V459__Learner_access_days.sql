-- Learner course-access days: make every grant, extension and revocation traceable.
--
-- Access itself continues to live on student_session_institute_group_mapping.expiry_date
-- (NULL = unlimited). That column only ever holds the *current* answer, so it cannot say
-- who extended a learner, by how much, or which plan the days originally came from.
-- learner_access_log is the append-only history behind it: one row per change, written in
-- the same transaction as the expiry_date write.

CREATE TABLE learner_access_log (
    id                     VARCHAR(255) PRIMARY KEY,
    institute_id           VARCHAR(255) NOT NULL,
    user_id                VARCHAR(255) NOT NULL,
    package_session_id     VARCHAR(255),
    -- student_session_institute_group_mapping.id. Deliberately no FK: enrollment rows are
    -- re-created (INVITED -> ACTIVE shifts, re-enrollment) and hard-deleted by the wipe
    -- flows, and losing the history when that happens would defeat the point.
    mapping_id             VARCHAR(255),

    -- Where the change came from: ENROLLMENT, ADMIN_EXTENSION, ADMIN_ASSIGNMENT,
    -- RENEWAL, MIGRATION.
    source                 VARCHAR(64)  NOT NULL,
    -- What it did: GRANT, EXTEND, REDUCE, SET, MAKE_UNLIMITED, REVOKE.
    action                 VARCHAR(64)  NOT NULL,

    previous_expiry_date   TIMESTAMP,
    new_expiry_date        TIMESTAMP,
    -- Days added (positive) or removed (negative). NULL when either side is unlimited,
    -- since the delta is then unbounded rather than zero.
    days_delta             INTEGER,
    -- The access-days figure the caller asked for, before it was resolved against the
    -- base date. NULL for absolute-date and unlimited changes.
    access_days            INTEGER,

    -- Provenance of an automatic grant: which plan/invite supplied the days.
    user_plan_id           VARCHAR(255),
    payment_plan_id        VARCHAR(255),
    enroll_invite_id       VARCHAR(255),

    reason                 TEXT,
    actor_id               VARCHAR(255),
    actor_name             VARCHAR(255),
    created_at             TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at             TIMESTAMP    NOT NULL DEFAULT now()
);

-- "Access history for this learner in this institute" — the side-panel timeline.
CREATE INDEX idx_lal_inst_user_created
    ON learner_access_log (institute_id, user_id, created_at DESC);

-- "History for this specific enrollment" — the per-course drill-down.
CREATE INDEX idx_lal_mapping_created
    ON learner_access_log (mapping_id, created_at DESC);

-- "Everything that happened to this batch" — admin reporting.
CREATE INDEX idx_lal_inst_pkg_created
    ON learner_access_log (institute_id, package_session_id, created_at DESC);
