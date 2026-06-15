-- Per-submission record for ASSESSMENT slides, mirroring assignment_slide_tracked.
-- Each row links an activity_log entry (which carries the learner user_id + slide_id)
-- to the assessment-service attempt and, for manual assessments, the learner's
-- uploaded answer file id(s). Marks/evaluation remain authoritative in the
-- assessment-service; this table only records the slide-level submission.
CREATE TABLE IF NOT EXISTS public.assessment_slide_tracked (
    id varchar(255) NOT NULL,
    activity_id varchar(255) NOT NULL,
    attempt_id varchar(255) NULL,
    comma_separated_file_ids text NULL,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
    updated_at timestamp DEFAULT CURRENT_TIMESTAMP NULL,
    CONSTRAINT assessment_slide_tracked_pkey PRIMARY KEY (id),
    CONSTRAINT fk_assessment_slide_tracked_activity_log FOREIGN KEY (activity_id) REFERENCES public.activity_log (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_assessment_slide_tracked_activity_id ON public.assessment_slide_tracked USING btree (activity_id);
