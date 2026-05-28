CREATE TABLE IF NOT EXISTS certificate_log (
    id VARCHAR(36) PRIMARY KEY,
    institute_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    package_session_id VARCHAR(255) NOT NULL,
    course_name VARCHAR(500),
    completion_percentage INTEGER,
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    file_id VARCHAR(255),
    template_html_snapshot TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_certificate_log_user_pkg
    ON certificate_log (user_id, package_session_id);

CREATE INDEX IF NOT EXISTS idx_certificate_log_institute
    ON certificate_log (institute_id);
