-- ROLLBACK SCRIPT FOR TEACHER APPROVAL WORKFLOW
-- This script can be used to revert the changes made by V3 and V4 migrations
-- CAUTION: Running this script will remove all approval workflow data
-- UNCOMMENT THE LINES BELOW ONLY IF YOU NEED TO ROLLBACK

-- WARNING: This will delete all data related to the approval workflow
-- Make sure to backup your data before running this script

/*
-- Remove indexes first
DROP INDEX IF EXISTS idx_package_teacher_courses;
DROP INDEX IF EXISTS idx_package_status_in_review;
DROP INDEX IF EXISTS idx_slide_created_by_user_id;
DROP INDEX IF EXISTS idx_slide_parent_id;
DROP INDEX IF EXISTS idx_chapter_created_by_user_id;
DROP INDEX IF EXISTS idx_chapter_parent_id;
DROP INDEX IF EXISTS idx_modules_created_by_user_id;
DROP INDEX IF EXISTS idx_modules_parent_id;
DROP INDEX IF EXISTS idx_subject_created_by_user_id;
DROP INDEX IF EXISTS idx_subject_parent_id;
DROP INDEX IF EXISTS idx_package_status_created_by;
DROP INDEX IF EXISTS idx_package_created_by_user_id;
DROP INDEX IF EXISTS idx_package_original_course_id;

-- Remove foreign key constraints if they were added
-- ALTER TABLE slide DROP CONSTRAINT IF EXISTS fk_slide_parent;
-- ALTER TABLE chapter DROP CONSTRAINT IF EXISTS fk_chapter_parent;
-- ALTER TABLE modules DROP CONSTRAINT IF EXISTS fk_modules_parent;
-- ALTER TABLE subject DROP CONSTRAINT IF EXISTS fk_subject_parent;
-- ALTER TABLE package DROP CONSTRAINT IF EXISTS fk_package_original_course;

-- Remove columns (THIS WILL DELETE DATA!)
ALTER TABLE slide DROP COLUMN IF EXISTS created_by_user_id;
ALTER TABLE slide DROP COLUMN IF EXISTS parent_id;
ALTER TABLE chapter DROP COLUMN IF EXISTS created_by_user_id;
ALTER TABLE chapter DROP COLUMN IF EXISTS parent_id;
ALTER TABLE modules DROP COLUMN IF EXISTS created_by_user_id;
ALTER TABLE modules DROP COLUMN IF EXISTS parent_id;
ALTER TABLE subject DROP COLUMN IF EXISTS created_by_user_id;
ALTER TABLE subject DROP COLUMN IF EXISTS parent_id;
ALTER TABLE package DROP COLUMN IF EXISTS version_number;
ALTER TABLE package DROP COLUMN IF EXISTS created_by_user_id;
ALTER TABLE package DROP COLUMN IF EXISTS original_course_id;

-- Remove IN_REVIEW status from any existing records
UPDATE package SET status = 'DRAFT' WHERE status = 'IN_REVIEW';

-- If using enum type, you would need to recreate the enum without IN_REVIEW
-- This is complex and requires dropping/recreating the enum
-- ALTER TYPE package_status_enum RENAME TO package_status_enum_old;
-- CREATE TYPE package_status_enum AS ENUM ('ACTIVE', 'DRAFT', 'DELETED');
-- ALTER TABLE package ALTER COLUMN status TYPE package_status_enum USING status::text::package_status_enum;
-- DROP TYPE package_status_enum_old;

*/

-- This script is commented out for safety
-- To rollback, manually uncomment the sections you need 