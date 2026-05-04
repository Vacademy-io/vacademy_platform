CREATE TABLE IF NOT EXISTS assessment_slide (
    id              VARCHAR(255) PRIMARY KEY,
    assessment_id   VARCHAR(255) NOT NULL,
    allow_reattempt BOOLEAN      NOT NULL DEFAULT TRUE,
    show_result     BOOLEAN      NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_assessment_slide_assessment_id
    ON assessment_slide (assessment_id);
