-- Hot-path indexes for the live-assessment learner sync.
--
-- Every learner's client auto-saves once a minute during a test, and each save
-- re-scores every question in the paper. Each question ran two unindexed
-- lookups. Measured on prod before this migration:
--
--   question_assessment_section_mapping (question_id, section_id)
--       -> Seq Scan + Sort, 11.2 ms, 751 pages, 19,487 rows discarded, EVERY call
--   question_wise_marks (assessment_id, attempt_id, question_id, section_id)
--       -> Seq Scan, up to 22 ms, 1,312 pages, 19,027 rows discarded
--   assessment_user_registration (username, institute_id)   [auth filter]
--       -> Seq Scan, 2.7 ms, 150 pages, on EVERY learner request
--
-- Only the primary keys existed; Postgres does not auto-index foreign keys.
--
-- This also compounded: question_wise_marks grows by (learners x questions)
-- with every exam run, so each scan got more expensive as more rows were
-- written, which is why the platform degraded gradually rather than being slow
-- from day one.
--
-- Plain CREATE INDEX (not CONCURRENTLY) is deliberate: these tables are small
-- (largest is 12 MB), so the SHARE lock blocks writes for only a few hundred
-- ms, and a plain build is transactional -- it rolls back cleanly on failure
-- instead of leaving an INVALID index behind for IF NOT EXISTS to silently
-- skip on the next run.

-- The hot learner scoring lookup runs once per question per 60s sync:
--   WHERE assessment_id=? AND attempt_id=? AND question_id=? AND section_id=?
--   ORDER BY created_at DESC LIMIT 1
-- It is served by idx_qwm_assessment_question_section below. Measured: the
-- planner picks that index and sorts the one or two matching rows, which is
-- free -- 22 ms seq scan becomes ~0.9 ms. A wider 5-column index that also
-- carried created_at was tried and rejected: the planner costed it identically
-- (the row estimate is 1, so the sort is already free) and never chose it, so
-- it was pure write overhead.
--
-- The ORDER BY on that query is a correctness fix, not decoration: the table has
-- no unique constraint on this tuple and prod holds 2,122 duplicate groups (57
-- disagreeing on marks, across 17 attempts). With a bare LIMIT 1, physical scan
-- order decided which duplicate received the fresh marks -- unstable even today,
-- since Postgres moves a row in the heap on every update, and it would have
-- shifted again when these indexes changed the access path.

-- Per-attempt reads: findByStudentAttemptId (learner report, data enrichment),
-- findByStudentAttemptIdAndQuestionId, findByStudentAttemptIdAndSectionId,
-- findByStudentAttemptIdAndAssessmentId, findAllQuestionWiseMarksForQuestionIdAndAttemptId.
-- attempt_id must lead for these; index (1) cannot serve them because it is
-- headed by assessment_id.
CREATE INDEX IF NOT EXISTS idx_qwm_attempt
    ON public.question_wise_marks (attempt_id, question_id, section_id);

-- (3) Admin/report path: per-question analytics across all participants --
-- findQuestionStatusAssessmentIdAndQuestionId, findTop3ParticipantsForCorrectResponse,
-- findByAssessmentIdAndQuestionIdAndSectionId, findOptionResponsesByAssessmentId,
-- countUniqueRespondentForAssessment, findDistinctAttemptIdsForAssessment.
CREATE INDEX IF NOT EXISTS idx_qwm_assessment_question_section
    ON public.question_wise_marks (assessment_id, question_id, section_id);

-- Marking-scheme lookup, run once per question per sync:
--   WHERE question_id = ? AND section_id = ? ORDER BY created_at DESC LIMIT 1
-- created_at DESC is part of the index so the planner can satisfy the ORDER BY
-- from the index and drop the Sort node entirely.
CREATE INDEX IF NOT EXISTS idx_qasm_question_section_created
    ON public.question_assessment_section_mapping (question_id, section_id, created_at DESC);

-- Section-scoped reads: findBySectionIdAndStatusNotIn,
-- getQuestionAssessmentSectionMappingBySectionIds, and the assessment-id join
-- used to build the question paper on assessment-start-preview.
CREATE INDEX IF NOT EXISTS idx_qasm_section
    ON public.question_assessment_section_mapping (section_id);

-- Auth filter: AssessmentInternalUserDetailsService.loadUserByUsername runs
--   WHERE username = ? AND institute_id = ? ORDER BY created_at DESC LIMIT 1
-- on EVERY /learner/status/{update,submit,restart} request. Was a seq scan.
CREATE INDEX IF NOT EXISTS idx_aur_username_institute_created
    ON public.assessment_user_registration (username, institute_id, created_at DESC);
