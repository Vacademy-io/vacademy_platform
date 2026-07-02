-- Server-side "save draft" for manual answer-sheet evaluation.
-- Lets a faculty pause grading (annotations + marks + feedback + timer) and resume
-- later from any device, instead of the old download-PDF / re-upload workaround.
-- The draft is SHARED per copy (one row per attempt): whichever faculty is grading a
-- copy contributes to the same in-progress draft, so a colleague can pick up exactly
-- where someone left off. `evaluator_user_id` records who saved it last. The whole
-- editable evaluator state is kept as a JSON blob so annotations stay editable on
-- resume (never flattened). The draft is deleted once marks are submitted.
-- NOTE: if a rebase introduces another V18, renumber this file to the next free version.
CREATE TABLE IF NOT EXISTS public.evaluation_draft (
    id                  varchar(255) PRIMARY KEY,
    attempt_id          varchar(255) NOT NULL,          -- student_attempt.id being evaluated (one draft per copy)
    assessment_id       varchar(255) NULL,
    institute_id        varchar(255) NULL,
    evaluator_user_id   varchar(255) NULL,              -- who saved it last (informational)
    draft_json          text         NULL,              -- full editable evaluator state (annotations/marks/feedback/timer/page)
    created_at          timestamp    DEFAULT CURRENT_TIMESTAMP,
    updated_at          timestamp    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_evaluation_draft_attempt UNIQUE (attempt_id)
);
