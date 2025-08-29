-- Update the existing workflow schedule to run every minute
-- Current cron: 0***** (at minute 0 of every hour)
-- New cron: * * * * * (every minute)

UPDATE workflow_schedule 
SET 
    cron_expr = '* * * * *',
    next_run_at = NOW() + INTERVAL '1 minute',
    updated_at = NOW()
WHERE workflow_id = 'emo_pkg_02';

-- Verify the update
SELECT 
    workflow_id,
    schedule_type,
    cron_expr,
    status,
    next_run_at,
    updated_at
FROM workflow_schedule 
WHERE workflow_id = 'emo_pkg_02';

-- Check the current database schema
SELECT column_name, data_type, is_nullable
FROM information_schema.columns 
WHERE table_name = 'workflow_schedule' 
ORDER BY ordinal_position; 