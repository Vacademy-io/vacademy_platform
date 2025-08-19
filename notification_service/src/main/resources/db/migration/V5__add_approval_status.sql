-- Add approval-related statuses support; enum is in app code, column already stores text
-- No new column needed if announcements.status already exists as VARCHAR
-- Ensure existing rows with invalid statuses are mapped to DRAFT

-- This migration is intentionally minimal because status is a STRING in JPA.
-- We only normalize any legacy values if present.

UPDATE announcements SET status = 'DRAFT' WHERE status IS NULL OR status = '';

-- Optional indexes to query approval queues quickly
CREATE INDEX IF NOT EXISTS idx_announcements_institute_status ON announcements(institute_id, status);

