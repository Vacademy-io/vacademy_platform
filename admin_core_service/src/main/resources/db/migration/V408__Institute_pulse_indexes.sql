CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lsl_schedule_type_status
    ON live_session_logs (schedule_id, log_type, status);


CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_lsl_session_created
    ON live_session_logs (session_id, created_at DESC);



CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_qst_created_at
    ON question_slide_tracked (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quiz_sqt_created_at
    ON quiz_slide_question_tracked (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ast_created_at
    ON assignment_slide_tracked (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_asmt_st_created_at
    ON assessment_slide_tracked (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coding_submissions_submitted_at
    ON coding_submissions (submitted_at DESC);

