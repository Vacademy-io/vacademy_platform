-- ================================================================================================
-- V91: Performance Optimization Indexes for Paginated Batches API
-- ================================================================================================
-- Purpose: Optimize the new paginated batches endpoints:
--   - /paginated-batches/{instituteId} (search, filter, sort, pagination)
--   - /batches-by-ids/{instituteId} (batch lookup by IDs)
--   - /batches-summary/{instituteId} (filter dropdown aggregates)
-- 
-- Expected Performance Gain: 50-70% reduction in query execution time for large institutes
-- ================================================================================================

-- ================================================================================================
-- 1. COMPOSITE INDEX FOR PAGINATED QUERY ON PACKAGE_SESSION
-- ================================================================================================
-- Covers: status filtering, created_at ordering (default sort)
-- Use case: Efficiently paginate through package sessions by status
-- Note: The existing idx_package_session_search covers session_id, level_id, status
--       This adds coverage for package_id and created_at ordering
-- ================================================================================================

CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_session_paginated_search
ON package_session (status, package_id, created_at DESC)
WHERE status IN ('ACTIVE', 'HIDDEN', 'DRAFT');

-- ================================================================================================
-- 2. INDEX FOR PACKAGE_SESSION BY ID
-- ================================================================================================
-- Covers: Fast lookup of package sessions by ID list (batches-by-ids endpoint)
-- Use case: Resolve batch IDs to display names in filter badges
-- Note: Primary key should handle this, but explicit index ensures consistency
-- ================================================================================================

-- Primary key already exists on id, so this is for the JOIN with package_institute
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_session_id_package
ON package_session (id, package_id);

-- ================================================================================================
-- 3. INDEXES FOR TEXT SEARCH ON RELATED TABLES
-- ================================================================================================
-- Covers: Case-insensitive partial matching for search query parameter
-- Use case: Autocomplete/typeahead for package selection
-- Note: idx_package_name_lower already exists in V84
-- ================================================================================================

-- Index for level name search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_level_name_lower 
ON level (LOWER(level_name));

-- Index for session name search
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_name_lower 
ON session (LOWER(session_name));

-- ================================================================================================
-- 4. COMPOSITE INDEX FOR SORTING ON PACKAGE_SESSION
-- ================================================================================================
-- Covers: Various sort combinations (package_name, level_name, session_name, created_at)
-- Use case: Support sortBy parameter in paginated-batches endpoint
-- ================================================================================================

-- Index for created_at sorting (most common default sort)
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_session_created_at_desc
ON package_session (created_at DESC)
WHERE status IN ('ACTIVE', 'HIDDEN');

-- ================================================================================================
-- 5. TRIGRAM INDEX FOR BETTER PARTIAL TEXT SEARCH (OPTIONAL)
-- ================================================================================================
-- Enable pg_trgm extension if not already enabled (requires superuser)
-- Uncomment below if you want better LIKE '%search%' performance
-- ================================================================================================

-- CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_name_trgm 
-- ON package USING gin (package_name gin_trgm_ops);

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_level_name_trgm 
-- ON level USING gin (level_name gin_trgm_ops);

-- CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_session_name_trgm 
-- ON session USING gin (session_name gin_trgm_ops);

-- ================================================================================================
-- NOTES:
-- ================================================================================================
-- 1. All indexes use CONCURRENTLY to avoid locking tables during creation
-- 2. Partial indexes (WHERE status IN ...) reduce index size for inactive records
-- 3. LOWER() indexes support case-insensitive matching without extra function calls
-- 4. Trigram indexes commented out as they require pg_trgm extension
-- 5. Monitor pg_stat_user_indexes to verify index usage after deployment
-- ================================================================================================
