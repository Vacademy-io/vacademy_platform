-- Fix for missing V2 migration in Flyway schema history
-- Run this SQL script directly on your database if the application still fails to start

-- Option 1: Mark the missing migration as deleted (recommended)
UPDATE flyway_schema_history 
SET success = false, 
    description = 'Add Persistent Guest Tokens (DELETED - file missing)'
WHERE version = '2';

-- Option 2: Remove the V2 entry completely (alternative approach)
-- DELETE FROM flyway_schema_history WHERE version = '2';

-- Verify the change
SELECT installed_rank, version, description, type, script, success 
FROM flyway_schema_history 
ORDER BY installed_rank;
