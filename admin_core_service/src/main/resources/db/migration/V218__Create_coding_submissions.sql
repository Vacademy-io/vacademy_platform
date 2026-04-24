-- Stores learner attempts on Code Editor slides whose admin set Question Mode.
-- The "verdict" / score / per-testcase results are computed client-side in v1
-- (Judge0 runs in the browser). Future hardening will re-run server-side.
CREATE TABLE IF NOT EXISTS coding_submissions (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slide_id                VARCHAR(255) NOT NULL,
    learner_id              VARCHAR(255) NOT NULL,
    package_session_id      VARCHAR(255),
    language                VARCHAR(50)  NOT NULL,
    source_code             TEXT         NOT NULL,
    verdict                 VARCHAR(32)  NOT NULL,
    passed_count            INTEGER      NOT NULL DEFAULT 0,
    total_count             INTEGER      NOT NULL DEFAULT 0,
    score                   DOUBLE PRECISION NOT NULL DEFAULT 0,
    max_points              DOUBLE PRECISION NOT NULL DEFAULT 0,
    -- JSON array of { id, label, visible, passed, stdout, expected, stderr,
    -- timeMs, memoryKb, error }. Stored as TEXT for portability.
    testcase_results_json   TEXT,
    total_time_ms           INTEGER      NOT NULL DEFAULT 0,
    peak_memory_kb          INTEGER      NOT NULL DEFAULT 0,
    submitted_at            TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    session_started_at      TIMESTAMP,
    created_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at              TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Most common queries: per-slide (admin report) and per-slide+learner
-- (learner history, "best score wins" lookup).
CREATE INDEX idx_coding_submissions_slide ON coding_submissions(slide_id);
CREATE INDEX idx_coding_submissions_slide_learner
    ON coding_submissions(slide_id, learner_id);
CREATE INDEX idx_coding_submissions_learner ON coding_submissions(learner_id);
