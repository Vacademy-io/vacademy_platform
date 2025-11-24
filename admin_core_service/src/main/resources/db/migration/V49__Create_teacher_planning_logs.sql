-- Create teacher_planning_logs table for planning and diary log entries
CREATE TABLE IF NOT EXISTS teacher_planning_logs (
    id                              VARCHAR(255) PRIMARY KEY,
    created_by_user_id              VARCHAR(255) NOT NULL,
    log_type                        VARCHAR(20) NOT NULL,
    entity                          VARCHAR(50) NOT NULL DEFAULT 'packageSession',
    entity_id                       VARCHAR(255) NOT NULL,
    interval_type                   VARCHAR(20) NOT NULL,
    interval_type_id                VARCHAR(50) NOT NULL,
    title                           VARCHAR(255) NOT NULL,
    description                     TEXT,
    content                         TEXT NOT NULL,
    subject_id                      VARCHAR(255) NOT NULL,
    comma_separated_file_ids        TEXT,
    status                          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    created_at                      TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at                      TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL,
    
    -- Add constraints for enum-like fields
    CONSTRAINT chk_teacher_planning_logs_log_type 
        CHECK (log_type IN ('planning', 'diary_log')),
    
    CONSTRAINT chk_teacher_planning_logs_interval_type 
        CHECK (interval_type IN ('daily', 'weekly', 'monthly', 'yearly_month', 'yearly_quarter')),
    
    CONSTRAINT chk_teacher_planning_logs_status 
        CHECK (status IN ('ACTIVE', 'DELETED'))
);

-- Create indexes for performance optimization
CREATE INDEX idx_teacher_planning_logs_created_by_user_id 
    ON teacher_planning_logs(created_by_user_id);

CREATE INDEX idx_teacher_planning_logs_log_type 
    ON teacher_planning_logs(log_type);

CREATE INDEX idx_teacher_planning_logs_entity 
    ON teacher_planning_logs(entity, entity_id);

CREATE INDEX idx_teacher_planning_logs_interval 
    ON teacher_planning_logs(interval_type, interval_type_id);

CREATE INDEX idx_teacher_planning_logs_subject_id 
    ON teacher_planning_logs(subject_id);

CREATE INDEX idx_teacher_planning_logs_status 
    ON teacher_planning_logs(status) WHERE status <> 'DELETED';

CREATE INDEX idx_teacher_planning_logs_created_at 
    ON teacher_planning_logs(created_at DESC);

-- Create trigger function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_teacher_planning_logs_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to automatically update updated_at column
CREATE TRIGGER trigger_teacher_planning_logs_updated_at
    BEFORE UPDATE ON teacher_planning_logs
    FOR EACH ROW
    EXECUTE FUNCTION update_teacher_planning_logs_updated_at();

-- Add comments for documentation
COMMENT ON TABLE teacher_planning_logs IS 'Stores teacher planning entries and diary logs linked to entity and subjects';
COMMENT ON COLUMN teacher_planning_logs.log_type IS 'Type of entry: planning or diary_log';
COMMENT ON COLUMN teacher_planning_logs.entity IS 'Type of entity this log is linked to (e.g., packageSession)';
COMMENT ON COLUMN teacher_planning_logs.entity_id IS 'ID of the entity (e.g., package session ID)';
COMMENT ON COLUMN teacher_planning_logs.interval_type IS 'Time interval type: daily, weekly, monthly, yearly_month, yearly_quarter';
COMMENT ON COLUMN teacher_planning_logs.interval_type_id IS 'Identifier based on interval_type (format varies by type)';
COMMENT ON COLUMN teacher_planning_logs.content IS 'HTML content of the planning or diary entry';
COMMENT ON COLUMN teacher_planning_logs.subject_id IS 'Subject this entry is linked to';
COMMENT ON COLUMN teacher_planning_logs.comma_separated_file_ids IS 'Optional comma-separated list of file IDs for attachments';
COMMENT ON COLUMN teacher_planning_logs.status IS 'Entry status: ACTIVE or DELETED (soft delete)';
