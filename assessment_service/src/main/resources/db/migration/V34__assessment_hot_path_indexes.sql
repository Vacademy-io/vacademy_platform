-- Hot-path indexes for the live-assessment learner sync.
--
-- Every learner's client auto-saves once a minute during a test
-- (REMOTE_SAVE_INTERVAL_MS). Each save re-scores EVERY question in the paper,
-- and each question ran two unindexed lookups. Measured on prod before this
-- migration (19k-row tables):
--
--   question_assessment_section_mapping (question_id, section_id)
--       -> Seq Scan + Sort, 11.2 ms, 751 pages, 19,487 rows discarded, EVERY call
--   question_wise_marks (assessment_id, attempt_id, question_id, section_id)
--       -> Seq Scan, up to 22 ms, 1,312 pages, 19,027 rows discarded
--
-- i.e. ~23 ms of DB time per question per learner per minute. A 50-question
-- paper cost ~1.2 s of connection-held time per learner per sync, which
-- saturated the (small) Hikari pool and made every other endpoint queue.
--
-- Worse, it compounded: question_wise_marks grows by (learners x questions)
-- with every exam run, so each scan got more expensive as more rows were
-- written -- quadratic degradation. Only the primary keys existed; Postgres
-- does not auto-index foreign keys.
--
-- Plain CREATE INDEX (not CONCURRENTLY) is deliberate here: these tables are
-- small (largest is 12 MB), so the SHARE lock blocks writes for only a few
-- hundred ms, and a plain build is transactional -- it rolls back cleanly on
-- failure instead of leaving an INVALID index behind for IF NOT EXISTS to
-- silently skip on the next run.

-- Learner scoring path: QuestionWiseMarksService.updateQuestionWiseMarksForEveryQuestion.
-- attempt_id leads because it is the most selective column (one attempt holds
-- only as many rows as the paper has questions). Also serves the other
-- per-attempt lookups: findByStudentAttemptId(AndQuestionId/AndSectionId/AndAssessmentId)
-- and findAllQuestionWiseMarksForQuestionIdAndAttemptId.
CREATE INDEX IF NOT EXISTS idx_qwm_attempt_question_section
    ON public.question_wise_marks (attempt_id, question_id, section_id);

-- Admin/report path: per-question analytics across all participants --
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
