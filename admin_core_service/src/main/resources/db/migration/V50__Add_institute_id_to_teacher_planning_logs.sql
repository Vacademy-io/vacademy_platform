-- Add institute_id column to teacher_planning_logs table
ALTER TABLE teacher_planning_logs
ADD COLUMN institute_id VARCHAR(255) NOT NULL;

-- Add foreign key constraint
ALTER TABLE teacher_planning_logs
ADD CONSTRAINT fk_teacher_planning_logs_institute
    FOREIGN KEY (institute_id)
    REFERENCES institutes(id)
    ON DELETE CASCADE;

-- Create index for institute_id
CREATE INDEX idx_teacher_planning_logs_institute_id
    ON teacher_planning_logs(institute_id);

-- Add comment for documentation
COMMENT ON COLUMN teacher_planning_logs.institute_id IS 'Institute this planning/diary log belongs to';
