-- Create user_linked_data table for storing student strengths and weaknesses
CREATE TABLE IF NOT EXISTS user_linked_data (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    type VARCHAR(50) NOT NULL, -- 'strength' or 'weakness'
    data VARCHAR(255) NOT NULL, -- topic name (e.g., 'algebra', 'geometry', 'p-block')
    percentage INTEGER, -- score 0-100
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX idx_user_linked_data_user_id ON user_linked_data(user_id);
CREATE INDEX idx_user_linked_data_user_type ON user_linked_data(user_id, type);

-- Create student_analysis_process table for tracking async report generation
CREATE TABLE IF NOT EXISTS student_analysis_process (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    institute_id VARCHAR(255) NOT NULL,
    start_date_iso DATE NOT NULL, -- ISO 8601 format: YYYY-MM-DD
    end_date_iso DATE NOT NULL, -- ISO 8601 format: YYYY-MM-DD
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING', -- 'PENDING', 'PROCESSING', 'COMPLETED', 'FAILED'
    report_json TEXT,
    error_message TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create indexes for faster lookups
CREATE INDEX idx_student_analysis_process_user_id ON student_analysis_process(user_id);
CREATE INDEX idx_student_analysis_process_status ON student_analysis_process(status);
CREATE INDEX idx_student_analysis_process_created_at ON student_analysis_process(created_at);

-- Trigger to update updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_user_linked_data()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_user_linked_data
BEFORE UPDATE ON user_linked_data
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_user_linked_data();

CREATE OR REPLACE FUNCTION update_updated_at_student_analysis_process()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_update_student_analysis_process
BEFORE UPDATE ON student_analysis_process
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_student_analysis_process();
