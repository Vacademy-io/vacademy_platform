-- i18n Phase 1 (Arabic-first content translation): sidecar translation tables.
--
-- Translations are SIDECAR rows keyed on canonical ids — never copies of the
-- canonical row, never in-place mutation. Requesting locale 'en' (or a locale
-- with no translation rows) leaves every existing flow byte-identical to today:
-- delivery does a per-item swap only when a PUBLISHED/STALE row exists.
--
-- State machine per row: DRAFT -> IN_REVIEW -> PUBLISHED; PUBLISHED -> STALE
-- when the canonical source text changes (detected via source_hash mismatch).
-- Learner delivery serves PUBLISHED and STALE (stale is still better than
-- English for an Arabic reader); admin tooling uses STALE to queue re-runs.
--
-- =============================================================================
-- !! PROD OPS WARNING (42501) !!
-- This migration ALTERs the existing student_attempt table. On prod, several
-- legacy tables are owned by the `postgres` superuser rather than the service
-- role, so ALTER TABLE fails with SQLSTATE 42501 (insufficient_privilege) and
-- Flyway marks the migration failed. BEFORE deploying this migration to prod,
-- run the known per-object ownership runbook loop on the assessment DB:
--
--   DO $$ DECLARE r record; BEGIN
--     FOR r IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
--     LOOP EXECUTE format('ALTER TABLE public.%I OWNER TO <service_role>', r.tablename); END LOOP;
--   END $$;
--
-- (see ops runbook: "Prod table-ownership Flyway 42501"). The CREATE TABLE
-- statements below are unaffected — new tables are owned by the migrating role.
-- =============================================================================

-- 1. Translations of assessment_rich_text_data rows (question text, comprehension
-- passages, option text, section descriptions, explanations). rich_text_id
-- references assessment_rich_text_data.id BY CONVENTION (no FK: rich text rows
-- are written from several flows and a hard FK would couple translation writes
-- to canonical-row lifecycle; orphans are harmless and reaped by staleness).
CREATE TABLE IF NOT EXISTS public.rich_text_translation (
    id              varchar(255) PRIMARY KEY,
    rich_text_id    varchar(255) NOT NULL,          -- assessment_rich_text_data.id (by convention)
    locale          varchar(10)  NOT NULL,          -- BCP-47 primary subtag (LocaleRegistry)
    content         text         NOT NULL,          -- translated text/HTML, same format as canonical `type`
    state           varchar(20)  NOT NULL DEFAULT 'DRAFT',  -- DRAFT | IN_REVIEW | PUBLISHED | STALE
    source_locale   varchar(10)  NOT NULL DEFAULT 'en',
    source_hash     varchar(64)  NULL,              -- sha256 of the canonical content this was translated from
    translated_by   varchar(255) NULL,              -- "AI:<model>" or "USER:<id>"
    created_at      timestamp    DEFAULT CURRENT_TIMESTAMP,
    updated_at      timestamp    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_rich_text_translation UNIQUE (rich_text_id, locale)
);

-- Partial index: learner delivery only ever asks for servable states.
CREATE INDEX IF NOT EXISTS idx_rtt_servable
    ON public.rich_text_translation (rich_text_id, locale)
    WHERE state IN ('PUBLISHED', 'STALE');

-- Admin/AI tooling: everything pending for a locale.
CREATE INDEX IF NOT EXISTS idx_rtt_state_locale
    ON public.rich_text_translation (locale, state);

-- 2. Translations of plain entity columns that are NOT rich-text rows
-- (e.g. section.name, assessment title/instructions fields).
CREATE TABLE IF NOT EXISTS public.entity_field_translation (
    id              varchar(255) PRIMARY KEY,
    entity_type     varchar(100) NOT NULL,          -- e.g. 'SECTION', 'ASSESSMENT'
    entity_id       varchar(255) NOT NULL,          -- canonical row id (by convention)
    field           varchar(100) NOT NULL,          -- canonical column/field name, e.g. 'name'
    locale          varchar(10)  NOT NULL,
    content         text         NULL,              -- translated scalar text
    json_value      jsonb        NULL,              -- optional structured payload (contract: ENTITY_FIELD only)
    state           varchar(20)  NOT NULL DEFAULT 'DRAFT',  -- DRAFT | IN_REVIEW | PUBLISHED | STALE
    source_locale   varchar(10)  NOT NULL DEFAULT 'en',
    source_hash     varchar(64)  NULL,
    translated_by   varchar(255) NULL,
    created_at      timestamp    DEFAULT CURRENT_TIMESTAMP,
    updated_at      timestamp    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_entity_field_translation UNIQUE (entity_type, entity_id, field, locale)
);

CREATE INDEX IF NOT EXISTS idx_eft_servable
    ON public.entity_field_translation (entity_type, entity_id, locale)
    WHERE state IN ('PUBLISHED', 'STALE');

-- 3. Per-assessment, per-locale coverage rollup so admin UIs can show
-- "42/60 strings published in Arabic" without a fan-out count on every load.
-- Recomputed by the internal batch-upsert endpoint when assessment_id is sent.
CREATE TABLE IF NOT EXISTS public.assessment_translation_coverage (
    id              varchar(255) PRIMARY KEY,
    assessment_id   varchar(255) NOT NULL,
    locale          varchar(10)  NOT NULL,
    published_count integer      NOT NULL DEFAULT 0,
    updated_at      timestamp    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_assessment_translation_coverage UNIQUE (assessment_id, locale)
);

-- 4. Stamp which content locale an attempt was actually served in (analytics,
-- re-grading disputes, "was this learner reading Arabic?"). Nullable, additive;
-- existing rows and 'en' flows keep NULL until the new code path stamps it.
-- !! This is the ALTER the 42501 ops warning above applies to. !!
ALTER TABLE public.student_attempt
    ADD COLUMN IF NOT EXISTS content_locale varchar(10) NULL;

-- 5. Best-effort ICU collations for locale-aware ORDER BY in admin translation
-- listings (Arabic first). Purely an optimization — never a correctness
-- requirement — and some environments (non-ICU builds, restores under other
-- encodings, unprivileged roles) cannot create collations. Every failure is
-- swallowed so this block can NEVER fail the migration.
DO $$
DECLARE
    loc text;
BEGIN
    FOREACH loc IN ARRAY ARRAY['ar', 'hi', 'ta', 'te', 'bn', 'mr', 'gu', 'kn', 'ml', 'pa', 'or', 'as', 'es', 'fr']
    LOOP
        BEGIN
            EXECUTE format('CREATE COLLATION IF NOT EXISTS %I (provider = icu, locale = %L)',
                           'vacademy_' || loc, loc);
        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Skipping ICU collation for %: %', loc, SQLERRM;
        END;
    END LOOP;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping ICU collation block entirely: %', SQLERRM;
END $$;
