-- Migration to add IN_REVIEW status for teacher approval workflow
-- This handles both enum and varchar implementations of status

-- If using enum type (PostgreSQL), add the new value
-- Uncomment the following line if your database uses ENUM for package.status
-- ALTER TYPE package_status_enum ADD VALUE IF NOT EXISTS 'IN_REVIEW';

-- If using varchar (most common), this is already handled by the application
-- The status column should be VARCHAR to accommodate the new 'IN_REVIEW' value

-- Ensure status column can accommodate the new status value
-- This is a safety check to ensure the column is wide enough
ALTER TABLE package ALTER COLUMN status TYPE VARCHAR(50);

-- Add index for filtering by IN_REVIEW status for admin queries
CREATE INDEX IF NOT EXISTS idx_package_status_in_review ON package(status) WHERE status = 'IN_REVIEW';

-- Add index for teacher's own courses query
CREATE INDEX IF NOT EXISTS idx_package_teacher_courses ON package(created_by_user_id, status);

-- Update any existing NULL status values to 'ACTIVE' (safety measure)
UPDATE package SET status = 'ACTIVE' WHERE status IS NULL;

-- Add NOT NULL constraint to status column if it doesn't exist
ALTER TABLE package ALTER COLUMN status SET NOT NULL;

-- Documentation comment
COMMENT ON COLUMN package.status IS 'Package status: ACTIVE, DRAFT, IN_REVIEW, DELETED'; 