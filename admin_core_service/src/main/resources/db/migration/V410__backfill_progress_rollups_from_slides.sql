-- ============================================================================
-- V410: Backfill stored progress rollups (CHAPTER / MODULE / SUBJECT /
--       PACKAGE_SESSION) from live slide data, for every learner with stored rows.
--
-- WHY: the incremental completion cascade recomputed MODULE / SUBJECT /
-- PACKAGE_SESSION off ids supplied by the client request. When the client omitted
-- them (which it did intermittently) those rollups computed null and were dropped,
-- so a learner's CHAPTER percentages kept advancing while MODULE / SUBJECT /
-- PACKAGE_SESSION — and therefore the course percentage on the learner's home page,
-- and course-completion / certificate gating — froze. A handful of CHAPTER rows
-- were left stale too. The cascade is fixed to resolve the parent chain
-- server-side (LearnerTrackingAsyncService.updateLearnerOperationsForChapter); this
-- migration corrects the already-frozen historical rows in one pass.
--
-- HOW: recompute each level from slides, bottom-up (chapter first from slides, then
-- module from fresh chapters, subject from fresh modules, package_session from fresh
-- subjects), using the SAME structural denominators the cascade uses
-- (ActivityLogRepository.getModule/Subject/PackageSessionCompletionPercentage) so
-- these values equal what the fixed cascade will produce from here on.
--
-- Idempotent: values are derived purely from current slide data, so re-running is a
-- no-op (the `value IS DISTINCT FROM` guard skips unchanged rows). Only refreshes
-- rows that already exist; learners whose MODULE/SUBJECT/PS rows were never created
-- self-heal via the fixed cascade on their next slide completion.
--
-- NOTE: this is a data UPDATE over learner_operation. On a large production table
-- run the deploy in a low-traffic window.
-- ============================================================================

-- 1. CHAPTER = mean over the chapter's published slides of slide% (cap 100,
--    missing op = 0). Scoped to (user, chapter) pairs with a stored CHAPTER row.
WITH user_chapters AS (
    SELECT user_id, source_id AS chapter_id
    FROM learner_operation
    WHERE source = 'CHAPTER' AND operation = 'PERCENTAGE_CHAPTER_COMPLETED'
),
slide_pct AS (
    SELECT uc.user_id, uc.chapter_id, cts.slide_id,
        COALESCE(MAX(CASE
            WHEN slo.operation IN ('PERCENTAGE_VIDEO_WATCHED','PERCENTAGE_DOCUMENT_COMPLETED',
                                   'PERCENTAGE_QUIZ_COMPLETED','PERCENTAGE_QUESTION_COMPLETED',
                                   'PERCENTAGE_ASSIGNMENT_COMPLETED')
                 AND slo.value ~ '^[0-9]+(\.[0-9]+)?$'
            THEN LEAST(slo.value::float, 100) ELSE NULL END), 0) AS slide_pct
    FROM user_chapters uc
    JOIN chapter_to_slides cts ON cts.chapter_id = uc.chapter_id AND cts.status IN ('PUBLISHED','UNSYNC')
    JOIN slide s ON s.id = cts.slide_id AND s.status IN ('PUBLISHED','UNSYNC')
    LEFT JOIN learner_operation slo
        ON slo.user_id = uc.user_id AND slo.source = 'SLIDE' AND slo.source_id = cts.slide_id
    GROUP BY uc.user_id, uc.chapter_id, cts.slide_id
),
chapter_pct AS (
    SELECT user_id, chapter_id, AVG(slide_pct) AS pct
    FROM slide_pct GROUP BY user_id, chapter_id
)
UPDATE learner_operation lo
SET value = chapter_pct.pct::text, updated_at = now()
FROM chapter_pct
WHERE lo.user_id = chapter_pct.user_id
  AND lo.source = 'CHAPTER'
  AND lo.source_id = chapter_pct.chapter_id
  AND lo.operation = 'PERCENTAGE_CHAPTER_COMPLETED'
  AND lo.value IS DISTINCT FROM chapter_pct.pct::text;

