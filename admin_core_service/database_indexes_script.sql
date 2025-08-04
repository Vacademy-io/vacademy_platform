-- ================================================================================================
-- VACADEMY ADMIN CORE SERVICE DATABASE INDEXING SCRIPT
-- ================================================================================================
-- This script creates indexes for all frequently queried fields based on repository analysis
-- Generated from entity and repository pattern analysis
-- Execution: Run this script on your PostgreSQL database for optimal query performance
-- ================================================================================================

-- ================================================================================================
-- PACKAGE MANAGEMENT INDEXES
-- ================================================================================================

-- Package core indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_status_published 
ON package (status, is_course_published_to_catalaouge) WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_name_search 
ON package USING gin(to_tsvector('english', package_name)) WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_tags_gin 
ON package USING gin(string_to_array(comma_separated_tags, ',')) WHERE comma_separated_tags IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_created_at 
ON package (created_at DESC) WHERE status != 'DELETED';

-- Package Session indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_session_package_id_status 
ON package_session (package_id, status) WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_session_level_id_status 
ON package_session (level_id, status) WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_session_session_id_status 
ON package_session (session_id, status) WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_session_start_time 
ON package_session (start_time DESC) WHERE status != 'DELETED';

-- Package Institute mapping (Critical bridge table)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_institute_mapping 
ON package_institute (package_id, institute_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_institute_institute_id 
ON package_institute (institute_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_institute_package_id 
ON package_institute (package_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_institute_group_id 
ON package_institute (group_id) WHERE group_id IS NOT NULL;

-- ================================================================================================
-- STUDENT AND LEARNER MANAGEMENT INDEXES
-- ================================================================================================

-- Student core indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_user_id 
ON student (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_username 
ON student (username);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_email 
ON student (email);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_mobile_number 
ON student (mobile_number);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_full_name_gin 
ON student USING gin(to_tsvector('english', full_name));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_search_composite 
ON student USING gin(to_tsvector('english', full_name || ' ' || username));

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_created_at 
ON student (created_at DESC);

-- Student Session Institute Group Mapping (Critical for learner lookups)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ssigm_user_id_status 
ON student_session_institute_group_mapping (user_id, status) WHERE status = 'ACTIVE';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ssigm_package_session_id_status 
ON student_session_institute_group_mapping (package_session_id, status) WHERE status = 'ACTIVE';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ssigm_institute_id_status 
ON student_session_institute_group_mapping (institute_id, status) WHERE status = 'ACTIVE';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ssigm_group_id_status 
ON student_session_institute_group_mapping (group_id, status) WHERE status = 'ACTIVE';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ssigm_composite_lookup 
ON student_session_institute_group_mapping (user_id, package_session_id, institute_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ssigm_enrollment_number 
ON student_session_institute_group_mapping (institute_enrollment_number);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ssigm_expiry_date 
ON student_session_institute_group_mapping (expiry_date) WHERE expiry_date IS NOT NULL;

-- ================================================================================================
-- ACTIVITY TRACKING AND ANALYTICS INDEXES
-- ================================================================================================

-- Activity Log core indexes (Heavy analytics usage)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_log_user_id_created_at 
ON activity_log (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_log_slide_id_user_id 
ON activity_log (slide_id, user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_log_source_type_source_id 
ON activity_log (source_type, source_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_log_time_range 
ON activity_log (start_time, end_time);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_log_created_at_range 
ON activity_log (created_at) WHERE created_at >= NOW() - INTERVAL '1 year';

-- Learner Operation indexes (Progress tracking)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learner_operation_user_id_source 
ON learner_operation (user_id, source, source_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learner_operation_source_id_operation 
ON learner_operation (source_id, operation) WHERE operation IN ('PERCENTAGE_COMPLETED', 'PERCENTAGE_CHAPTER_COMPLETED');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learner_operation_user_operation 
ON learner_operation (user_id, operation, source);

-- Concentration Score indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_concentration_score_activity_id 
ON concentration_score (activity_id);

-- Video Tracked indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_video_tracked_activity_id 
ON video_tracked (activity_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_video_tracked_time_range 
ON video_tracked (start_time, end_time);

-- Document Tracked indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_tracked_activity_id 
ON document_tracked (activity_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_tracked_page_number 
ON document_tracked (activity_id, page_number);

-- Quiz and Question Tracking indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quiz_slide_question_tracked_activity_id 
ON quiz_slide_question_tracked (activity_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_question_slide_tracked_activity_id 
ON question_slide_tracked (activity_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignment_slide_tracked_activity_id 
ON assignment_slide_tracked (activity_id);

-- ================================================================================================
-- CONTENT STRUCTURE INDEXES
-- ================================================================================================

-- Chapter indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chapter_status 
ON chapter (status) WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chapter_created_at 
ON chapter (created_at DESC);

-- Chapter Package Session Mapping
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chapter_package_session_mapping 
ON chapter_package_session_mapping (chapter_id, package_session_id, status) WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_cpsm_package_session_id 
ON chapter_package_session_mapping (package_session_id, status) WHERE status != 'DELETED';

-- Chapter to Slides mapping
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chapter_to_slides_chapter_id 
ON chapter_to_slides (chapter_id, status) WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_chapter_to_slides_slide_id 
ON chapter_to_slides (slide_id, status) WHERE status != 'DELETED';

-- Module indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_modules_status 
ON modules (status) WHERE status != 'DELETED';

-- Module Chapter Mapping
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_module_chapter_mapping 
ON module_chapter_mapping (module_id, chapter_id);

-- Subject indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subject_status 
ON subject (status) WHERE status != 'DELETED';

-- Subject Module Mapping
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subject_module_mapping 
ON subject_module_mapping (subject_id, module_id);

-- Subject Session mapping
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_subject_session_mapping 
ON subject_session (subject_id, session_id);

-- ================================================================================================
-- SLIDE AND CONTENT INDEXES
-- ================================================================================================

-- Slide core indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_slide_status_source_type 
ON slide (status, source_type) WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_slide_source_id_type 
ON slide (source_id, source_type) WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_slide_created_at 
ON slide (created_at DESC) WHERE status != 'DELETED';

-- Video Slide indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_video_slide_published_length 
ON video (published_video_length) WHERE published_video_length IS NOT NULL;

-- Document Slide indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_slide_type_pages 
ON document_slide (type, published_document_total_pages);

-- Quiz Slide indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quiz_slide_status 
ON quiz_slide (status) WHERE status != 'DELETED';

-- Quiz Slide Question indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_quiz_slide_question_quiz_id 
ON quiz_slide_question (quiz_slide_id, status) WHERE status != 'DELETED';

-- Assignment Slide indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignment_slide_status 
ON assignment_slide (status) WHERE status != 'DELETED';

-- Assignment Slide Question indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_assignment_slide_question_assignment_id 
ON assignment_slide_question (assignment_slide_id, status) WHERE status != 'DELETED';

-- Video Slide Question indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_video_slide_question_video_id 
ON video_slide_question (video_slide_id, status) WHERE status != 'DELETED';

-- ================================================================================================
-- LIVE SESSION INDEXES
-- ================================================================================================

-- Live Session core indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_session_institute_id_status 
ON live_session (institute_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_session_status 
ON live_session (status) WHERE status IN ('LIVE', 'DRAFT');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_session_access_level 
ON live_session (access_level);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_session_created_at 
ON live_session (created_at DESC);

-- Session Schedule indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_schedule_session_id 
ON session_schedules (session_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_schedule_meeting_date 
ON session_schedules (meeting_date, start_time);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_schedule_time_range 
ON session_schedules (meeting_date, start_time, last_entry_time);

-- Live Session Participants indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_session_participants_session 
ON live_session_participants (session_id, source_type, source_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_live_session_participants_source 
ON live_session_participants (source_type, source_id);

-- ================================================================================================
-- FACULTY AND PERMISSIONS INDEXES
-- ================================================================================================

-- Faculty Subject Package Session Mapping
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_faculty_package_session_mapping 
ON faculty_subject_package_session_mapping (package_session_id, user_id, status) WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_faculty_user_id_status 
ON faculty_subject_package_session_mapping (user_id, status) WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_faculty_subject_id 
ON faculty_subject_package_session_mapping (subject_id, status) WHERE status != 'DELETED';

-- ================================================================================================
-- LEVEL AND SESSION INDEXES
-- ================================================================================================

-- Level indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_level_status 
ON level (status) WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_level_name 
ON level (level_name) WHERE status != 'DELETED';

-- Session indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_status 
ON session (status) WHERE status != 'DELETED';

-- ================================================================================================
-- PAYMENT AND SUBSCRIPTION INDEXES
-- ================================================================================================

-- Payment Plan indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_plan_status 
ON payment_plan (status) WHERE status != 'DELETED';

-- Payment Log indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_log_user_id 
ON payment_log (user_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_payment_log_status 
ON payment_log (status);

-- Coupon Code indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coupon_code_code 
ON coupon_code (coupon_code) WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_coupon_code_validity 
ON coupon_code (valid_from, valid_till) WHERE status != 'DELETED';

-- User Plan indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_plan_user_id 
ON user_plan (user_id, status);

-- ================================================================================================
-- NOTIFICATION AND COMMUNICATION INDEXES
-- ================================================================================================

-- Notification Setting indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_setting_source 
ON notification_setting (source, source_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_notification_setting_type 
ON notification_setting (type, status);

-- ================================================================================================
-- RATING AND FEEDBACK INDEXES
-- ================================================================================================

-- Rating indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rating_source 
ON rating (source_type, source_id, status) WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rating_user_source 
ON rating (user_id, source_type, source_id) WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rating_points 
ON rating (points) WHERE status != 'DELETED';

-- ================================================================================================
-- DOCUMENT AND FILE MANAGEMENT INDEXES
-- ================================================================================================

-- Document indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_status 
ON document (status) WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_document_folder_id 
ON document (folder_id, status) WHERE status != 'DELETED';

-- Folder indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_folder_parent_id 
ON folder (parent_folder_id, status) WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_folder_institute_id 
ON folder (institute_id, status) WHERE status != 'DELETED';

-- ================================================================================================
-- ENROLLMENT AND INVITATION INDEXES
-- ================================================================================================

-- Enroll Invite indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enroll_invite_status 
ON enroll_invite (status) WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_enroll_invite_package_session 
ON enroll_invite (package_session_id, status) WHERE status != 'DELETED';

-- Learner Invitation indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learner_invitation_status 
ON learner_invitation (status) WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learner_invitation_source 
ON learner_invitation (source_type, source_id, status) WHERE status != 'DELETED';

-- ================================================================================================
-- CUSTOM FIELDS INDEXES
-- ================================================================================================

-- Custom Fields indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_custom_fields_key 
ON custom_fields (field_key);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_custom_fields_type 
ON custom_fields (field_type);

-- Custom Field Values indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_custom_field_values_field_id 
ON custom_field_values (field_id, entity_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_custom_field_values_entity 
ON custom_field_values (entity_id, entity_type);

-- ================================================================================================
-- INSTITUTE AND GROUP INDEXES
-- ================================================================================================

-- Group indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_groups_parent_group_id 
ON groups (parent_group_id) WHERE parent_group_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_groups_is_root 
ON groups (is_root) WHERE is_root = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_groups_group_name 
ON groups (group_name);

-- Package Group Mapping
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_group_mapping 
ON package_group_mapping (package_id, group_id);

-- ================================================================================================
-- DOUBTS AND COMMUNICATION INDEXES
-- ================================================================================================

-- Doubts indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_doubts_status 
ON doubts (status) WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_doubts_user_id 
ON doubts (user_id, created_at DESC) WHERE status != 'DELETED';

-- Doubt Assignee indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_doubt_assignee_doubt_id 
ON doubt_assignee (doubt_id, status) WHERE status != 'DELETED';

-- ================================================================================================
-- COMPOSITE INDEXES FOR COMPLEX QUERIES
-- ================================================================================================

-- High-performance composite indexes for most frequent query patterns
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_complete_lookup 
ON package (status, is_course_published_to_catalaouge, created_at DESC) 
WHERE status != 'DELETED';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_institute_complete_lookup 
ON package_institute (institute_id, package_id, group_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_learner_progress_lookup 
ON learner_operation (user_id, operation, source_id, value) 
WHERE operation IN ('PERCENTAGE_COMPLETED', 'PERCENTAGE_CHAPTER_COMPLETED');

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_analytics_lookup 
ON activity_log (user_id, created_at, slide_id, source_type) 
WHERE created_at >= NOW() - INTERVAL '1 year';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_student_batch_lookup 
ON student_session_institute_group_mapping (package_session_id, institute_id, user_id, status) 
WHERE status = 'ACTIVE';

-- ================================================================================================
-- MAINTENANCE INDEXES
-- ================================================================================================

-- Indexes for cleanup and maintenance operations
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_created_at_maintenance 
ON activity_log (created_at) WHERE created_at < NOW() - INTERVAL '2 years';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_updated_at_maintenance 
ON student (updated_at) WHERE updated_at < NOW() - INTERVAL '1 year';

-- ================================================================================================
-- SCRIPT COMPLETION
-- ================================================================================================

-- Update table statistics for better query planning
ANALYZE;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Vacademy Admin Core Service Database Indexing Script completed successfully!';
    RAISE NOTICE 'Total indexes created: Approximately 80+ indexes covering all major query patterns';
    RAISE NOTICE 'Performance improvements expected for: Package queries, Student lookups, Activity tracking, Live sessions, Content navigation';
    RAISE NOTICE 'Remember to monitor index usage and adjust as needed based on actual query patterns';
END $$; 