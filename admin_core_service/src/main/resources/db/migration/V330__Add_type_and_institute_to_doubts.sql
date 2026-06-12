-- Typed doubts → "Help & Queries": add a configurable query type + a direct institute reference
-- so general (non-slide) queries can be raised without a batch and triaged in an institute-scoped
-- admin inbox.

-- 1) type: configurable query category key (DOUBT, TECHNICAL, PAYMENT, ...). Legacy rows = DOUBT.
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS type VARCHAR(64) DEFAULT 'DOUBT';
UPDATE doubts SET type = 'DOUBT' WHERE type IS NULL;

-- 2) institute_id: owning institute. For existing SLIDE doubts, backfill by walking
--    package_session → package_institute — the same path the runtime resolver uses
--    (FacultySubjectPackageSessionMappingRepository.findInstituteIdByPackageSessionId).
--    GENERAL queries set it directly at create time.
ALTER TABLE doubts ADD COLUMN IF NOT EXISTS institute_id VARCHAR(255);

UPDATE doubts d
SET institute_id = pi.institute_id
FROM package_session ps
JOIN package_institute pi ON pi.package_id = ps.package_id
WHERE d.institute_id IS NULL
  AND d.package_session_id IS NOT NULL
  AND ps.id = d.package_session_id;

-- 3) Index backing the institute-scoped admin inbox (filter by institute + type + status,
--    excluding soft-deleted rows). Top-level doubts only are listed, but parent_id is left out of
--    the index to keep it usable by the reply lookups too.
CREATE INDEX IF NOT EXISTS idx_doubts_institute_type_status
    ON doubts (institute_id, type, status)
    WHERE status <> 'DELETED';
