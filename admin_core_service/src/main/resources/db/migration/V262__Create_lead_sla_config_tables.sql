-- ============================================================
-- V262: Move TAT / Follow-up SLA config out of LEAD_SETTING JSON into proper tables,
-- so reminder windows and notify-roles can be queried/reported and edited relationally.
--   * lead_sla_config          — per-institute TAT + follow-up settings (1 row / institute)
--   * lead_sla_reminder_window — TAT "before breach" reminder windows (multiple, ordered)
--   * lead_sla_notify_role     — which institute roles to notify (per TAT / FOLLOWUP)
-- The dedup/tracking columns on audience_response (V260) are unchanged.
-- ============================================================

CREATE TABLE IF NOT EXISTS lead_sla_config (
    id                              TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    institute_id                    VARCHAR(255) NOT NULL UNIQUE,
    tat_enabled                     BOOLEAN NOT NULL DEFAULT FALSE,
    tat_hours                       INTEGER NOT NULL DEFAULT 24,
    followup_enabled                BOOLEAN NOT NULL DEFAULT FALSE,
    followup_sla_hours              INTEGER NOT NULL DEFAULT 24,
    followup_remind_before_minutes  INTEGER NOT NULL DEFAULT 30,
    created_at                      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at                      TIMESTAMP NOT NULL DEFAULT NOW()
);

-- TAT "remind N minutes before the deadline" windows (institute can add several to escalate)
CREATE TABLE IF NOT EXISTS lead_sla_reminder_window (
    id             TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    institute_id   VARCHAR(255) NOT NULL,
    sla_type       VARCHAR(20) NOT NULL DEFAULT 'TAT',  -- TAT (before-breach windows)
    before_minutes INTEGER NOT NULL,
    display_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_lead_sla_window_institute
    ON lead_sla_reminder_window(institute_id, sla_type, display_order);

-- Roles to notify when a TAT / follow-up trigger fires (passed into the workflow ctx)
CREATE TABLE IF NOT EXISTS lead_sla_notify_role (
    id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    institute_id VARCHAR(255) NOT NULL,
    sla_type     VARCHAR(20) NOT NULL,  -- TAT | FOLLOWUP
    role_name    VARCHAR(255) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_lead_sla_role_institute
    ON lead_sla_notify_role(institute_id, sla_type);
