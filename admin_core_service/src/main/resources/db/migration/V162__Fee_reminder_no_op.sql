-- V159: No-op migration
-- Originally intended to create fee_reminder_log table.
-- Superseded by V160: idempotency is handled by workflow_execution.idempotency_key
-- (schedule-level dedup) which is sufficient for the CRON-based fee reminder workflow.
SELECT 1;
