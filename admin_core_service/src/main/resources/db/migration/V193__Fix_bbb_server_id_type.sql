-- Fix type mismatch: JPA maps bbb_server_id as String (VARCHAR),
-- but V192 created it as UUID. Change to VARCHAR to match the entity.
ALTER TABLE session_schedules
    ALTER COLUMN bbb_server_id TYPE VARCHAR(36) USING bbb_server_id::VARCHAR;
