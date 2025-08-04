-- ================================================================================================
-- VACADEMY AUTH SERVICE DATABASE INDEXING SCRIPT
-- ================================================================================================
-- This script creates indexes for all frequently queried fields based on repository analysis
-- Generated from entity and repository pattern analysis
-- Execution: Run this script on your PostgreSQL database for optimal query performance
-- ================================================================================================

-- ================================================================================================
-- USER MANAGEMENT CORE INDEXES
-- ================================================================================================

-- Users table core indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_username 
ON users (username);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email 
ON users (email);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_email_created_at 
ON users (email, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_mobile_number 
ON users (mobile_number) WHERE mobile_number IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_full_name_gin 
ON users USING gin(to_tsvector('english', full_name)) WHERE full_name IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_is_root_user 
ON users (is_root_user) WHERE is_root_user = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_created_at 
ON users (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_last_token_update 
ON users (last_token_update_time) WHERE last_token_update_time IS NOT NULL;

-- ================================================================================================
-- USER ROLES AND PERMISSIONS INDEXES
-- ================================================================================================

-- User Role table indexes (Critical for authentication)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_role_user_id 
ON user_role (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_role_role_id 
ON user_role (role_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_role_institute_id 
ON user_role (institute_id) WHERE institute_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_role_status 
ON user_role (status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_role_user_status 
ON user_role (user_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_role_user_institute 
ON user_role (user_id, institute_id, status);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_role_composite_lookup 
ON user_role (user_id, role_id, institute_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_role_created_at 
ON user_role (created_at DESC);

-- Roles table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_roles_name 
ON roles (role_name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_roles_created_at 
ON roles (created_at DESC);

-- Permissions table indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_permissions_name 
ON permissions (permission_name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_permissions_tag 
ON permissions (tag) WHERE tag IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_permissions_created_at 
ON permissions (created_at DESC);

-- User Permission table indexes (Direct user permissions)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_permission_user_id 
ON user_permission (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_permission_permission_id 
ON user_permission (permission_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_permission_institute_id 
ON user_permission (institute_id) WHERE institute_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_permission_user_institute 
ON user_permission (user_id, institute_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_permission_created_at 
ON user_permission (created_at DESC);

-- Role Permission mapping indexes (Junction table)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_role_permission_role_id 
ON role_permission (role_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_role_permission_permission_id 
ON role_permission (permission_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_role_permission_composite 
ON role_permission (role_id, permission_id);

-- ================================================================================================
-- SESSION AND TOKEN MANAGEMENT INDEXES
-- ================================================================================================

-- Refresh Token indexes (JWT management)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_token_token 
ON refresh_token (token);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_token_user_id 
ON refresh_token (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_token_client_name 
ON refresh_token (client_name) WHERE client_name IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_token_expiry 
ON refresh_token (expiry_date) WHERE expiry_date IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_token_user_client 
ON refresh_token (user_id, client_name);

-- User Session indexes (Active session tracking)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_session_user_id 
ON user_session (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_session_institute_id 
ON user_session (institute_id) WHERE institute_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_session_token 
ON user_session (session_token);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_session_is_active 
ON user_session (is_active);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_session_active_token 
ON user_session (session_token, is_active) WHERE is_active = true;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_session_user_institute 
ON user_session (user_id, institute_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_session_login_time 
ON user_session (login_time DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_session_last_activity 
ON user_session (last_activity_time DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_session_logout_time 
ON user_session (logout_time) WHERE logout_time IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_session_device_type 
ON user_session (device_type) WHERE device_type IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_session_device_id 
ON user_session (device_id) WHERE device_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_session_user_active_login 
ON user_session (user_id, institute_id, is_active, login_time DESC);

-- ================================================================================================
-- ACTIVITY TRACKING AND ANALYTICS INDEXES
-- ================================================================================================

-- User Activity Log indexes (Critical for analytics)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_log_user_id 
ON user_activity_log (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_log_institute_id 
ON user_activity_log (institute_id) WHERE institute_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_log_created_at 
ON user_activity_log (created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_log_service_name 
ON user_activity_log (service_name) WHERE service_name IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_log_session_id 
ON user_activity_log (session_id) WHERE session_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_log_response_status 
ON user_activity_log (response_status) WHERE response_status IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_log_device_type 
ON user_activity_log (device_type) WHERE device_type IS NOT NULL;

-- Composite indexes for common analytics queries
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_log_user_institute_date 
ON user_activity_log (user_id, institute_id, created_at DESC);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_log_institute_date 
ON user_activity_log (institute_id, created_at DESC) WHERE institute_id IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_log_service_institute_date 
ON user_activity_log (service_name, institute_id, created_at DESC) WHERE service_name IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_log_user_service_date 
ON user_activity_log (user_id, service_name, created_at DESC) WHERE service_name IS NOT NULL;

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_log_response_time 
ON user_activity_log (response_time_ms) WHERE response_time_ms IS NOT NULL;

-- Performance analytics index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_log_performance_analysis 
ON user_activity_log (service_name, institute_id, response_time_ms, created_at) 
WHERE response_time_ms IS NOT NULL AND institute_id IS NOT NULL;

-- Daily activity analytics index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_user_activity_log_daily_analytics 
ON user_activity_log (institute_id, created_at, user_id) 
WHERE institute_id IS NOT NULL AND created_at >= NOW() - INTERVAL '1 year';

-- Daily User Activity Summary indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_activity_user_institute_date 
ON daily_user_activity_summary (user_id, institute_id, activity_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_activity_institute_date 
ON daily_user_activity_summary (institute_id, activity_date);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_activity_date_range 
ON daily_user_activity_summary (activity_date) WHERE activity_date >= CURRENT_DATE - INTERVAL '1 year';

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_activity_user_date_range 
ON daily_user_activity_summary (user_id, activity_date) WHERE activity_date >= CURRENT_DATE - INTERVAL '6 months';

-- ================================================================================================
-- CLIENT AND OAUTH AUTHENTICATION INDEXES
-- ================================================================================================

-- Client Credentials indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_credentials_client_name 
ON client_credentials (client_name);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_credentials_token 
ON client_credentials (token);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_client_credentials_created_at 
ON client_credentials (created_at DESC);

-- OAuth2 Vendor mapping indexes
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_oauth2_vendor_provider_subject 
ON oauth2_vendor_to_user_detail (provider_id, subject);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_oauth2_vendor_user_id 
ON oauth2_vendor_to_user_detail (user_id);

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_oauth2_vendor_provider_id 
ON oauth2_vendor_to_user_detail (provider_id);

-- ================================================================================================
-- COMPOSITE INDEXES FOR COMPLEX AUTHENTICATION FLOWS
-- ================================================================================================

-- Complete user authentication lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_users_auth_lookup 
ON users (username, email, is_root_user) WHERE is_root_user = true;

-- Role-based access control lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_rbac_complete_lookup 
ON user_role (user_id, role_id, institute_id, status) WHERE status = 'ACTIVE';

-- Session validation lookup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_validation_lookup 
ON user_session (session_token, is_active, last_activity_time) WHERE is_active = true;

-- Permission resolution lookup (covers both direct and role-based permissions)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_permission_resolution_user_institute 
ON user_permission (user_id, institute_id, permission_id);

-- Activity analytics composite index
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_complete_analytics 
ON user_activity_log (institute_id, service_name, created_at, user_id, response_time_ms) 
WHERE created_at >= NOW() - INTERVAL '1 year';

-- ================================================================================================
-- SECURITY AND AUDIT INDEXES
-- ================================================================================================

-- Failed login tracking (response_status based)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_failed_login_tracking 
ON user_activity_log (user_id, created_at, response_status) 
WHERE response_status >= 400;

-- IP-based activity tracking
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ip_activity_tracking 
ON user_activity_log (ip_address, created_at) WHERE ip_address IS NOT NULL;

-- Session duration analysis
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_duration_analysis 
ON user_session (user_id, session_duration_minutes, login_time) 
WHERE session_duration_minutes IS NOT NULL;

-- Token expiry management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_token_expiry_cleanup 
ON refresh_token (expiry_date) WHERE expiry_date < NOW();

-- ================================================================================================
-- MAINTENANCE AND CLEANUP INDEXES
-- ================================================================================================

-- Activity log cleanup (older than 2 years)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_activity_log_cleanup 
ON user_activity_log (created_at) WHERE created_at < NOW() - INTERVAL '2 years';

-- Inactive session cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_inactive_session_cleanup 
ON user_session (is_active, last_activity_time) 
WHERE is_active = false OR last_activity_time < NOW() - INTERVAL '30 days';

-- Old refresh token cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_refresh_token_cleanup 
ON refresh_token (expiry_date) WHERE expiry_date < NOW();

-- User activity summary cleanup
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_daily_activity_cleanup 
ON daily_user_activity_summary (activity_date) 
WHERE activity_date < CURRENT_DATE - INTERVAL '2 years';

-- ================================================================================================
-- HIGH-PERFORMANCE COMPOSITE INDEXES
-- ================================================================================================

-- Ultra-fast user authentication (covers most login scenarios)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_ultra_fast_auth 
ON users (username, email, password_hash, is_root_user);

-- Complete role resolution (single index lookup)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_complete_role_resolution 
ON user_role (user_id, institute_id, role_id, status, created_at) 
WHERE status IN ('ACTIVE', 'PENDING');

-- Real-time session management
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_realtime_session_mgmt 
ON user_session (user_id, is_active, session_token, last_activity_time) 
WHERE is_active = true;

-- Comprehensive activity analytics
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_comprehensive_activity_analytics 
ON user_activity_log (institute_id, user_id, service_name, created_at, device_type) 
WHERE created_at >= NOW() - INTERVAL '6 months';

-- ================================================================================================
-- SCRIPT COMPLETION
-- ================================================================================================

-- Update table statistics for better query planning
ANALYZE;

-- Log completion
DO $$
BEGIN
    RAISE NOTICE 'Vacademy Auth Service Database Indexing Script completed successfully!';
    RAISE NOTICE 'Total indexes created: Approximately 65+ indexes covering all major query patterns';
    RAISE NOTICE 'Performance improvements expected for: User authentication, Role management, Session tracking, Activity analytics, OAuth flows';
    RAISE NOTICE 'Security enhancements: Failed login tracking, IP monitoring, Token management';
    RAISE NOTICE 'Remember to monitor index usage and adjust as needed based on actual query patterns';
END $$; 