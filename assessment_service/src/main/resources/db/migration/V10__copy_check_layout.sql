-- Per-attempt layout map + annotations for the AI copy-check pipeline.
-- One row per attempt; cleaned up by ON DELETE CASCADE when the
-- ai_evaluation_process row is deleted.
CREATE TABLE copy_check_layout (
    id                       VARCHAR(36)  PRIMARY KEY,
    evaluation_process_id    VARCHAR(36)  REFERENCES ai_evaluation_process(id) ON DELETE CASCADE,
    attempt_id               VARCHAR(36)  NOT NULL,
    layout_json              TEXT         NOT NULL,
    annotations_json         TEXT,
    pdf_full_res_dims_json   TEXT,
    layout_map_url           VARCHAR(512),
    created_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_copy_check_layout_process  ON copy_check_layout(evaluation_process_id);
CREATE INDEX idx_copy_check_layout_attempt  ON copy_check_layout(attempt_id);

-- Rubric snapshot per question evaluation so the FE can show a
-- "rubric changed since this evaluation" badge by comparing against the
-- current copy_check_rubric.rubric_version (lives in ai_service DB).
ALTER TABLE ai_question_evaluation
    ADD COLUMN IF NOT EXISTS rubric_version INTEGER;

-- The job_id ai_service assigned to this evaluation; used so cancellation
-- and status polling can find the right Python-side job.
ALTER TABLE ai_evaluation_process
    ADD COLUMN IF NOT EXISTS ai_service_job_id VARCHAR(64);
