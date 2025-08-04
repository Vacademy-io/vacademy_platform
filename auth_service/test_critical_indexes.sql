-- ================================================================================================
-- VACADEMY AUTH SERVICE CRITICAL INDEXES VALIDATION SCRIPT
-- ================================================================================================
-- This script validates that critical indexes are properly created and functioning
-- Run this after executing the main database_indexes_script.sql
-- ================================================================================================

-- ================================================================================================
-- INDEX EXISTENCE VALIDATION
-- ================================================================================================

-- Check if critical indexes exist
DO $$
DECLARE
    missing_indexes TEXT[] := ARRAY[]::TEXT[];
    critical_indexes TEXT[] := ARRAY[
        'idx_users_username',
        'idx_users_email',
        'idx_user_role_user_id',
        'idx_user_role_user_institute',
        'idx_user_session_active_token',
        'idx_user_activity_log_user_institute_date',
        'idx_refresh_token_token',
        'idx_role_permission_composite'
    ];
    idx TEXT;
    index_exists BOOLEAN;
BEGIN
    RAISE NOTICE 'Validating critical indexes existence...';
    
    FOREACH idx IN ARRAY critical_indexes
    LOOP
        SELECT EXISTS (
            SELECT 1 FROM pg_indexes 
            WHERE indexname = idx AND schemaname = 'public'
        ) INTO index_exists;
        
        IF NOT index_exists THEN
            missing_indexes := array_append(missing_indexes, idx);
        END IF;
    END LOOP;
    
    IF array_length(missing_indexes, 1) > 0 THEN
        RAISE WARNING 'Missing critical indexes: %', array_to_string(missing_indexes, ', ');
    ELSE
        RAISE NOTICE 'All critical indexes exist!';
    END IF;
END $$;

-- ================================================================================================
-- QUERY PERFORMANCE VALIDATION
-- ================================================================================================

-- Test 1: Username lookup performance
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM users WHERE username = 'test_user_12345';

-- Test 2: Email lookup with role join performance
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT u.*, ur.role_id, ur.institute_id 
FROM users u
JOIN user_role ur ON ur.user_id = u.id
WHERE u.email = 'test@example.com' AND ur.status = 'ACTIVE';

-- Test 3: Active session validation performance
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT * FROM user_session 
WHERE session_token = 'test_token_12345' AND is_active = true;

-- Test 4: User activity analytics performance
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT COUNT(*) FROM user_activity_log 
WHERE user_id = 'test_user_id' 
AND institute_id = 'test_institute_id' 
AND created_at >= NOW() - INTERVAL '30 days';

-- Test 5: Role permission resolution performance
EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON)
SELECT DISTINCT p.permission_name 
FROM permissions p
JOIN role_permission rp ON rp.permission_id = p.id
JOIN user_role ur ON ur.role_id = rp.role_id
WHERE ur.user_id = 'test_user_id' AND ur.status = 'ACTIVE';

-- ================================================================================================
-- INDEX USAGE STATISTICS
-- ================================================================================================

-- Display index usage statistics for critical tables
SELECT 
    schemaname,
    tablename,
    indexname,
    idx_scan as "Index Scans",
    idx_tup_read as "Tuples Read",
    idx_tup_fetch as "Tuples Fetched",
    CASE WHEN idx_scan = 0 THEN 'UNUSED' ELSE 'ACTIVE' END as status
FROM pg_stat_user_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'user_role', 'user_session', 'user_activity_log', 'refresh_token')
AND indexname LIKE 'idx_%'
ORDER BY tablename, idx_scan DESC;

-- ================================================================================================
-- TABLE STATISTICS ANALYSIS
-- ================================================================================================

-- Analyze table statistics to ensure indexes are utilized
SELECT 
    schemaname,
    tablename,
    n_tup_ins as "Inserts",
    n_tup_upd as "Updates", 
    n_tup_del as "Deletes",
    n_live_tup as "Live Tuples",
    n_dead_tup as "Dead Tuples",
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables 
WHERE schemaname = 'public'
AND tablename IN ('users', 'user_role', 'user_session', 'user_activity_log', 'refresh_token')
ORDER BY tablename;

-- ================================================================================================
-- INDEX SIZE ANALYSIS
-- ================================================================================================

-- Check index sizes to understand storage impact
SELECT 
    schemaname,
    tablename,
    indexname,
    pg_size_pretty(pg_relation_size(indexrelid)) as "Index Size"
FROM pg_stat_user_indexes 
WHERE schemaname = 'public' 
AND tablename IN ('users', 'user_role', 'user_session', 'user_activity_log')
AND indexname LIKE 'idx_%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ================================================================================================
-- PERFORMANCE BASELINE QUERIES
-- ================================================================================================

-- Query 1: Fast user authentication
-- Should use idx_users_username
SELECT 
    'User Authentication' as test_name,
    COUNT(*) as result_count
FROM users 
WHERE username = 'admin' OR username = 'test_user';

-- Query 2: Role-based access check
-- Should use idx_user_role_user_institute
SELECT 
    'RBAC Check' as test_name,
    COUNT(*) as result_count
FROM user_role 
WHERE status = 'ACTIVE' 
AND institute_id IS NOT NULL;

-- Query 3: Active session count
-- Should use idx_user_session_is_active
SELECT 
    'Active Sessions' as test_name,
    COUNT(*) as result_count
FROM user_session 
WHERE is_active = true;

-- Query 4: Recent activity analysis
-- Should use idx_user_activity_log_created_at
SELECT 
    'Recent Activity' as test_name,
    COUNT(*) as result_count
FROM user_activity_log 
WHERE created_at >= NOW() - INTERVAL '24 hours';

-- ================================================================================================
-- VALIDATION SUMMARY
-- ================================================================================================

-- Generate validation summary
DO $$
DECLARE
    total_indexes INTEGER;
    auth_indexes INTEGER;
    large_tables INTEGER;
BEGIN
    -- Count total indexes created
    SELECT COUNT(*) INTO total_indexes
    FROM pg_indexes 
    WHERE schemaname = 'public' AND indexname LIKE 'idx_%';
    
    -- Count auth-specific indexes
    SELECT COUNT(*) INTO auth_indexes
    FROM pg_indexes 
    WHERE schemaname = 'public' 
    AND indexname LIKE 'idx_%'
    AND (indexname LIKE '%user%' OR indexname LIKE '%role%' OR indexname LIKE '%session%' OR indexname LIKE '%activity%');
    
    -- Count tables with significant data
    SELECT COUNT(*) INTO large_tables
    FROM pg_stat_user_tables 
    WHERE schemaname = 'public' AND n_live_tup > 1000;
    
    RAISE NOTICE '================================================================================================';
    RAISE NOTICE 'AUTH SERVICE INDEX VALIDATION SUMMARY';
    RAISE NOTICE '================================================================================================';
    RAISE NOTICE 'Total Indexes Created: %', total_indexes;
    RAISE NOTICE 'Auth-Specific Indexes: %', auth_indexes;
    RAISE NOTICE 'Tables with Significant Data: %', large_tables;
    RAISE NOTICE '================================================================================================';
    RAISE NOTICE 'Validation completed successfully!';
    RAISE NOTICE 'Review the EXPLAIN ANALYZE results above to verify index usage.';
    RAISE NOTICE 'Monitor pg_stat_user_indexes for ongoing index performance.';
    RAISE NOTICE '================================================================================================';
END $$; 