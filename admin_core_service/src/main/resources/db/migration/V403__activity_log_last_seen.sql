-- Course Pulse (live teacher view) — presence column.
-- Server-stamped "last activity" instant, written by ActivityLog's @PrePersist/@PreUpdate
-- hook from the server clock (never the client). timestamptz so the presence comparison
-- (last_seen_at > now() - interval '2 minutes') is timezone-safe.
--
-- Column add only (transactional). The supporting index is built CONCURRENTLY in V404,
-- which must live in its own migration: Flyway rejects mixing a transactional statement
-- (this ALTER) with a non-transactional one (CREATE INDEX CONCURRENTLY) in one file.
ALTER TABLE activity_log ADD COLUMN IF NOT EXISTS last_seen_at timestamptz;
