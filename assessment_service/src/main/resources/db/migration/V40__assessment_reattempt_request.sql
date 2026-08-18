-- Learner-raised requests for another attempt (or more time) on an assessment.
--
-- Before this table the "Request Reattempt" dialog in the learner app wrote nothing anywhere:
-- it cleared the textarea and told the learner their request had been "successfully submitted
-- to the admin" while no request left the device. Admins had a grant endpoint
-- (/admin/participants/provide-reattempt) but no inbox telling them a grant was wanted.
--
-- registration_id is nullable on purpose: the learner asks from inside the exam shell, which
-- knows the assessment and the user but not necessarily their assessment_user_registration row.
-- The review path resolves it, so a request raised before that lookup succeeds is still valid.
CREATE TABLE IF NOT EXISTS assessment_reattempt_request (
    id                VARCHAR(255) PRIMARY KEY,
    assessment_id     VARCHAR(255) NOT NULL,
    institute_id      VARCHAR(255) NOT NULL,
    user_id           VARCHAR(255) NOT NULL,
    registration_id   VARCHAR(255),
    attempt_id        VARCHAR(255),
    -- REATTEMPT | TIME_INCREASE — the learner dialog offers both and they share this pipeline.
    request_type      VARCHAR(50)  NOT NULL,
    reason            TEXT,
    -- PENDING | APPROVED | REJECTED
    status            VARCHAR(50)  NOT NULL DEFAULT 'PENDING',
    granted_count     INTEGER,
    reviewed_by       VARCHAR(255),
    review_note       TEXT,
    reviewed_at       TIMESTAMP,
    created_at        TIMESTAMP    NOT NULL DEFAULT now(),
    updated_at        TIMESTAMP    NOT NULL DEFAULT now()
);

-- The admin inbox lists by assessment and filters by status; both screens page by newest first.
CREATE INDEX IF NOT EXISTS idx_reattempt_request_assessment_status
    ON assessment_reattempt_request (assessment_id, status, created_at DESC);

-- The institute-wide inbox ("all pending requests") and the learner's own history.
CREATE INDEX IF NOT EXISTS idx_reattempt_request_institute_status
    ON assessment_reattempt_request (institute_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_reattempt_request_user
    ON assessment_reattempt_request (user_id, assessment_id);

-- One open request per learner per assessment per type. A learner tapping Submit twice while
-- anxious about a timer must not create a queue of duplicates for the admin to wade through;
-- the insert path turns a clash into "you already have a request pending".
CREATE UNIQUE INDEX IF NOT EXISTS uq_reattempt_request_open
    ON assessment_reattempt_request (assessment_id, user_id, request_type)
    WHERE status = 'PENDING';
