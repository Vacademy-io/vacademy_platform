-- ================================================================================================
-- VACADEMY RDS PARAMETER GROUP SETTINGS RECOMMENDATION
-- ================================================================================================
-- Run these queries to check current settings and see recommendations
-- Apply changes via AWS Console -> RDS -> Parameter Groups -> custom-vacademy-parameter-group
-- ================================================================================================

-- ================================================================================================
-- SECTION 1: CHECK CURRENT SETTINGS
-- ================================================================================================

-- Check current memory settings
SELECT name, setting, unit, 
       CASE 
           WHEN unit = '8kB' THEN (setting::bigint * 8 / 1024) || ' MB'
           WHEN unit = 'kB' THEN (setting::bigint / 1024) || ' MB'
           ELSE setting || ' ' || COALESCE(unit, '')
       END AS human_readable,
       short_desc
FROM pg_settings 
WHERE name IN (
    'shared_buffers',
    'effective_cache_size', 
    'work_mem',
    'maintenance_work_mem',
    'temp_buffers',
    'wal_buffers'
)
ORDER BY name;

-- Check query planner settings
SELECT name, setting, unit, short_desc
FROM pg_settings 
WHERE name IN (
    'random_page_cost',
    'seq_page_cost',
    'effective_io_concurrency',
    'default_statistics_target',
    'jit',
    'parallel_tuple_cost',
    'parallel_setup_cost',
    'max_parallel_workers_per_gather',
    'max_parallel_workers'
)
ORDER BY name;

-- Check connection/transaction settings
SELECT name, setting, unit, short_desc
FROM pg_settings 
WHERE name IN (
    'max_connections',
    'idle_in_transaction_session_timeout',
    'statement_timeout',
    'lock_timeout',
    'default_transaction_isolation'
)
ORDER BY name;

-- ================================================================================================
-- SECTION 2: RECOMMENDED PARAMETER VALUES
-- ================================================================================================
-- Apply these via AWS RDS Console -> Parameter Groups -> Edit Parameters

/*
============ MEMORY SETTINGS (For db.t4g.small with 2GB RAM) ============

Parameter               | RDS Console Value | Notes
------------------------|-------------------|--------------------------------
shared_buffers          | 65536             | In 8KB pages = ~512MB (25% RAM)
effective_cache_size    | 196608            | In 8KB pages = ~1.5GB (75% RAM)
work_mem                | 65536             | In KB = 64MB (for complex sorts)
maintenance_work_mem    | 262144            | In KB = 256MB (for VACUUM/INDEX)

============ QUERY PLANNER (Critical for SSD/gp3 storage) ============

Parameter                      | Value  | Notes
-------------------------------|--------|--------------------------------
random_page_cost               | 1.1    | SSD is almost as fast as sequential
seq_page_cost                  | 1.0    | Default is fine
effective_io_concurrency       | 200    | SSD can handle parallel IO
default_statistics_target      | 200    | Better query plan estimation
jit                           | off    | Disable JIT for OLTP (faster short queries)

============ PARALLEL QUERY (Leverage 2 CPU cores) ============

Parameter                      | Value  | Notes
-------------------------------|--------|--------------------------------
max_parallel_workers_per_gather| 2      | Use both cores for large queries
max_parallel_workers           | 4      | Total parallel workers
max_worker_processes           | 8      | Background workers + parallel
parallel_tuple_cost            | 0.01   | Encourage parallelism
parallel_setup_cost            | 100    | Reduce parallel startup threshold
min_parallel_table_scan_size   | 8MB    | Parallelize smaller tables

============ CONNECTION & TIMEOUT SETTINGS ============

Parameter                          | Value  | Notes
-----------------------------------|--------|--------------------------------
idle_in_transaction_session_timeout| 60000  | 1 min, kill idle transactions
statement_timeout                  | 300000 | 5 min max query time
lock_timeout                       | 30000  | 30 sec max lock wait
tcp_keepalives_idle                | 300    | Keep connections alive
tcp_keepalives_interval            | 10     | Keepalive check interval
tcp_keepalives_count               | 5      | Retries before dropping

============ LOGGING (For slow query analysis) ============

Parameter                | Value  | Notes
-------------------------|--------|--------------------------------
log_min_duration_statement| 1000   | Log queries > 1 second
log_statement            | none   | Don't log all statements
log_lock_waits           | on     | Log lock wait events
log_temp_files           | 0      | Log all temp file usage
auto_explain.log_min_duration | 5000 | Explain plans for queries > 5s

============ AUTOVACUUM (Critical for performance over time) ============

Parameter                      | Value  | Notes
-------------------------------|--------|--------------------------------
autovacuum_vacuum_scale_factor | 0.1    | Vacuum after 10% changes
autovacuum_analyze_scale_factor| 0.05   | Analyze after 5% changes  
autovacuum_max_workers         | 3      | Parallel vacuum workers
autovacuum_vacuum_cost_limit   | 2000   | Speed up vacuum

*/

