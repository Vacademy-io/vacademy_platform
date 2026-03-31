-- Assignment slide config: total marks & passing marks
ALTER TABLE public.assignment_slide ADD COLUMN IF NOT EXISTS total_marks DOUBLE PRECISION;
ALTER TABLE public.assignment_slide ADD COLUMN IF NOT EXISTS passing_marks DOUBLE PRECISION;

-- Submission grading: marks scored, feedback text, checked answer file
ALTER TABLE public.assignment_slide_tracked ADD COLUMN IF NOT EXISTS marks DOUBLE PRECISION;
ALTER TABLE public.assignment_slide_tracked ADD COLUMN IF NOT EXISTS feedback TEXT;
ALTER TABLE public.assignment_slide_tracked ADD COLUMN IF NOT EXISTS checked_file_id VARCHAR(255);
