-- ============================================================
-- V260: Lead TAT / Follow-up SLA reminder dedup state on audience_response
-- The backend only EMITS workflow triggers (LEAD_TAT_REMINDER_BEFORE,
-- LEAD_TAT_OVERDUE, FOLLOW_UP_DUE, FOLLOW_UP_OVERDUE). These columns guarantee
-- each stage is emitted only once per lead (replica-safe), independent of the
-- workflow engine's own idempotency. All delivery/config lives in the workflow
-- engine + LEAD_SETTING institute setting JSON.
-- ============================================================

-- Dedup state (linear stage machine): BEFORE_* -> OVERDUE -> FOLLOW_UP_DUE -> FOLLOW_UP_OVERDUE
ALTER TABLE audience_response ADD COLUMN IF NOT EXISTS tat_reminder_count       INTEGER NOT NULL DEFAULT 0;
ALTER TABLE audience_response ADD COLUMN IF NOT EXISTS tat_reminder_stage       VARCHAR(40);
ALTER TABLE audience_response ADD COLUMN IF NOT EXISTS tat_reminder_dedup_key   VARCHAR(255);
-- Counselor the last reminder was emitted for; a different current counselor resets the cycle.
ALTER TABLE audience_response ADD COLUMN IF NOT EXISTS tat_reminder_assignee_id VARCHAR(255);
-- Denormalized TAT deadline (submitted_at + tatHours) for cheap scanning + the frontend badge.
ALTER TABLE audience_response ADD COLUMN IF NOT EXISTS tat_due_at               TIMESTAMP;

-- Cross-replica single-fire guard: <leadId>_<counselorId>_<stage> is globally unique.
CREATE UNIQUE INDEX IF NOT EXISTS uq_audience_response_tat_dedup
    ON audience_response (tat_reminder_dedup_key) WHERE tat_reminder_dedup_key IS NOT NULL;

-- Speeds the scheduler scan for open, due, not-yet-reminded leads.
CREATE INDEX IF NOT EXISTS idx_audience_response_tat_scan
    ON audience_response (overall_status, tat_due_at, tat_reminder_stage);
