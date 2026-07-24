-- Audience-list calendar booking (Calendly-style).
-- booking_page  = a shareable booking configuration ("event type"): single fixed host,
--                 optionally attached to an audience list (CRM campaign), with
--                 availability rules and a public slug.
-- booking_instance = one actual booked meeting. The calendar/reminder substrate stays
--                 the existing live_session + session_schedules rows (created via the
--                 booking flow); this table carries the CRM/booking metadata on top
--                 (invitee, audience_response link, manage token, status).

CREATE TABLE IF NOT EXISTS booking_page (
    id                       VARCHAR(255) PRIMARY KEY,
    institute_id             VARCHAR(255) NOT NULL,
    audience_id              VARCHAR(255),          -- nullable: a host can own a general page
    host_user_id             VARCHAR(255) NOT NULL, -- single fixed host per page (v1 decision)
    booking_type_id          VARCHAR(255),
    slug                     VARCHAR(255) NOT NULL, -- public URL slug, unique per institute
    title                    VARCHAR(500) NOT NULL,
    description              TEXT,
    duration_minutes         INTEGER NOT NULL DEFAULT 30,
    slot_granularity_minutes INTEGER NOT NULL DEFAULT 30,
    buffer_before_minutes    INTEGER NOT NULL DEFAULT 0,
    buffer_after_minutes     INTEGER NOT NULL DEFAULT 0,
    min_notice_minutes       INTEGER NOT NULL DEFAULT 120,  -- "allow booking after some time"
    booking_horizon_days     INTEGER NOT NULL DEFAULT 30,
    timezone                 VARCHAR(100) NOT NULL DEFAULT 'Asia/Kolkata', -- host/page IANA zone
    location_type            VARCHAR(50) NOT NULL DEFAULT 'GOOGLE_MEET',  -- GOOGLE_MEET | CUSTOM_LINK | IN_PERSON | PHONE
    custom_meeting_link      TEXT,
    allocate_google_meet     BOOLEAN NOT NULL DEFAULT FALSE, -- mint a fresh Meet link per booking
    require_approval         BOOLEAN NOT NULL DEFAULT FALSE, -- pending-until-host-confirms vs auto-confirm
    availability_json        TEXT,  -- weekly windows + date overrides (see BookingAvailability DTO)
    reminder_config_json     TEXT,  -- channels + before-meeting offsets
    status                   VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | INACTIVE | DELETED
    created_by_user_id       VARCHAR(255),
    created_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at               TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Partial: soft-deleted pages release their slug for reuse.
CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_page_institute_slug
    ON booking_page (institute_id, slug) WHERE status <> 'DELETED';
CREATE INDEX IF NOT EXISTS idx_booking_page_audience ON booking_page (audience_id);
CREATE INDEX IF NOT EXISTS idx_booking_page_host ON booking_page (host_user_id);

CREATE TABLE IF NOT EXISTS booking_instance (
    id                        VARCHAR(255) PRIMARY KEY,
    institute_id              VARCHAR(255) NOT NULL,
    booking_page_id           VARCHAR(255),          -- nullable: admin create-on-behalf without a page
    live_session_id           VARCHAR(255) NOT NULL, -- the live_session row that IS the calendar event
    schedule_id               VARCHAR(255),          -- the session_schedules occurrence
    host_user_id              VARCHAR(255) NOT NULL,
    invitee_user_id           VARCHAR(255),          -- auth-service user (created on public booking)
    audience_response_id      VARCHAR(255),          -- CRM lead row this booking belongs to
    invitee_name              VARCHAR(500),
    invitee_email             VARCHAR(500),
    invitee_phone             VARCHAR(50),
    invitee_timezone          VARCHAR(100),
    scheduled_start_utc       TIMESTAMP NOT NULL,
    scheduled_end_utc         TIMESTAMP NOT NULL,
    status                    VARCHAR(50) NOT NULL DEFAULT 'CONFIRMED', -- CONFIRMED | PENDING | CANCELLED | RESCHEDULED | COMPLETED | NO_SHOW
    meet_link                 TEXT,
    google_calendar_event_id  VARCHAR(500),          -- Phase 3 one-way Google Calendar push
    custom_field_values_json  TEXT,                  -- Phase 3 booking-form custom fields
    manage_token              VARCHAR(255),          -- opaque token: invitee reschedule/cancel without login
    version                   BIGINT NOT NULL DEFAULT 0, -- optimistic lock (concurrent reschedule guard)
    reschedule_of_instance_id VARCHAR(255),
    cancel_reason             TEXT,
    created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_booking_instance_manage_token
    ON booking_instance (manage_token);
CREATE INDEX IF NOT EXISTS idx_booking_instance_page ON booking_instance (booking_page_id);
CREATE INDEX IF NOT EXISTS idx_booking_instance_host_start
    ON booking_instance (host_user_id, scheduled_start_utc);
CREATE INDEX IF NOT EXISTS idx_booking_instance_session ON booking_instance (live_session_id);
CREATE INDEX IF NOT EXISTS idx_booking_instance_audience_response
    ON booking_instance (audience_response_id);
CREATE INDEX IF NOT EXISTS idx_booking_instance_institute ON booking_instance (institute_id);

-- updated_at maintenance (entities mark the column insertable/updatable=false;
-- mirrors the V89 booking_types trigger precedent).
CREATE OR REPLACE FUNCTION update_booking_page_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_booking_page_updated_at ON booking_page;
CREATE TRIGGER trigger_update_booking_page_updated_at
    BEFORE UPDATE ON booking_page
    FOR EACH ROW EXECUTE FUNCTION update_booking_page_updated_at();

DROP TRIGGER IF EXISTS trigger_update_booking_instance_updated_at ON booking_instance;
CREATE TRIGGER trigger_update_booking_instance_updated_at
    BEFORE UPDATE ON booking_instance
    FOR EACH ROW EXECUTE FUNCTION update_booking_page_updated_at();
