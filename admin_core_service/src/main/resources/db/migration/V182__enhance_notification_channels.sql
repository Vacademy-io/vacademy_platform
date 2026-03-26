-- Widen channel column for comma-separated values (e.g. "EMAIL,PUSH_NOTIFICATION,SYSTEM_NOTIFICATION")
ALTER TABLE schedule_notifications ALTER COLUMN channel TYPE varchar(100);

-- Config table for event-driven notifications (ATTENDANCE) - not time-based
CREATE TABLE IF NOT EXISTS live_session_notification_config (
    id varchar(255) DEFAULT gen_random_uuid()::text PRIMARY KEY,
    session_id varchar(255) NOT NULL,
    notification_type varchar(30) NOT NULL,
    channels varchar(100) NOT NULL,
    enabled boolean DEFAULT true,
    created_at timestamp DEFAULT CURRENT_TIMESTAMP,
    updated_at timestamp DEFAULT now()
);
