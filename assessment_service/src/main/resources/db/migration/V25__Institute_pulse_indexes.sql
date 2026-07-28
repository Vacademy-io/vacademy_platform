CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aur_institute_assessment
    ON assessment_user_registration (institute_id, assessment_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sa_registration
    ON student_attempt (registration_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_sa_status_start
    ON student_attempt (status, start_time);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assessment_window
    ON assessment (bound_start_time, bound_end_time)
    WHERE status <> 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_aim_institute
    ON assessment_institute_mapping (institute_id);

