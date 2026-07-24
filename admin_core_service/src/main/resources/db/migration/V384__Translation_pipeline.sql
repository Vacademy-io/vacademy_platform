-- =============================================================================
-- V384: Content translation pipeline (i18n Phase 1 Wave 1 — Arabic-first)
-- -----------------------------------------------------------------------------
-- Backs ai_service's translation stage machine (app/services/translation_service.py):
--   • translation_memory   — exact-hash translation cache (TM). A hit is served
--     free; only LLM misses are billed. institute_id NULL = global/shared row.
--   • ai_translation_job   — one row per course/package-session translation job
--     (stage machine PENDING → EXTRACT → TRANSLATE → REVIEW → WRITE_BACK →
--     COMPLETED, with REVIEW parking as AWAITING_INPUT in DRAFT mode).
--   • ai_tool_pricing seeds — parametric credit rates for the translation tools
--     (V321/V365 pattern). All rates below are OPS-TUNABLE PLACEHOLDERS: edit
--     the rows and ai_service picks them up on the next request. They MUST
--     agree with DEFAULT_TOOL_PRICING in
--     ai_service/app/services/tool_cost_estimator.py (code fallback when a row
--     is missing/inactive) — the DB row wins while active.
--   • ai_token_usage request_type CHECK — extended with 'translation'.
--
-- OWNERSHIP CAVEAT (prod): ALTER TABLE requires table ownership. ai_token_usage
-- was already ALTERed by V345/V365 under the app user, so the DROP/ADD
-- CONSTRAINT below is safe. If a restored environment reports 42501, re-run the
-- per-object `ALTER TABLE ... OWNER TO <app_user>` loop before this migration.
--
-- Translated CONTENT rows are sidecars keyed on canonical IDs (rich_text_id /
-- entity_type+entity_id+field) written through admin_core's internal
-- batch-upsert endpoint — ai_service never writes those tables directly. The
-- two tables below are pipeline bookkeeping only, owned by ai_service.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Translation memory — exact source_hash cache, per institute or global.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS translation_memory (
    id            VARCHAR(255) PRIMARY KEY,
    institute_id  VARCHAR(255),                         -- NULL = global/shared entry
    source_locale VARCHAR(10)  NOT NULL,
    target_locale VARCHAR(10)  NOT NULL,
    source_hash   VARCHAR(64)  NOT NULL,                -- sha256 hex of source_text
    source_text   TEXT         NOT NULL,
    target_text   TEXT         NOT NULL,
    quality       VARCHAR(20)  NOT NULL DEFAULT 'AI',   -- AI | HUMAN_REVIEWED
    domain        VARCHAR(40),                          -- CONTENT | UI | NOTIFICATION | ...
    created_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_translation_memory_entry
        UNIQUE (institute_id, source_locale, target_locale, source_hash)
);

-- Postgres UNIQUE treats NULLs as distinct, so the constraint above cannot
-- dedupe GLOBAL rows (institute_id IS NULL). Partial unique index closes that
-- hole; writers use INSERT ... ON CONFLICT DO NOTHING (targetless), which
-- honors both.
CREATE UNIQUE INDEX IF NOT EXISTS uq_translation_memory_global
    ON translation_memory (source_locale, target_locale, source_hash)
    WHERE institute_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_translation_memory_lookup
    ON translation_memory (source_hash, target_locale);