-- 2. MODULE = SUM(chapter%) / COUNT(distinct structural chapters).
WITH module_pct AS (
    SELECT lo.user_id, lo.source_id AS module_id,
        COALESCE(SUM(CASE WHEN ch.value ~ '^-?[0-9]+(\.[0-9]+)?$' THEN ch.value::float ELSE 0 END), 0)
            / NULLIF(COUNT(*), 0) AS pct
    FROM learner_operation lo
    JOIN LATERAL (
        SELECT DISTINCT mcm.chapter_id
        FROM module_chapter_mapping mcm
        JOIN chapter c ON c.id = mcm.chapter_id AND c.status IN ('ACTIVE')
        JOIN chapter_package_session_mapping cpsm ON cpsm.chapter_id = c.id AND cpsm.status IN ('ACTIVE')
        WHERE mcm.module_id = lo.source_id
    ) dm ON true
    LEFT JOIN learner_operation ch
        ON ch.user_id = lo.user_id AND ch.source = 'CHAPTER'
        AND ch.source_id = dm.chapter_id AND ch.operation = 'PERCENTAGE_CHAPTER_COMPLETED'
    WHERE lo.source = 'MODULE' AND lo.operation = 'PERCENTAGE_MODULE_COMPLETED'
    GROUP BY lo.user_id, lo.source_id
)
UPDATE learner_operation lo
SET value = module_pct.pct::text, updated_at = now()
FROM module_pct
WHERE lo.user_id = module_pct.user_id
  AND lo.source = 'MODULE'
  AND lo.source_id = module_pct.module_id
  AND lo.operation = 'PERCENTAGE_MODULE_COMPLETED'
  AND lo.value IS DISTINCT FROM module_pct.pct::text;

-- 3. SUBJECT = SUM(module%) / COUNT(distinct modules in subject).
WITH subject_pct AS (
    SELECT lo.user_id, lo.source_id AS subject_id,
        COALESCE(SUM(CASE WHEN mo.value ~ '^-?[0-9]+(\.[0-9]+)?$' THEN mo.value::float ELSE 0 END), 0)
            / NULLIF(COUNT(DISTINCT smm.module_id), 0) AS pct
    FROM learner_operation lo
    JOIN subject_module_mapping smm ON smm.subject_id = lo.source_id
    JOIN modules m ON m.id = smm.module_id AND m.status IN ('ACTIVE')
    LEFT JOIN learner_operation mo
        ON mo.user_id = lo.user_id AND mo.source = 'MODULE'
        AND mo.source_id = m.id AND mo.operation = 'PERCENTAGE_MODULE_COMPLETED'
    WHERE lo.source = 'SUBJECT' AND lo.operation = 'PERCENTAGE_SUBJECT_COMPLETED'
    GROUP BY lo.user_id, lo.source_id
)
UPDATE learner_operation lo
SET value = subject_pct.pct::text, updated_at = now()
FROM subject_pct
WHERE lo.user_id = subject_pct.user_id
  AND lo.source = 'SUBJECT'
  AND lo.source_id = subject_pct.subject_id
  AND lo.operation = 'PERCENTAGE_SUBJECT_COMPLETED'
  AND lo.value IS DISTINCT FROM subject_pct.pct::text;

-- 4. PACKAGE_SESSION = SUM(subject%) / COUNT(distinct subjects in session).
WITH ps_pct AS (
    SELECT lo.user_id, lo.source_id AS package_session_id,
        COALESCE(SUM(CASE WHEN su.value ~ '^-?[0-9]+(\.[0-9]+)?$' THEN su.value::float ELSE 0 END), 0)
            / NULLIF(COUNT(DISTINCT sps.subject_id), 0) AS pct
    FROM learner_operation lo
    JOIN subject_session sps ON sps.session_id = lo.source_id
    JOIN subject s ON s.id = sps.subject_id AND s.status IN ('ACTIVE')
    LEFT JOIN learner_operation su
        ON su.user_id = lo.user_id AND su.source = 'SUBJECT'
        AND su.source_id = s.id AND su.operation = 'PERCENTAGE_SUBJECT_COMPLETED'
    WHERE lo.source = 'PACKAGE_SESSION' AND lo.operation = 'PERCENTAGE_PACKAGE_SESSION_COMPLETED'
    GROUP BY lo.user_id, lo.source_id
)
UPDATE learner_operation lo
SET value = ps_pct.pct::text, updated_at = now()
FROM ps_pct
WHERE lo.user_id = ps_pct.user_id
  AND lo.source = 'PACKAGE_SESSION'
  AND lo.source_id = ps_pct.package_session_id
  AND lo.operation = 'PERCENTAGE_PACKAGE_SESSION_COMPLETED'
  AND lo.value IS DISTINCT FROM ps_pct.pct::text;
