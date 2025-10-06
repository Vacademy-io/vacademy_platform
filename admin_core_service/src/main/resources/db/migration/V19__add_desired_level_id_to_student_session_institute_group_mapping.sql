-- Add desired_level_id column to student_session_institute_group_mapping
ALTER TABLE student_session_institute_group_mapping
ADD COLUMN desired_level_id VARCHAR(255);
