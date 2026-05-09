-- Audit columns on package_session for content-copy lineage tracking.
--
-- Populated by POST /admin-core-service/course/v1/copy-content.
--
-- - content_copied_by:
--     'VALUE'     => deep clone (independent rows for subjects/modules/chapters/slides)
--     'REFERENCE' => shared rows (only mapping rows inserted)
--     NULL        => batch was not seeded by the copy-content flow (existing behaviour)
--
-- - content_copied_from_package_session_id:
--     The source package_session.id this batch's content was seeded from.
--     NULL when content_copied_by is NULL.
--     Intentionally NOT a foreign key — the source batch may be deleted
--     later and we still want the audit trail.

ALTER TABLE package_session
    ADD COLUMN IF NOT EXISTS content_copied_by VARCHAR(20),
    ADD COLUMN IF NOT EXISTS content_copied_from_package_session_id VARCHAR(255);

-- Supports "find all batches that were seeded from this batch" queries.
CREATE INDEX IF NOT EXISTS idx_package_session_content_copied_from
    ON package_session (content_copied_from_package_session_id)
    WHERE content_copied_from_package_session_id IS NOT NULL;
