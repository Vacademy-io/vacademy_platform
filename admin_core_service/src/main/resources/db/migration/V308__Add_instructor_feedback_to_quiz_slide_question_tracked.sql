ALTER TABLE quiz_slide_question_tracked
    ADD COLUMN IF NOT EXISTS instructor_feedback TEXT,
    ADD COLUMN IF NOT EXISTS instructor_feedback_file_id VARCHAR(255);
