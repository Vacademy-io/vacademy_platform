-- Bulk Assessment Report Export (ZIP)
-- See docs/ASSESSMENT_BULK_REPORT_EXPORT_PLAN.md §4.1 and
-- docs/ASSESSMENT_BULK_REPORT_EXPORT_ARCHITECTURE.md §4.1.
-- NOTE: the plan document names this V34, but V34 was already claimed by
-- V34__assessment_hot_path_indexes.sql (uncommitted work in this repo at the
-- time this migration was written) — using the next free version, V35, per
-- the task instruction to verify and renumber if taken.

CREATE TABLE assessment_report_export_job (
    id                        VARCHAR(36)  PRIMARY KEY,
    assessment_id             VARCHAR(36)  NOT NULL,
    institute_id              VARCHAR(36)  NOT NULL,
    created_by_user_id        VARCHAR(36)  NOT NULL,
    status                    VARCHAR(20)  NOT NULL,
    total_count               INT          NOT NULL DEFAULT 0,
    completed_count           INT          NOT NULL DEFAULT 0,
    failed_count              INT          NOT NULL DEFAULT 0,
    skipped_count             INT          NOT NULL DEFAULT 0,
    regenerate                BOOLEAN      NOT NULL DEFAULT FALSE,
    output_file_id            VARCHAR(36),
    output_file_name          VARCHAR(255),
    output_size_bytes         BIGINT,
    request_json              TEXT,
    context_snapshot          TEXT,        -- serialised ReportClassContext snapshot (see architecture §9)
    context_snapshot_version  INT,         -- NULL until first snapshot write
    context_drift             BOOLEAN      NOT NULL DEFAULT FALSE,
    superseded_file_ids       TEXT,        -- comma-separated orphaned ZIP file ids (no S3 delete primitive exists)
    resume_count              INT          NOT NULL DEFAULT 0,
    error_message             TEXT,
    started_at                TIMESTAMP,
    completed_at               TIMESTAMP,
    created_at                TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at                TIMESTAMP    NOT NULL DEFAULT now()
);

CREATE INDEX idx_arej_recent
    ON assessment_report_export_job (assessment_id, institute_id, created_at DESC);

CREATE INDEX idx_arej_inflight
    ON assessment_report_export_job (institute_id, status, updated_at)
    WHERE status IN ('PENDING', 'IN_PROGRESS');

CREATE TABLE assessment_report_export_item (
    id              VARCHAR(36) PRIMARY KEY,
    job_id          VARCHAR(36) NOT NULL
                    REFERENCES assessment_report_export_job (id) ON DELETE CASCADE,
    attempt_id      VARCHAR(36) NOT NULL,
    user_id         VARCHAR(36),
    student_name    VARCHAR(255),
    status          VARCHAR(20) NOT NULL,
    source          VARCHAR(20),
    file_id         VARCHAR(36),
    zip_entry_name  VARCHAR(255),
    retry_count     INT         NOT NULL DEFAULT 0,
    error_message   TEXT,
    processed_at    TIMESTAMP,
    created_at      TIMESTAMP   NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX uq_arei_job_attempt ON assessment_report_export_item (job_id, attempt_id);
CREATE INDEX idx_arei_job_status ON assessment_report_export_item (job_id, status);

-- The status endpoint's stale-item comparison joins items back to attempts;
-- this partial index keeps that scan cheap once a job has many items.
CREATE INDEX idx_arei_job_done_file ON assessment_report_export_item (job_id, status)
    WHERE file_id IS NOT NULL;
