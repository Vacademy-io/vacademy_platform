-- Backfill: repair stale learner course-progress rollups (admin_core_service)
--
-- WHY
-- The learner home page reads learner_operation(source='PACKAGE_SESSION',
-- operation='PERCENTAGE_PACKAGE_SESSION_COMPLETED'). That row is only rewritten
-- when an activity request arrives carrying the right packageSessionId. The
-- learner clients used to resolve that id from a single value cached in device
-- Preferences at login, so a learner enrolled in more than one batch sent the
-- wrong id whenever they studied any other course. The rollup then matched no
-- subject_session rows, produced null, and was silently dropped -- leaving the
-- course percentage frozen while the chapter/module/subject percentages (whose
-- ids come from the route) kept moving. That is the "I finished the chapter but
-- my course progress won't move" report.
--
-- The client fix (useResolvedPackageSessionId) stops new drift. This script
-- repairs rows already stranded.
--
-- SCOPE / SAFETY
--  * Touches ONLY the three rollup levels. Never invents slide-level data and
--    never lowers a slide percentage.
--  * Recomputes with exactly the formulas the service uses
--    (ActivityLogRepository#getModule/Subject/PackageSessionCompletionPercentage),
--    so it converges on what the app would have written itself.
--  * Idempotent -- re-running after convergence updates 0 rows.
--  * Order matters: module -> subject -> package_session, each level reads the
--    level below.
--  * Wrapped in a single transaction. Review the row counts psql prints for each
--    UPDATE before committing; ROLLBACK is safe at any point.
--
-- HOW TO RUN
--   psql -v ON_ERROR_STOP=1 -f learner-progress-rollup-backfill.sql
--   Section 0 prints the audit (keep it -- it is the rollback reference), then
--   sections 1-3 apply. Re-run section 0 afterwards; drift should be empty.
--
-- NOTE learner_operation maps created_at/updated_at insertable=false,
-- updatable=false and the table has no trigger, so updated_at is effectively
-- created_at. Do not use it to judge freshness before or after this run.

\echo '=== 0. AUDIT: course percentages that disagree with their own subjects ==='

WITH stored AS (
    SELECT user_id, source_id AS package_session_id, CAST(value AS numeric) AS stored_pct
    FROM learner_operation
    WHERE source = 'PACKAGE_SESSION'
      AND operation = 'PERCENTAGE_PACKAGE_SESSION_COMPLETED'
      AND value ~ '^-?[0-9]+(\.[0-9]+)?$'
),
recomputed AS (
    SELECT st.user_id,
           st.package_session_id,
           st.stored_pct,
           COALESCE(SUM(CAST(lo.value AS numeric)), 0)
               / NULLIF(COUNT(DISTINCT ss.subject_id), 0) AS correct_pct
    FROM stored st
    JOIN subject_session ss ON ss.session_id = st.package_session_id
    JOIN subject s ON s.id = ss.subject_id AND s.status = 'ACTIVE'
    LEFT JOIN learner_operation lo
           ON lo.source_id = s.id
          AND lo.user_id = st.user_id
          AND lo.operation = 'PERCENTAGE_SUBJECT_COMPLETED'
          AND lo.value ~ '^-?[0-9]+(\.[0-9]+)?$'
    GROUP BY st.user_id, st.package_session_id, st.stored_pct
)
SELECT user_id,
       package_session_id,
       ROUND(stored_pct, 2)               AS shows_now,
       ROUND(correct_pct, 2)              AS should_show,
       ROUND(correct_pct - stored_pct, 2) AS drift
FROM recomputed
WHERE ABS(correct_pct - stored_pct) > 0.01
ORDER BY correct_pct - stored_pct DESC;

BEGIN;

\echo '=== 0b. CHAPTER <- mean of its slides ==='
-- The cascade starts here, so this level drifts too and every level above
-- inherits the error. The assignment submit path was the worst offender: it sent
-- no chapterId at all, so a submitted assignment set its slide to 100% and the
-- chapter kept its old value. Denominator is every slide of a tracked type in
-- the chapter, so untouched slides correctly count as 0.
UPDATE learner_operation lo
SET value = calc.correct_pct::text
FROM (
    SELECT existing.user_id,
           existing.source_id AS chapter_id,
           COALESCE(SUM(CAST(sv.value AS numeric)), 0)
               / NULLIF(COUNT(DISTINCT cs.slide_id), 0) AS correct_pct
    FROM learner_operation existing
    JOIN chapter_to_slides cs ON cs.chapter_id = existing.source_id
                             AND cs.status IN ('PUBLISHED', 'UNSYNC')
    JOIN slide s ON s.id = cs.slide_id
                AND s.source_type IN ('VIDEO','DOCUMENT','ASSIGNMENT','QUESTION','QUIZ',
                                      'HTML_VIDEO','AUDIO','SCORM','ASSESSMENT')
    LEFT JOIN learner_operation sv
           ON sv.source_id = cs.slide_id
          AND sv.source = 'SLIDE'
          AND sv.user_id = existing.user_id
          AND sv.operation IN ('PERCENTAGE_VIDEO_WATCHED','PERCENTAGE_DOCUMENT_COMPLETED',
                               'PERCENTAGE_ASSIGNMENT_COMPLETED','PERCENTAGE_QUESTION_COMPLETED',
                               'PERCENTAGE_QUIZ_COMPLETED','PERCENTAGE_AUDIO_LISTENED',
                               'PERCENTAGE_SCORM_COMPLETED','PERCENTAGE_ASSESSMENT_DONE')
          AND sv.value ~ '^-?[0-9]+(\.[0-9]+)?$'
    WHERE existing.source = 'CHAPTER'
      AND existing.operation = 'PERCENTAGE_CHAPTER_COMPLETED'
    GROUP BY existing.user_id, existing.source_id
) calc
WHERE lo.source = 'CHAPTER'
  AND lo.operation = 'PERCENTAGE_CHAPTER_COMPLETED'
  AND lo.user_id = calc.user_id
  AND lo.source_id = calc.chapter_id
  AND calc.correct_pct IS NOT NULL
  AND (lo.value !~ '^-?[0-9]+(\.[0-9]+)?$'
       OR ABS(CAST(lo.value AS numeric) - calc.correct_pct) > 0.01);

\echo '=== 1. MODULE <- mean of its ACTIVE chapters ==='
-- Denominator is every ACTIVE chapter mapped into the module, so chapters the
-- learner has not opened correctly count as 0.
UPDATE learner_operation lo
SET value = calc.correct_pct::text
FROM (
    SELECT existing.user_id,
           existing.source_id AS module_id,
           COALESCE(SUM(CAST(cv.value AS numeric)), 0)
               / NULLIF(COUNT(DISTINCT dc.chapter_id), 0) AS correct_pct
    FROM learner_operation existing
    JOIN LATERAL (
        SELECT DISTINCT mcm.chapter_id
        FROM module_chapter_mapping mcm
        JOIN chapter c ON c.id = mcm.chapter_id
        JOIN chapter_package_session_mapping cpm ON cpm.chapter_id = c.id
        WHERE mcm.module_id = existing.source_id
          AND cpm.status = 'ACTIVE'
          AND c.status = 'ACTIVE'
    ) dc ON TRUE
    LEFT JOIN learner_operation cv
           ON cv.source_id = dc.chapter_id
          AND cv.user_id = existing.user_id
          AND cv.operation = 'PERCENTAGE_CHAPTER_COMPLETED'
          AND cv.value ~ '^-?[0-9]+(\.[0-9]+)?$'
    WHERE existing.source = 'MODULE'
      AND existing.operation = 'PERCENTAGE_MODULE_COMPLETED'
    GROUP BY existing.user_id, existing.source_id
) calc
WHERE lo.source = 'MODULE'
  AND lo.operation = 'PERCENTAGE_MODULE_COMPLETED'
  AND lo.user_id = calc.user_id
  AND lo.source_id = calc.module_id
  AND calc.correct_pct IS NOT NULL
  AND (lo.value !~ '^-?[0-9]+(\.[0-9]+)?$'
       OR ABS(CAST(lo.value AS numeric) - calc.correct_pct) > 0.01);

\echo '=== 2. SUBJECT <- mean of its ACTIVE modules ==='
UPDATE learner_operation lo
SET value = calc.correct_pct::text
FROM (
    SELECT existing.user_id,
           existing.source_id AS subject_id,
           COALESCE(SUM(CAST(mv.value AS numeric)), 0)
               / NULLIF(COUNT(DISTINCT smm.module_id), 0) AS correct_pct
    FROM learner_operation existing
    JOIN subject_module_mapping smm ON smm.subject_id = existing.source_id
    JOIN modules m ON m.id = smm.module_id AND m.status = 'ACTIVE'
    LEFT JOIN learner_operation mv
           ON mv.source_id = m.id
          AND mv.user_id = existing.user_id
          AND mv.operation = 'PERCENTAGE_MODULE_COMPLETED'
          AND mv.value ~ '^-?[0-9]+(\.[0-9]+)?$'
    WHERE existing.source = 'SUBJECT'
      AND existing.operation = 'PERCENTAGE_SUBJECT_COMPLETED'
    GROUP BY existing.user_id, existing.source_id
) calc
WHERE lo.source = 'SUBJECT'
  AND lo.operation = 'PERCENTAGE_SUBJECT_COMPLETED'
  AND lo.user_id = calc.user_id
  AND lo.source_id = calc.subject_id
  AND calc.correct_pct IS NOT NULL
  AND (lo.value !~ '^-?[0-9]+(\.[0-9]+)?$'
       OR ABS(CAST(lo.value AS numeric) - calc.correct_pct) > 0.01);

\echo '=== 3. PACKAGE_SESSION <- mean of its ACTIVE subjects (the home page number) ==='
UPDATE learner_operation lo
SET value = calc.correct_pct::text
FROM (
    SELECT existing.user_id,
           existing.source_id AS package_session_id,
           COALESCE(SUM(CAST(sv.value AS numeric)), 0)
               / NULLIF(COUNT(DISTINCT ss.subject_id), 0) AS correct_pct
    FROM learner_operation existing
    JOIN subject_session ss ON ss.session_id = existing.source_id
    JOIN subject s ON s.id = ss.subject_id AND s.status = 'ACTIVE'
    LEFT JOIN learner_operation sv
           ON sv.source_id = s.id
          AND sv.user_id = existing.user_id
          AND sv.operation = 'PERCENTAGE_SUBJECT_COMPLETED'
          AND sv.value ~ '^-?[0-9]+(\.[0-9]+)?$'
    WHERE existing.source = 'PACKAGE_SESSION'
      AND existing.operation = 'PERCENTAGE_PACKAGE_SESSION_COMPLETED'
    GROUP BY existing.user_id, existing.source_id
) calc
WHERE lo.source = 'PACKAGE_SESSION'
  AND lo.operation = 'PERCENTAGE_PACKAGE_SESSION_COMPLETED'
  AND lo.user_id = calc.user_id
  AND lo.source_id = calc.package_session_id
  AND calc.correct_pct IS NOT NULL
  AND (lo.value !~ '^-?[0-9]+(\.[0-9]+)?$'
       OR ABS(CAST(lo.value AS numeric) - calc.correct_pct) > 0.01);

COMMIT;

\echo '=== 4. VERIFY: this should return no rows ==='

WITH stored AS (
    SELECT user_id, source_id AS package_session_id, CAST(value AS numeric) AS stored_pct
    FROM learner_operation
    WHERE source = 'PACKAGE_SESSION'
      AND operation = 'PERCENTAGE_PACKAGE_SESSION_COMPLETED'
      AND value ~ '^-?[0-9]+(\.[0-9]+)?$'
),
recomputed AS (
    SELECT st.user_id, st.package_session_id, st.stored_pct,
           COALESCE(SUM(CAST(lo.value AS numeric)), 0)
               / NULLIF(COUNT(DISTINCT ss.subject_id), 0) AS correct_pct
    FROM stored st
    JOIN subject_session ss ON ss.session_id = st.package_session_id
    JOIN subject s ON s.id = ss.subject_id AND s.status = 'ACTIVE'
    LEFT JOIN learner_operation lo
           ON lo.source_id = s.id
          AND lo.user_id = st.user_id
          AND lo.operation = 'PERCENTAGE_SUBJECT_COMPLETED'
          AND lo.value ~ '^-?[0-9]+(\.[0-9]+)?$'
    GROUP BY st.user_id, st.package_session_id, st.stored_pct
)
SELECT user_id, package_session_id,
       ROUND(stored_pct, 2) AS shows_now,
       ROUND(correct_pct, 2) AS should_show
FROM recomputed
WHERE ABS(correct_pct - stored_pct) > 0.01;

-- =====================================================================
-- NOT DONE HERE, ON PURPOSE: slide percentages
-- =====================================================================
-- Slides that lost page views to the activity re-parenting bug cannot be
-- repaired by recomputation -- the evidence moved to a neighbouring slide and
-- there is no reliable way to attribute historical document_tracked rows back.
-- Recomputing would LOWER real learners (a 14-page PDF read end to end now
-- recomputes to 50% because 12 of its pages sit on the reading note beside it),
-- which the slide-level monotonic guard in addOrUpdatePercentageOperation
-- deliberately prevents. Those rows are left alone.
--
-- If a deliberate repair is wanted later, the defensible rule is: credit a
-- document slide 100% where DOCUMENT_LAST_PAGE shows the learner reached the
-- final page. That is a product decision, not a data-integrity fix, so it is
-- not bundled here.
