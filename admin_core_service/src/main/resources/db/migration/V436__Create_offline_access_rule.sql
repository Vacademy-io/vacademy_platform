-- Offline Content Download & Sync -- Part A1: explicit per-node offline permission rules.
--
-- One table for every ancestor level (PACKAGE, PACKAGE_SESSION, SUBJECT, MODULE,
-- CHAPTER, SLIDE) instead of a JSON column per entity: the resolver needs "all
-- explicit rules on an ancestor chain" and the manifest builder needs "all rules
-- for a batch" -- both are single indexed queries against one table; JSON-per-node
-- would scatter reads and bump-hooks across five entities.
--
-- Absence of a row = inherit from the next rule up the chain (or the course
-- default). The admin UI's "Inherit" action is therefore a DELETE, not a write of
-- some neutral value.
--
-- package_session_id scoping:
--   * PACKAGE rules apply course-wide, so package_session_id is always NULL.
--   * PACKAGE_SESSION rules are a batch-level override: source_id IS the package
--     session id, and package_session_id mirrors it (kept for a uniform WHERE
--     package_session_id = :ps clause across every other level).
--   * SUBJECT/MODULE/CHAPTER/SLIDE rules are scoped to the package_session_id they
--     were set from, so the same catalog chapter/slide can be allowed in one batch
--     and blocked in another.
CREATE TABLE IF NOT EXISTS offline_access_rule (
    id                  VARCHAR(255) PRIMARY KEY,
    institute_id        VARCHAR(255) NOT NULL,
    source_type         VARCHAR(32)  NOT NULL,   -- PACKAGE | PACKAGE_SESSION | SUBJECT | MODULE | CHAPTER | SLIDE
    source_id           VARCHAR(255) NOT NULL,
    package_session_id  VARCHAR(255),            -- NULL only for PACKAGE-level rules
    allow               BOOLEAN      NOT NULL,
    created_by_user_id  VARCHAR(255),
    created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- The uniqueness constraint IS the upsert key the bulk-rule endpoint keys off of,
-- and it is what makes "package_session_id NULL for PACKAGE rules" safe: Postgres
-- treats NULLs as distinct for uniqueness, so multiple institutes/packages don't
-- collide, and a single (source_type='PACKAGE', source_id) pair can only ever have
-- one row.
DO $$
BEGIN
    ALTER TABLE offline_access_rule
        ADD CONSTRAINT uq_offline_access_rule_node
        UNIQUE (source_type, source_id, package_session_id);
EXCEPTION
    WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL;
END $$;

-- Admin "list rules for this batch" query: WHERE package_session_id = :ps OR
-- (source_type='PACKAGE' AND source_id = :packageId).
CREATE INDEX IF NOT EXISTS idx_offline_access_rule_package_session
    ON offline_access_rule (package_session_id);

CREATE INDEX IF NOT EXISTS idx_offline_access_rule_package_source
    ON offline_access_rule (source_type, source_id)
    WHERE package_session_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_offline_access_rule_institute
    ON offline_access_rule (institute_id);
