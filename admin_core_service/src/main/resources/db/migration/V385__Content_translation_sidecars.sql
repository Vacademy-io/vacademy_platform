-- V383: Content translation sidecar tables (i18n Phase 1 Wave 1 — Arabic-first).
--
-- Translations are SIDECAR rows keyed to canonical content ids — never copies of
-- the content tree, never in-place JSONB rewrites. Learner delivery LEFT JOINs
-- these tables on (canonical id, locale) and COALESCEs back to the canonical
-- (source-locale) text, so requesting 'en' — or any locale with no translation
-- rows — yields output identical to before this migration.
--
-- States: DRAFT -> IN_REVIEW -> PUBLISHED; PUBLISHED -> STALE when the source
-- text's sha256 (source_hash) no longer matches the canonical content. PUBLISHED
-- and STALE are both learner-visible (a slightly stale translation beats a blank);
-- DRAFT / IN_REVIEW are not.
--
-- PROD TABLE-OWNERSHIP NOTE (per the prod Flyway 42501 incidents): prod tables
-- restored/created under the postgres superuser break later ALTER migrations run
-- by the app role. Convention: run the per-object "ALTER TABLE ... OWNER TO
-- <app_role>" loop before shipping ALTERs against pre-existing tables. This
-- migration only CREATEs new tables (owned by whichever role runs Flyway), so it
-- is low-risk — but keep the convention in mind for any future ALTER on them.

-- 1) Rich text translations: sidecar per (rich_text_data.id, locale).
CREATE TABLE IF NOT EXISTS rich_text_translation (
    id VARCHAR(255) PRIMARY KEY,
    rich_text_id VARCHAR(255) NOT NULL,
    locale VARCHAR(10) NOT NULL,
    type VARCHAR(255),
    content TEXT NOT NULL,
    state VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    source_locale VARCHAR(10) NOT NULL DEFAULT 'en',
    source_hash VARCHAR(64),
    translated_by VARCHAR(255),
    reviewed_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    CONSTRAINT uq_rich_text_translation_rich_text_locale UNIQUE (rich_text_id, locale)
);

-- 2) Entity field translations: sidecar per (entity_type, entity_id, field, locale)
--    for plain columns like slide.title / slide.description.
CREATE TABLE IF NOT EXISTS entity_field_translation (
    id VARCHAR(255) PRIMARY KEY,
    entity_type VARCHAR(64) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    field VARCHAR(64) NOT NULL,
    locale VARCHAR(10) NOT NULL,
    content TEXT,
    json_value JSONB,
    state VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    source_locale VARCHAR(10) NOT NULL DEFAULT 'en',
    source_hash VARCHAR(64),
    translated_by VARCHAR(255),
    reviewed_by VARCHAR(255),
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    CONSTRAINT uq_entity_field_translation_key UNIQUE (entity_type, entity_id, field, locale)
);

-- 3) Media language variants: alternate file/URL per (owner, locale, kind) —
--    kind = PRIMARY (replacement asset), CAPTION_VTT, AUDIO_TRACK.
CREATE TABLE IF NOT EXISTS media_language_variant (
    id VARCHAR(255) PRIMARY KEY,
    owner_type VARCHAR(64) NOT NULL,
    owner_id VARCHAR(255) NOT NULL,
    locale VARCHAR(10) NOT NULL,
    file_id_or_url TEXT,
    kind VARCHAR(30) NOT NULL DEFAULT 'PRIMARY',
    state VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    created_at TIMESTAMP DEFAULT now(),
    updated_at TIMESTAMP DEFAULT now(),
    CONSTRAINT uq_media_language_variant_key UNIQUE (owner_type, owner_id, locale, kind)
);

-- 4) Per-batch coverage counters: which locales have learner-visible translations
--    for a package session (drives the learner app's available_languages list).
CREATE TABLE IF NOT EXISTS content_translation_coverage (
    id VARCHAR(255) PRIMARY KEY,
    package_session_id VARCHAR(255) NOT NULL,
    locale VARCHAR(10) NOT NULL,
    published_count INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP DEFAULT now(),
    CONSTRAINT uq_content_translation_coverage_key UNIQUE (package_session_id, locale)
);

-- Partial indexes matching the learner delivery joins, which always filter
-- state IN ('PUBLISHED','STALE') — keeps the hot lookups tight while DRAFT /
-- IN_REVIEW rows accumulate.
CREATE INDEX IF NOT EXISTS idx_rich_text_translation_visible
    ON rich_text_translation (rich_text_id, locale)
    WHERE state IN ('PUBLISHED', 'STALE');

CREATE INDEX IF NOT EXISTS idx_entity_field_translation_visible
    ON entity_field_translation (entity_type, entity_id, field, locale)
    WHERE state IN ('PUBLISHED', 'STALE');

-- Locale-neutral ICU collation for future mixed-script ordering (Arabic/Indic).
-- Failure-tolerant: servers built without ICU (--with-icu missing) must not fail
-- the migration — nothing in this wave depends on the collation existing.
DO $$
BEGIN
    CREATE COLLATION IF NOT EXISTS und_icu (provider = icu, locale = 'und');
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Skipping ICU collation und_icu (ICU unavailable on this server): %', SQLERRM;
END
$$;
