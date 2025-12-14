-- Add package_session_id and subject_id columns to instructor_copilot_logs table
ALTER TABLE instructor_copilot_logs ADD COLUMN package_session_id VARCHAR(255);
ALTER TABLE instructor_copilot_logs ADD COLUMN subject_id VARCHAR(255);

-- Create indexes for efficient querying
CREATE INDEX idx_instructor_copilot_logs_package_session_id ON instructor_copilot_logs(package_session_id);
CREATE INDEX idx_instructor_copilot_logs_subject_id ON instructor_copilot_logs(subject_id);
