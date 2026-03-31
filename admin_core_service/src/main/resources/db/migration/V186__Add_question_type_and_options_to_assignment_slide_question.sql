-- Add question_type column to assignment_slide_question
ALTER TABLE public.assignment_slide_question
    ADD COLUMN IF NOT EXISTS question_type varchar(50) NULL;

-- Create assignment_slide_question_options table (parallel to quiz_slide_question_options)
CREATE TABLE IF NOT EXISTS public.assignment_slide_question_options (
    id varchar(255) NOT NULL,
    assignment_slide_question_id varchar(255) NOT NULL,
    text_id varchar(255) NULL,
    media_id varchar(255) NULL,
    created_on timestamp DEFAULT now(),
    updated_on timestamp DEFAULT now(),
    CONSTRAINT assignment_slide_question_options_pkey PRIMARY KEY (id),
    CONSTRAINT fk_assignment_slide_question FOREIGN KEY (assignment_slide_question_id)
        REFERENCES public.assignment_slide_question(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_asqo_question_id
    ON public.assignment_slide_question_options (assignment_slide_question_id);
