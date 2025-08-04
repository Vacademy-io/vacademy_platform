-- ================================================================================================
-- CRITICAL INDEXES TEST SCRIPT - Vacademy Admin Core Service
-- ================================================================================================
-- This script tests the most critical indexes to verify schema correctness
-- Run this first to validate the table structure before running the full script
-- ================================================================================================

-- Test Package table indexes (most critical ones)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_status_published_test 
ON package (status, is_course_published_to_catalaouge) WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_tags_gin_test 
ON package USING gin(string_to_array(comma_separated_tags, ',')) WHERE comma_separated_tags IS NOT NULL;

-- Test Package Institute bridge table (critical for package-institute relationships)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_institute_mapping_test 
ON package_institute (package_id, institute_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_institute_institute_id_test 
ON package_institute (institute_id);

-- Test Package Session indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_session_package_id_status_test 
ON package_session (package_id, status) WHERE status != 'DELETED';

-- Test Student core indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_user_id_test 
ON student (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_email_test 
ON student (email);

-- Test Critical Student Session Institute Group Mapping
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ssigm_user_id_status_test 
ON student_session_institute_group_mapping (user_id, status) WHERE status = 'ACTIVE';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ssigm_package_session_id_status_test 
ON student_session_institute_group_mapping (package_session_id, status) WHERE status = 'ACTIVE';

-- Test Activity Log (critical for analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_log_user_id_created_at_test 
ON activity_log (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_log_slide_id_user_id_test 
ON activity_log (slide_id, user_id);

-- Test Level indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_level_status_test 
ON level (status) WHERE status != 'DELETED';

-- Test Live Session indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_session_institute_id_status_test 
ON live_session (institute_id, status);

-- If this script runs successfully, you can proceed with the full indexing script
SELECT 'Critical indexes test completed successfully!' as status; 