-- Fix type mismatch: JPA maps bbb_server_id as String (VARCHAR),
-- but V192 created it as UUID with a FK to bbb_server_pool(id).
-- Drop the FK constraint, change column to VARCHAR, keep it compatible.
ALTER TABLE session_schedules
    DROP CONSTRAINT IF EXISTS session_schedules_bbb_server_id_fkey;

ALTER TABLE session_schedules
    ALTER COLUMN bbb_server_id TYPE VARCHAR(36) USING bbb_server_id::VARCHAR;