-- ================================================================================================
-- SECTION 3: VERIFY AFTER APPLYING CHANGES
-- ================================================================================================

-- Check if changes are pending reboot
SELECT name, setting, pending_restart
FROM pg_settings 
WHERE pending_restart = true;

-- Check parallel query status
SHOW max_parallel_workers_per_gather;
SHOW parallel_tuple_cost;

-- Check JIT status (should be off for OLTP)
SHOW jit;

-- Check isolation level
SHOW default_transaction_isolation;

-- ================================================================================================
-- SECTION 4: ANALYZE TABLE STATISTICS (Run periodically)
-- ================================================================================================

-- Update statistics for better query planning (run weekly or after bulk inserts)
ANALYZE VERBOSE activity_log;
ANALYZE VERBOSE student_session_institute_group_mapping;
ANALYZE VERBOSE learner_operation;
ANALYZE VERBOSE slide;
ANALYZE VERBOSE chapter_to_slides;
ANALYZE VERBOSE video_tracked;
ANALYZE VERBOSE document_tracked;

-- ================================================================================================
-- SECTION 5: CHECK SLOW QUERIES (Using Performance Insights)
-- ================================================================================================

-- Find currently running slow queries
SELECT 
    pid,
    now() - pg_stat_activity.query_start AS duration,
    query,
    state,
    wait_event_type,
    wait_event
FROM pg_stat_activity
WHERE (now() - pg_stat_activity.query_start) > interval '5 seconds'
AND state != 'idle'
ORDER BY duration DESC;

-- Find queries waiting for locks
SELECT 
    blocked_locks.pid AS blocked_pid,
    blocked_activity.usename AS blocked_user,
    blocking_locks.pid AS blocking_pid,
    blocking_activity.usename AS blocking_user,
    blocked_activity.query AS blocked_statement,
    blocking_activity.query AS current_statement_in_blocking_process
FROM pg_catalog.pg_locks blocked_locks
JOIN pg_catalog.pg_stat_activity blocked_activity ON blocked_activity.pid = blocked_locks.pid
JOIN pg_catalog.pg_locks blocking_locks 
    ON blocking_locks.locktype = blocked_locks.locktype
    AND blocking_locks.database IS NOT DISTINCT FROM blocked_locks.database
    AND blocking_locks.relation IS NOT DISTINCT FROM blocked_locks.relation
    AND blocking_locks.page IS NOT DISTINCT FROM blocked_locks.page
    AND blocking_locks.tuple IS NOT DISTINCT FROM blocked_locks.tuple
    AND blocking_locks.virtualxid IS NOT DISTINCT FROM blocked_locks.virtualxid
    AND blocking_locks.transactionid IS NOT DISTINCT FROM blocked_locks.transactionid
    AND blocking_locks.classid IS NOT DISTINCT FROM blocked_locks.classid
    AND blocking_locks.objid IS NOT DISTINCT FROM blocked_locks.objid
    AND blocking_locks.objsubid IS NOT DISTINCT FROM blocked_locks.objsubid
    AND blocking_locks.pid != blocked_locks.pid
JOIN pg_catalog.pg_stat_activity blocking_activity ON blocking_activity.pid = blocking_locks.pid
WHERE NOT blocked_locks.granted;

-- ================================================================================================
-- SECTION 6: INDEX USAGE STATISTICS
-- ================================================================================================

-- Check if indexes are being used
SELECT 
    schemaname,
    relname AS table_name,
    indexrelname AS index_name,
    idx_scan AS times_used,
    idx_tup_read,
    idx_tup_fetch,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
ORDER BY idx_scan DESC
LIMIT 20;

-- Find unused indexes (candidates for removal)
SELECT 
    schemaname,
    relname AS table_name,
    indexrelname AS index_name,
    idx_scan AS times_used,
    pg_size_pretty(pg_relation_size(indexrelid)) AS index_size
FROM pg_stat_user_indexes
WHERE idx_scan = 0
AND indexrelname NOT LIKE '%pkey%'
ORDER BY pg_relation_size(indexrelid) DESC;

-- ================================================================================================
-- SECTION 7: TABLE BLOAT CHECK (Impact on query performance)
-- ================================================================================================

-- Check table bloat (dead tuples needing vacuum)
SELECT 
    schemaname,
    relname AS table_name,
    n_live_tup,
    n_dead_tup,
    ROUND(100.0 * n_dead_tup / NULLIF(n_live_tup + n_dead_tup, 0), 2) AS dead_percent,
    last_vacuum,
    last_autovacuum,
    last_analyze,
    last_autoanalyze
FROM pg_stat_user_tables
WHERE n_dead_tup > 1000
ORDER BY n_dead_tup DESC
LIMIT 20;

-- Force vacuum on critical tables if needed
-- VACUUM (VERBOSE, ANALYZE) activity_log;
-- VACUUM (VERBOSE, ANALYZE) learner_operation;

-- ================================================================================================
-- END OF SCRIPT
-- ================================================================================================
