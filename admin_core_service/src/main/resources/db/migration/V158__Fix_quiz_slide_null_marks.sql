-- V157 used IF NOT EXISTS, so columns that already existed (e.g. from a dev deployment)
-- kept their original nullable definition, leaving existing rows with NULL values.
-- This migration patches those nulls to the intended defaults.

UPDATE quiz_slide SET marks_per_question = 1.0 WHERE marks_per_question IS NULL;
UPDATE quiz_slide SET negative_marking   = 0.0 WHERE negative_marking   IS NULL;

-- Ensure the column defaults are set so future rows (e.g. from copyQuizSlide) also get defaults
ALTER TABLE quiz_slide ALTER COLUMN marks_per_question SET DEFAULT 1.0;
ALTER TABLE quiz_slide ALTER COLUMN negative_marking   SET DEFAULT 0.0;
