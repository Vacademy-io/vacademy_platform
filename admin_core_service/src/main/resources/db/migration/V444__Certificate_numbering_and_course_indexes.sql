-- Certificate numbering + course-dashboard support.
--
-- Two problems this fixes.
--
-- 1. Certificate numbers were random, not sequential. `generateUniqueCertificateId`
--    picked a random 4-digit number, probed `existsById` up to 50 times, then fell
--    back to a 6-digit number WITHOUT any uniqueness check. Check-then-insert is not
--    atomic, so two concurrent issuances could pick the same id; the losing INSERT
--    threw and was swallowed, leaving the learner with a PDF and no audit row.
--    `certificate_number_sequence` replaces that with a single atomic
--    INSERT .. ON CONFLICT DO UPDATE .. RETURNING allocation.
--
--    Scope is (institute_id, year): each institute gets its own counter, and it
--    resets on 1 January. A row's absence means "no certificate issued yet this
--    year for this institute" — the allocator inserts it with next_seq = 1.
--    Existing certificates keep their old random ids; nothing is renumbered.
--
-- 2. The course Certificates tab lists every learner in one batch with their
--    certificate state. The only index on issued_certificate that mentions
--    package_session_id is idx_issued_certificate_user_pkg (user_id,
--    package_session_id) — user_id leads, so a package-session-only lookup can't
--    use it. Hence the new single-column index.

CREATE TABLE IF NOT EXISTS certificate_number_sequence (
    institute_id VARCHAR(255) NOT NULL,
    year         INTEGER      NOT NULL,
    next_seq     BIGINT       NOT NULL DEFAULT 1,
    created_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- The PK is what makes ON CONFLICT (institute_id, year) DO UPDATE atomic.
DO $$
BEGIN
    ALTER TABLE certificate_number_sequence
        ADD CONSTRAINT certificate_number_sequence_pkey PRIMARY KEY (institute_id, year);
EXCEPTION
    WHEN duplicate_table THEN NULL;
    WHEN duplicate_object THEN NULL;
    WHEN invalid_table_definition THEN NULL;  -- PK already present
END $$;

-- Serves: course certificate dashboard counts + the paginated learner table,
-- both of which filter on package_session_id alone.
CREATE INDEX IF NOT EXISTS idx_issued_certificate_pkg_session
    ON issued_certificate (package_session_id);
