ALTER TABLE teacher_planning_logs
ADD COLUMN is_shared_with_student BOOLEAN NOT NULL DEFAULT FALSE;
