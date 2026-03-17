-- Create GIN index for fast text search using trigrams (if pg_trgm extension available) or simple B-Tree on LOWER
-- Using B-Tree on LOWER() as it is standard and sufficient for prefix matching (LIKE 'term%') without extra extensions
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_name_lower ON package (LOWER(package_name));

-- Create composite index for filtered searches on package_session
-- This speeds up filtering by session, level, and status
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_session_search 
ON package_session (session_id, level_id, status) 
WHERE status IN ('ACTIVE', 'HIDDEN', 'DRAFT');

-- Create index on package_institute to optimize the institute_id filter
CREATE INDEX CONCURRENTLY IF NOT EXISTS idx_package_institute_access 
ON package_institute (institute_id, package_id);
