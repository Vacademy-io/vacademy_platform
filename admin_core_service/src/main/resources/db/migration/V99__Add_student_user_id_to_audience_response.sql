-- Add student_user_id column to audience_response table
-- This column stores the child/student user ID for whom the application is submitted
-- Helps resolve the correct child when a parent has multiple children

ALTER TABLE audience_response 
ADD COLUMN student_user_id VARCHAR(255);

-- Add index for better query performance
CREATE INDEX idx_audience_response_student_user_id 
ON audience_response(student_user_id);