-- -----------------------------------------------------------------------------
-- 2. Translation jobs — stage-machine bookkeeping (resumable by stage).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ai_translation_job (
    id                 VARCHAR(255) PRIMARY KEY,
    institute_id       VARCHAR(255) NOT NULL,
    package_session_id VARCHAR(255),                        -- NULL for non-course scopes
    source_locale      VARCHAR(10)  NOT NULL DEFAULT 'en',
    target_locale      VARCHAR(10)  NOT NULL,
    scope              VARCHAR(40)  NOT NULL,               -- FULL | ... (v1: FULL)
    mode               VARCHAR(20)  NOT NULL DEFAULT 'DRAFT',    -- DRAFT | AUTO_PUBLISH
    status             VARCHAR(30)  NOT NULL DEFAULT 'PENDING',  -- PENDING | IN_PROGRESS | AWAITING_INPUT | COMPLETED | FAILED
    current_stage      VARCHAR(30)  NOT NULL DEFAULT 'PENDING',  -- PENDING | EXTRACT | TRANSLATE | REVIEW | WRITE_BACK | COMPLETED
    items_total        INT,
    items_done         INT          NOT NULL DEFAULT 0,
    artifacts          JSONB        NOT NULL DEFAULT '{}'::jsonb, -- manifest / translations / failed_items / write_back
    error_message      TEXT,
    created_by         VARCHAR(255),
    created_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at         TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_translation_job_institute ON ai_translation_job (institute_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_translation_job_status    ON ai_translation_job (status);
CREATE INDEX IF NOT EXISTS idx_ai_translation_job_ps        ON ai_translation_job (package_session_id);

-- -----------------------------------------------------------------------------
-- 3. Parametric tool pricing seeds (V365 pattern). Ops-tunable placeholders.
--    chars formula (V321): flat_base + ceil(chars / params.chars_per_unit) × per_unit
--    so 0.02 per 100 chars = per_unit_credits 0.02 + chars_per_unit 100.
--    'dub_video' has NO code path yet (media variants are a later wave) — the
--    row is seeded now so ops can calibrate before launch.
-- -----------------------------------------------------------------------------
INSERT INTO ai_tool_pricing (tool_key, request_type, flat_base_credits, per_unit_credits, unit_field, params_json)
VALUES
    -- Per rich-text/entity-field item translated by the LLM (TM hits are free).
    ('translate_rich_text', 'translation', 0,    0.02, 'chars',         '{"chars_per_unit": 100}'::jsonb),
    -- Per question translated (future per-question endpoint; placeholder).
    ('translate_question',  'translation', 0.3,  0,    'flat',          '{}'),
    -- Whole-course job base — backs the 402 preflight on POST /translation/v1/course.
    ('translate_course',    'translation', 25,   0,    'flat',          '{}'),
    -- Synchronous UI/notification string batch (per 100 chars of LLM misses).
    ('translate_strings',   'translation', 0,    0.01, 'chars',         '{"chars_per_unit": 100}'::jsonb),
    -- Audio dubbing per minute (no code path yet — later wave).
    ('dub_video',           'translation', 0,    3.0,  'audio_minutes', '{}')
ON CONFLICT (tool_key) DO NOTHING;

-- -----------------------------------------------------------------------------
-- 4. Extend the ai_token_usage request_type CHECK with 'translation'.
--    THIS IS THE DOCUMENTED SILENT-NO-OP TRAP (V102/V217/V225/V325/V345/V365):
--    charging RequestType.TRANSLATION without this makes every usage insert
--    CheckViolate, best-effort billing swallows it, and NO credits are ever
--    deducted. The constraint update ships in the SAME migration as the
--    pricing rows — no exceptions. Expand-only: strict superset of V365.
--    Keep in sync with RequestType in ai_service/app/models/ai_token_usage.py.
-- -----------------------------------------------------------------------------
ALTER TABLE ai_token_usage DROP CONSTRAINT IF EXISTS ai_token_usage_request_type_check;

ALTER TABLE ai_token_usage ADD CONSTRAINT ai_token_usage_request_type_check
    CHECK (request_type IN (
        'outline',
        'image',
        'content',
        'video',
        'tts',
        'tts_premium',
        'embedding',
        'evaluation',
        'presentation',
        'conversation',
        'lecture',
        'course_content',
        'pdf_questions',
        'agent',
        'analytics',
        'copilot',
        'incident',
        'question_metadata',
        'stock',
        'avatar_video',
        'reels_preview',
        'ai_video',
        'assessment',
        'notes',
        'transcription',
        'call_intelligence',
        'coding_question',
        'translation'
    ));

-- -----------------------------------------------------------------------------
-- 5. Model-registry use-case default for translation (V101 table). Cheap,
--    high-context primary (1M-token window handles long HTML documents), cheap
--    fallback. DO NOTHING so an ops-tuned row is never clobbered on re-deploy.
-- -----------------------------------------------------------------------------
INSERT INTO ai_model_defaults (use_case, default_model_id, fallback_model_id, free_tier_model_id, description)
VALUES ('translation', 'google/gemini-2.5-flash', 'deepseek/deepseek-v3.2', 'xiaomi/mimo-v2-flash:free',
        'Content/UI translation (HTML-preserving, glossary-constrained)')
ON CONFLICT (use_case) DO NOTHING;
