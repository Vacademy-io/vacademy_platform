CREATE TABLE instructor_copilot_logs (
    id VARCHAR(255) NOT NULL PRIMARY KEY,
    created_by_user_id VARCHAR(255) NOT NULL,
    institute_id VARCHAR(255) NOT NULL,
    title VARCHAR(255),
    thumbnail_file_id VARCHAR(255),
    transcript_json TEXT,
    flashnotes_json TEXT,
    summary TEXT,
    question_json TEXT,
    flashcard_json TEXT,
    slides_json TEXT,
    video_json TEXT,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_instructor_copilot_logs_institute_id ON instructor_copilot_logs(institute_id);
CREATE INDEX idx_instructor_copilot_logs_status ON instructor_copilot_logs(status);
CREATE INDEX idx_instructor_copilot_logs_created_at ON instructor_copilot_logs(created_at);
