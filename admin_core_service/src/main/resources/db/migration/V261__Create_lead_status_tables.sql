-- ============================================================
-- V261: Move custom lead statuses out of LEAD_SETTING JSON into proper tables.
-- Enables querying / filtering / reporting on lead statuses and automatic
-- status updates (vs. an opaque JSON blob on institutes.setting_json).
--   * lead_status            — per-institute status catalog (the pipeline stages)
--   * audience_response.lead_status_id — a lead's CURRENT status (FK)
--   * lead_status_history    — every status transition (funnel + audit + auto-updates)
-- ============================================================

-- 1. Status catalog (per institute)
CREATE TABLE IF NOT EXISTS lead_status (
    id            TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    institute_id  VARCHAR(255) NOT NULL,
    status_key    VARCHAR(100) NOT NULL,      -- stable code, e.g. NEW / INTERESTED
    label         VARCHAR(255) NOT NULL,      -- display name
    color         VARCHAR(20),                -- hex chip colour
    display_order INTEGER NOT NULL DEFAULT 0,
    is_default    BOOLEAN NOT NULL DEFAULT FALSE,  -- status applied to brand-new leads
    is_active     BOOLEAN NOT NULL DEFAULT TRUE,   -- soft delete (keeps history valid)
    created_at    TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at    TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_lead_status_institute_key ON lead_status(institute_id, status_key);
CREATE INDEX IF NOT EXISTS idx_lead_status_institute ON lead_status(institute_id, is_active, display_order);

-- 2. A lead's current status (FK to lead_status). Lead = audience_response row.
ALTER TABLE audience_response ADD COLUMN IF NOT EXISTS lead_status_id TEXT;
CREATE INDEX IF NOT EXISTS idx_audience_response_lead_status ON audience_response(lead_status_id);

-- 3. Status transition history (drives funnel / time-in-stage reporting + audit)
CREATE TABLE IF NOT EXISTS lead_status_history (
    id                   TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    audience_response_id TEXT NOT NULL,
    institute_id         VARCHAR(255) NOT NULL,
    from_status_id       TEXT,
    to_status_id         TEXT,
    changed_by_user_id   VARCHAR(255),
    source               VARCHAR(30) NOT NULL DEFAULT 'MANUAL',  -- MANUAL | WORKFLOW | AUTO
    changed_at           TIMESTAMP NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_lead ON lead_status_history(audience_response_id, changed_at);
CREATE INDEX IF NOT EXISTS idx_lead_status_history_institute ON lead_status_history(institute_id, to_status_id);
