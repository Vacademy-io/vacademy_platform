-- ============================================================================
-- V423: Repair stored progress rollups that under-count SCORM / AUDIO /
--       ASSESSMENT slide completions.
--
-- WHY
-- ---
-- A slide's completion is stored in learner_operation under a per-type
-- operation name (PERCENTAGE_SCORM_COMPLETED, PERCENTAGE_AUDIO_LISTENED,
-- PERCENTAGE_ASSESSMENT_DONE, ...). Every query that averages slides into a
-- chapter percentage carries its own copy of "which operations count".
--
-- V410's copy listed only five of the eight, and an unmatched slide is not
-- skipped there -- the CASE yields NULL and COALESCE turns it into 0. So a
-- learner who had genuinely completed a SCORM lesson had that slide averaged
-- in as 0%, and V410's own bottom-up steps carried the zero upward into the
-- module, subject and package_session rows. (The write-side cascade in
-- LearnerTrackingAsyncService has always had the full list and is not at
-- fault; it is the backfill that overwrote its correct output.)
--
-- Measured on production before this migration: 109 chapter rows are wrong --
-- 93 understated (average 45 percentage points lost) and 16 overstated --
-- across ~85 learners in 5 institutes. These do not self-heal: a stored
-- rollup is only recomputed when that learner generates fresh activity in
-- that chapter, so a learner who finished the content and moved on stays
-- wrong indefinitely.
--
-- The three live read queries that shared V410's short list are fixed in the
-- same change as this migration (ModuleChapterMappingRepository
-- #getModuleChapterProgress / #getModuleChapterProgressWithSlides,
-- ActivityLogRepository #getModuleCompletionByUserAndBatch). This file only
-- repairs the historical damage.
--
-- V410 itself is deliberately left untouched: Flyway validates a checksum for
-- every applied migration, so editing it would fail startup everywhere.
--
-- SCOPE
-- -----
-- Deliberately narrow. Only (learner, chapter) pairs where the chapter
-- actually contains a SCORM / AUDIO / ASSESSMENT slide can have been hit by
-- this defect, so only those are recomputed -- plus the module / subject /
-- package_session rows above the chapters that actually changed. Not
-- institute-scoped: the same defect damaged five institutes and the repair is
-- identical for all of them.
--
-- SAFETY
-- ------
--   * Only ever UPDATEs rows that already exist. Never inserts. A learner
--     with no stored rollup is left to the live cascade, so this migration
--     cannot invent progress for someone who has none.
--   * Corrects in both directions. The 16 overstated rows are lowered; they
--     would drop anyway on those learners' next activity, so this brings the
--     correction forward rather than causing it.
--   * Idempotent -- values are derived purely from current slide data and the
--     numeric-tolerance guard skips rows already correct, so a re-run is a
--     no-op.
--   * Mirrors the live queries in ActivityLogRepository
--     (#getChapterCompletionPercentage and the three rollup queries) formula
--     for formula, including the cap at 100 that
--     LearnerTrackingAsyncService#addOrUpdatePercentageOperation applies
--     before writing. This matters: if the repair computed a "better" number
--     than the live code, the next cascade run would overwrite it and the fix
--     would silently undo itself.
--     One intentional difference -- the joins below pin `source = 'SLIDE'` /
--     `'CHAPTER'` / `'MODULE'` / `'SUBJECT'`, which the live queries omit.
--     source_ids are UUIDs so a cross-level collision is not realistic, but
--     the join is wrong without it and the runbook script already pins it.
--   * Emits row counts per level via RAISE NOTICE so the deploy log records
--     what was changed.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. CHAPTER = mean over the chapter's mapped slides of each slide's
--    completion (missing operation = 0), capped at 100.
-- ---------------------------------------------------------------------------

-- Candidate (learner, chapter) pairs: a stored chapter row, for a chapter that
-- contains at least one slide of an affected type.
DROP TABLE IF EXISTS tmp_v423_scope;
CREATE TEMP TABLE tmp_v423_scope AS
SELECT DISTINCT lo.user_id, lo.source_id AS chapter_id
FROM learner_operation lo
WHERE lo.source = 'CHAPTER'
  AND lo.operation = 'PERCENTAGE_CHAPTER_COMPLETED'
  AND EXISTS (
      SELECT 1
      FROM chapter_to_slides cts
      JOIN slide s ON s.id = cts.slide_id
      WHERE cts.chapter_id = lo.source_id
        AND cts.status IN ('PUBLISHED', 'UNSYNC')
        AND s.source_type IN ('SCORM', 'AUDIO', 'ASSESSMENT')
  );

DROP TABLE IF EXISTS tmp_v423_chapter_calc;
CREATE TEMP TABLE tmp_v423_chapter_calc AS
SELECT sc.user_id,
       sc.chapter_id,
       LEAST(
           COALESCE(SUM(CAST(lo.value AS numeric)), 0)
               / NULLIF(COUNT(DISTINCT cs.slide_id), 0),
           100
       ) AS correct_pct
FROM tmp_v423_scope sc
JOIN chapter_to_slides cs
     ON cs.chapter_id = sc.chapter_id
    AND cs.status IN ('PUBLISHED', 'UNSYNC')
JOIN slide s
     ON s.id = cs.slide_id
    AND s.source_type IN ('VIDEO', 'DOCUMENT', 'ASSIGNMENT', 'QUESTION', 'QUIZ',
                          'HTML_VIDEO', 'AUDIO', 'SCORM', 'ASSESSMENT')
LEFT JOIN learner_operation lo
     ON lo.source = 'SLIDE'
    AND lo.source_id = cs.slide_id
    AND lo.user_id = sc.user_id
    AND lo.operation IN ('PERCENTAGE_VIDEO_WATCHED', 'PERCENTAGE_DOCUMENT_COMPLETED',
                         'PERCENTAGE_ASSIGNMENT_COMPLETED', 'PERCENTAGE_QUESTION_COMPLETED',
                         'PERCENTAGE_QUIZ_COMPLETED', 'PERCENTAGE_AUDIO_LISTENED',
                         'PERCENTAGE_SCORM_COMPLETED', 'PERCENTAGE_ASSESSMENT_DONE')
    AND lo.value ~ '^-?[0-9]+(\.[0-9]+)?$'
GROUP BY sc.user_id, sc.chapter_id;

-- A chapter with no countable slides yields NULL (NULLIF on the denominator).
-- The live cascade drops such a value rather than storing 0, so we skip it too.
DROP TABLE IF EXISTS tmp_v423_chapter_changed;
CREATE TEMP TABLE tmp_v423_chapter_changed AS
WITH upd AS (
    UPDATE learner_operation lo
    SET value = calc.correct_pct::text,
        updated_at = now()
    FROM tmp_v423_chapter_calc calc
    WHERE lo.source = 'CHAPTER'
      AND lo.operation = 'PERCENTAGE_CHAPTER_COMPLETED'
      AND lo.user_id = calc.user_id
      AND lo.source_id = calc.chapter_id
      AND calc.correct_pct IS NOT NULL
      AND (lo.value !~ '^-?[0-9]+(\.[0-9]+)?$'
           OR ABS(CAST(lo.value AS numeric) - calc.correct_pct) > 0.01)
    RETURNING lo.user_id, lo.source_id AS chapter_id
)
SELECT * FROM upd;

DO $$
DECLARE v_count bigint;
BEGIN
    SELECT count(*) INTO v_count FROM tmp_v423_chapter_changed;
    RAISE NOTICE 'V423: CHAPTER rows repaired: %', v_count;
END $$;

-- ---------------------------------------------------------------------------
-- 2. MODULE = mean over the module's ACTIVE, batch-mapped chapters of the
--    stored chapter percentage (missing chapter row = 0).
--    Only modules above a chapter we actually changed.
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS tmp_v423_module_changed;
CREATE TEMP TABLE tmp_v423_module_changed AS
WITH scope AS (
    SELECT DISTINCT cc.user_id, mcm.module_id
    FROM tmp_v423_chapter_changed cc
    JOIN module_chapter_mapping mcm ON mcm.chapter_id = cc.chapter_id
),
calc AS (
    SELECT sco.user_id,
           sco.module_id,
           LEAST(
               COALESCE(SUM(CAST(ch.value AS numeric)), 0)
                   / NULLIF(COUNT(*), 0),
               100
           ) AS correct_pct
    FROM scope sco
    JOIN LATERAL (
        SELECT DISTINCT mcm.chapter_id
        FROM module_chapter_mapping mcm
        JOIN chapter c ON c.id = mcm.chapter_id AND c.status IN ('ACTIVE')
        JOIN chapter_package_session_mapping cpsm
             ON cpsm.chapter_id = c.id AND cpsm.status IN ('ACTIVE')
        WHERE mcm.module_id = sco.module_id
    ) dc ON true
    LEFT JOIN learner_operation ch
         ON ch.source = 'CHAPTER'
        AND ch.source_id = dc.chapter_id
        AND ch.user_id = sco.user_id
        AND ch.operation = 'PERCENTAGE_CHAPTER_COMPLETED'
        AND ch.value ~ '^-?[0-9]+(\.[0-9]+)?$'
    GROUP BY sco.user_id, sco.module_id
),
upd AS (
    UPDATE learner_operation lo
    SET value = calc.correct_pct::text,
        updated_at = now()
    FROM calc
    WHERE lo.source = 'MODULE'
      AND lo.operation = 'PERCENTAGE_MODULE_COMPLETED'
      AND lo.user_id = calc.user_id
      AND lo.source_id = calc.module_id
      AND calc.correct_pct IS NOT NULL
      AND (lo.value !~ '^-?[0-9]+(\.[0-9]+)?$'
           OR ABS(CAST(lo.value AS numeric) - calc.correct_pct) > 0.01)
    RETURNING lo.user_id, lo.source_id AS module_id
)
SELECT * FROM upd;

DO $$
DECLARE v_count bigint;
BEGIN
    SELECT count(*) INTO v_count FROM tmp_v423_module_changed;
    RAISE NOTICE 'V423: MODULE rows repaired: %', v_count;
END $$;

-- ---------------------------------------------------------------------------
-- 3. SUBJECT = mean over the subject's ACTIVE modules of the stored module
--    percentage (missing module row = 0).
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS tmp_v423_subject_changed;
CREATE TEMP TABLE tmp_v423_subject_changed AS
WITH scope AS (
    SELECT DISTINCT mc.user_id, smm.subject_id
    FROM tmp_v423_module_changed mc
    JOIN subject_module_mapping smm ON smm.module_id = mc.module_id
),
calc AS (
    SELECT sco.user_id,
           sco.subject_id,
           LEAST(
               COALESCE(SUM(CAST(mo.value AS numeric)), 0)
                   / NULLIF(COUNT(DISTINCT smm.module_id), 0),
               100
           ) AS correct_pct
    FROM scope sco
    JOIN subject_module_mapping smm ON smm.subject_id = sco.subject_id
    JOIN modules m ON m.id = smm.module_id AND m.status IN ('ACTIVE')
    LEFT JOIN learner_operation mo
         ON mo.source = 'MODULE'
        AND mo.source_id = m.id
        AND mo.user_id = sco.user_id
        AND mo.operation = 'PERCENTAGE_MODULE_COMPLETED'
        AND mo.value ~ '^-?[0-9]+(\.[0-9]+)?$'
    GROUP BY sco.user_id, sco.subject_id
),
upd AS (
    UPDATE learner_operation lo
    SET value = calc.correct_pct::text,
        updated_at = now()
    FROM calc
    WHERE lo.source = 'SUBJECT'
      AND lo.operation = 'PERCENTAGE_SUBJECT_COMPLETED'
      AND lo.user_id = calc.user_id
      AND lo.source_id = calc.subject_id
      AND calc.correct_pct IS NOT NULL
      AND (lo.value !~ '^-?[0-9]+(\.[0-9]+)?$'
           OR ABS(CAST(lo.value AS numeric) - calc.correct_pct) > 0.01)
    RETURNING lo.user_id, lo.source_id AS subject_id
)
SELECT * FROM upd;

DO $$
DECLARE v_count bigint;
BEGIN
    SELECT count(*) INTO v_count FROM tmp_v423_subject_changed;
    RAISE NOTICE 'V423: SUBJECT rows repaired: %', v_count;
END $$;

-- ---------------------------------------------------------------------------
-- 4. PACKAGE_SESSION = mean over the session's ACTIVE subjects of the stored
--    subject percentage (missing subject row = 0). This is the number the
--    learner sees as course completion and the one certificate eligibility
--    is gated on.
-- ---------------------------------------------------------------------------

DROP TABLE IF EXISTS tmp_v423_ps_changed;
CREATE TEMP TABLE tmp_v423_ps_changed AS
WITH scope AS (
    SELECT DISTINCT sc.user_id, ss.session_id AS package_session_id
    FROM tmp_v423_subject_changed sc
    JOIN subject_session ss ON ss.subject_id = sc.subject_id
),
calc AS (
    SELECT sco.user_id,
           sco.package_session_id,
           LEAST(
               COALESCE(SUM(CAST(su.value AS numeric)), 0)
                   / NULLIF(COUNT(DISTINCT sps.subject_id), 0),
               100
           ) AS correct_pct
    FROM scope sco
    JOIN subject_session sps ON sps.session_id = sco.package_session_id
    JOIN subject s ON s.id = sps.subject_id AND s.status IN ('ACTIVE')
    LEFT JOIN learner_operation su
         ON su.source = 'SUBJECT'
        AND su.source_id = s.id
        AND su.user_id = sco.user_id
        AND su.operation = 'PERCENTAGE_SUBJECT_COMPLETED'
        AND su.value ~ '^-?[0-9]+(\.[0-9]+)?$'
    GROUP BY sco.user_id, sco.package_session_id
),
upd AS (
    UPDATE learner_operation lo
    SET value = calc.correct_pct::text,
        updated_at = now()
    FROM calc
    WHERE lo.source = 'PACKAGE_SESSION'
      AND lo.operation = 'PERCENTAGE_PACKAGE_SESSION_COMPLETED'
      AND lo.user_id = calc.user_id
      AND lo.source_id = calc.package_session_id
      AND calc.correct_pct IS NOT NULL
      AND (lo.value !~ '^-?[0-9]+(\.[0-9]+)?$'
           OR ABS(CAST(lo.value AS numeric) - calc.correct_pct) > 0.01)
    RETURNING lo.user_id, lo.source_id AS package_session_id
)
SELECT * FROM upd;

DO $$
DECLARE v_count bigint;
BEGIN
    SELECT count(*) INTO v_count FROM tmp_v423_ps_changed;
    RAISE NOTICE 'V423: PACKAGE_SESSION rows repaired: %', v_count;
END $$;

-- Scratch tables are session-scoped; drop them explicitly so the file behaves
-- the same under Flyway (one transaction) and a manual psql run (autocommit).
DROP TABLE IF EXISTS tmp_v423_scope;
DROP TABLE IF EXISTS tmp_v423_chapter_calc;
DROP TABLE IF EXISTS tmp_v423_chapter_changed;
DROP TABLE IF EXISTS tmp_v423_module_changed;
DROP TABLE IF EXISTS tmp_v423_subject_changed;
DROP TABLE IF EXISTS tmp_v423_ps_changed;
