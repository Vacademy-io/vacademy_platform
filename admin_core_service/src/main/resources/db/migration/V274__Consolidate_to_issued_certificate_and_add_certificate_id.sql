-- Consolidate the certificate audit table onto a single canonical name
-- (`issued_certificate`) and add the `certificate_id` column.
--
-- History:
--   1. The IssuedCertificate entity originally had no @Table annotation, so
--      Hibernate auto-created an `issued_certificate` table from the class
--      name (snake-cased). This is the table that appears in DataGrip / psql
--      and is what admins are used to seeing.
--   2. V235 later added @Table(name="certificate_log") and an explicit
--      `CREATE TABLE certificate_log`. Result: two tables, with data flowing
--      to `certificate_log` while `issued_certificate` sat empty.
--   3. This migration unifies on `issued_certificate` (matching the entity
--      class name and what's visible in the DB), backfills it with any
--      certificate_log data, drops certificate_log, and adds the new
--      self-documenting `certificate_id` column.
--
-- All steps are idempotent / guarded with IF EXISTS / IF NOT EXISTS so the
-- migration is safe to re-run during local dev resets.

-- 1. Make sure issued_certificate has the full schema. Hibernate's auto-DDL
--    may have created it with a subset of columns depending on which version
--    of the entity was live at the time.
CREATE TABLE IF NOT EXISTS issued_certificate (
    id VARCHAR(36) PRIMARY KEY,
    institute_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    package_session_id VARCHAR(255) NOT NULL,
    course_name VARCHAR(500),
    completion_percentage INTEGER,
    issued_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    file_id VARCHAR(255),
    template_html_snapshot TEXT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Bring any pre-existing issued_certificate up to the current entity shape.
ALTER TABLE issued_certificate ADD COLUMN IF NOT EXISTS file_id VARCHAR(255);
ALTER TABLE issued_certificate ADD COLUMN IF NOT EXISTS template_html_snapshot TEXT;
ALTER TABLE issued_certificate ADD COLUMN IF NOT EXISTS created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE issued_certificate ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP;

-- 2. If a legacy `certificate_log` table exists, fold its rows into
--    `issued_certificate` and drop it. ON CONFLICT DO NOTHING protects
--    against any overlap if both tables ever held the same id.
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.tables
        WHERE table_schema = 'public' AND table_name = 'certificate_log'
    ) THEN
        INSERT INTO issued_certificate (
            id, institute_id, user_id, package_session_id, course_name,
            completion_percentage, issued_at, file_id, template_html_snapshot,
            created_at, updated_at
        )
        SELECT id, institute_id, user_id, package_session_id, course_name,
               completion_percentage, issued_at, file_id, template_html_snapshot,
               created_at, updated_at
        FROM certificate_log
        ON CONFLICT (id) DO NOTHING;

        DROP TABLE certificate_log;
    END IF;
END $$;

-- 3. Add the new `certificate_id` column. Historically the primary key `id`
--    doubled as the human-readable certificate code (e.g. "VA-0123-2026").
--    The new column mirrors that value under a self-documenting name so SQL
--    reports / future schema work can rely on it. Both the Visual editor's
--    {{CERTIFICATE_ID}} chip and the HTML editor's hand-authored
--    {{CERTIFICATE_ID}} token substitute to the value stored here.
ALTER TABLE issued_certificate
    ADD COLUMN IF NOT EXISTS certificate_id VARCHAR(36);

-- Backfill any rows where the column was just added.
UPDATE issued_certificate
SET certificate_id = id
WHERE certificate_id IS NULL;

ALTER TABLE issued_certificate
    ALTER COLUMN certificate_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_issued_certificate_certificate_id
    ON issued_certificate (certificate_id);

-- 4. Standard lookup indexes on the canonical table (mirroring what V235
--    created on certificate_log).
CREATE INDEX IF NOT EXISTS idx_issued_certificate_user_pkg
    ON issued_certificate (user_id, package_session_id);

CREATE INDEX IF NOT EXISTS idx_issued_certificate_institute
    ON issued_certificate (institute_id);
