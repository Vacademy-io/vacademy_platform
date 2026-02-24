-- Add is_parent and parent_id to package_session for parent/child batch support.
-- Backward compatible: both columns nullable; existing rows get NULL (is_parent treated as false in app).

ALTER TABLE package_session ADD COLUMN IF NOT EXISTS is_parent BOOLEAN DEFAULT false;
ALTER TABLE package_session ADD COLUMN IF NOT EXISTS parent_id VARCHAR(255);

-- Optional FK: parent_id references package_session(id). Omit if you prefer no FK constraint.
-- ALTER TABLE package_session ADD CONSTRAINT fk_package_session_parent
--   FOREIGN KEY (parent_id) REFERENCES package_session(id);

-- -- Index for lookups by parent (e.g. "children of batch X").
-- CREATE INDEX IF NOT EXISTS idx_package_session_parent_id ON package_session(parent_id) WHERE parent_id IS NOT NULL;

