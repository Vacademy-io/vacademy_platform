-- Phase 1: review-and-approve gate for AI evaluation.
--
-- 1. Teacher-override provenance on per-question AI evaluations, so a mark the
--    teacher edited is distinguishable from a raw AI mark (and a late/retried
--    AI callback can refuse to clobber a human edit).
-- 2. A source tag on question_wise_marks (AI / AI_REVIEWED / MANUAL / AUTO) so
--    the UI and a future revaluate guard can tell how a mark was produced.

ALTER TABLE ai_question_evaluation
    ADD COLUMN IF NOT EXISTS is_edited BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS edited_by VARCHAR(255),
    ADD COLUMN IF NOT EXISTS edited_at TIMESTAMP;

ALTER TABLE question_wise_marks
    ADD COLUMN IF NOT EXISTS marks_source VARCHAR(30);
