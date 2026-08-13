-- ================================================================================
-- V444: what has been CREATED from a knowledge base
--
-- Today a knowledge base can produce a question paper. Next it will produce
-- courses, presentations, quizzes. Right now none of that is remembered: a
-- generation exists only inside one browser tab, so navigating away, closing the
-- laptop, or a job failing loses the work AND the plan that produced it — and
-- the teacher has no way to see it ever happened.
--
-- This is the record of every artifact a knowledge base has produced.
--
-- DELIBERATELY ARTIFACT-AGNOSTIC. `artifact_type` is a widened CHECK rather than
-- one table per capability, and the shape-specific parts live in JSONB:
--
--   input_json   what the user asked for (scope, spec, blueprint). This is what
--                makes RESUME possible — reopening a generation restores the
--                plan, not just the output.
--   result_json  what came back. Stored here rather than only on ai_task so the
--                history is self-contained and survives task housekeeping.
--
-- Adding "course" later is one value in the CHECK plus a renderer in the UI; no
-- new table, no new endpoints.
--
-- It also closes a real observability gap. A paper generation lives in an
-- asyncio task; when it died (see the shared-Session ProtocolViolation) the only
-- evidence was an ai_task row nobody surfaces. A row here is visible in the UI,
-- so a failed run is something a teacher can SEE and retry instead of a spinner
-- that silently never resolves.
-- ================================================================================

CREATE TABLE IF NOT EXISTS knowledge_base_generation (
    id                 VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid()::text,
    knowledge_base_id  VARCHAR(255) NOT NULL REFERENCES knowledge_base (id) ON DELETE CASCADE,
    -- Denormalized so every tenant-scoped read stays single-table.
    institute_id       VARCHAR(255) NOT NULL,

    artifact_type      VARCHAR(30)  NOT NULL,
    title              VARCHAR(500) NOT NULL,

    -- DRAFT      planned but not generated (a blueprint the user stepped away from)
    -- GENERATING running now
    -- READY      generated, not yet saved anywhere
    -- SAVED      pushed to its destination (e.g. the question bank)
    -- FAILED     did not finish; error_message says why
    status             VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',
    progress           INTEGER      NOT NULL DEFAULT 0,

    -- The request: scope + spec + blueprint. Resume reads THIS.
    input_json         JSONB        NOT NULL DEFAULT '{}'::jsonb,
    -- The output. Null until the run completes.
    result_json        JSONB,

    -- Where it ended up once saved, in whichever service owns it
    -- (question_paper id in assessment_service, course id in admin_core, …).
    external_id        VARCHAR(255),
    external_type      VARCHAR(50),

    ai_task_id         VARCHAR(255),
    items_planned      INTEGER      NOT NULL DEFAULT 0,
    items_delivered    INTEGER      NOT NULL DEFAULT 0,
    credits_charged    DECIMAL(10,4) NOT NULL DEFAULT 0,
    error_message      TEXT,

    created_by         VARCHAR(255),
    created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    -- Widen this list as capabilities land; the rest of the table is unchanged.
    CONSTRAINT kb_generation_artifact_type_valid
        CHECK (artifact_type IN (
            'QUESTION_PAPER', 'COURSE', 'PRESENTATION', 'QUIZ', 'ASSESSMENT',
            'NOTES', 'SUMMARY', 'LESSON_PLAN', 'WORKSHEET'
        )),
    CONSTRAINT kb_generation_status_valid
        CHECK (status IN ('DRAFT', 'GENERATING', 'READY', 'SAVED', 'FAILED')),
    CONSTRAINT kb_generation_progress_range
        CHECK (progress BETWEEN 0 AND 100)
);

-- The history list: newest first, for one knowledge base.
CREATE INDEX IF NOT EXISTS idx_kb_generation_kb
    ON knowledge_base_generation (knowledge_base_id, created_at DESC);

-- "Everything this institute has made", across knowledge bases.
CREATE INDEX IF NOT EXISTS idx_kb_generation_institute
    ON knowledge_base_generation (institute_id, artifact_type, created_at DESC);

-- Finding a run from its background job (status/progress updates).
CREATE INDEX IF NOT EXISTS idx_kb_generation_task
    ON knowledge_base_generation (ai_task_id) WHERE ai_task_id IS NOT NULL;

COMMENT ON TABLE knowledge_base_generation IS
    'Every artifact created from a knowledge base — question papers today, courses '
    'and presentations later. input_json holds the request so a generation can be '
    'resumed; result_json holds the output so the history is self-contained.';
