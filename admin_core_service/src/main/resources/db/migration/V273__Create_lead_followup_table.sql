CREATE TABLE IF NOT EXISTS lead_followup (
    id              VARCHAR(255) NOT NULL PRIMARY KEY,
    audience_response_id VARCHAR(255) NOT NULL,
    institute_id    VARCHAR(255) NOT NULL,
    created_by      VARCHAR(255),
    schedule_time   TIMESTAMP,
    status          VARCHAR(30)  NOT NULL DEFAULT 'PENDING', -- PENDING | ONGOING | OVERDUE | COMPLETED
    is_closed       BOOLEAN      NOT NULL DEFAULT FALSE,
    content         TEXT,
    closer_reason   TEXT,
    closed_by       VARCHAR(255),
    closed_at       TIMESTAMP,
    created_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_lead_followup_audience_response ON lead_followup(audience_response_id);
CREATE INDEX IF NOT EXISTS idx_lead_followup_institute         ON lead_followup(institute_id);
CREATE INDEX IF NOT EXISTS idx_lead_followup_created_by        ON lead_followup(created_by);
CREATE INDEX IF NOT EXISTS idx_lead_followup_schedule_time     ON lead_followup(schedule_time);
CREATE INDEX IF NOT EXISTS idx_lead_followup_is_closed         ON lead_followup(is_closed);
