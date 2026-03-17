-- Add session_id to audience table
ALTER TABLE audience
ADD COLUMN session_id VARCHAR(255);

-- Add Foreign Key constraint to session table (using quotes as it is a reserved word)
ALTER TABLE audience
ADD CONSTRAINT fk_audience_session
FOREIGN KEY (session_id)
REFERENCES "session"(id)
ON DELETE SET NULL;

-- Add index for session_id
CREATE INDEX idx_audience_session_id ON audience(session_id);

-- Add fields to audience_response table
ALTER TABLE audience_response
ADD COLUMN destination_package_session_id VARCHAR(255),
ADD COLUMN enquiry_id VARCHAR(255),
ADD COLUMN parent_name VARCHAR(255),
ADD COLUMN parent_email VARCHAR(255),
ADD COLUMN parent_mobile VARCHAR(20);

-- Add indexes for new fields that might be queried frequently
CREATE INDEX idx_audience_response_enquiry_id ON audience_response(enquiry_id);
CREATE INDEX idx_audience_response_dest_pkg_session_id ON audience_response(destination_package_session_id);

-- 1. Create Enquiry Table
-- Stores customer enquiries with detailed tracking info

CREATE TABLE IF NOT EXISTS enquiry (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    checklist                   TEXT,                      -- JSON structure for checklist items
    enquiry_status              VARCHAR(50),
    convertion_status           VARCHAR(255),     -- Keeping user's spelling property
    reference_source            VARCHAR(255),
    assigned_user_id            BOOLEAN DEFAULT FALSE,
    assigned_visit_session_id   BOOLEAN DEFAULT FALSE,
    fee_range_expectation       VARCHAR(255),
    transport_requirement       VARCHAR(255),
    mode                        VARCHAR(50),
    enquiry_tracking_id         VARCHAR(255),
    interest_score              INTEGER,
    notes                       TEXT,
    
    created_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_enquiry_assigned_user_id ON enquiry(assigned_user_id);
CREATE INDEX idx_enquiry_tracking_id ON enquiry(enquiry_tracking_id);

-- 2. Create Checklist Table
-- master table for checklists

CREATE TABLE IF NOT EXISTS checklist (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name        VARCHAR(255),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 3. Create Linked Events Table
-- tracks events linked to a source (polymorphic)

CREATE TABLE IF NOT EXISTS linked_events (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source      VARCHAR(255),      -- Polymorphic Source Type
    source_id   VARCHAR(255),     -- Polymorphic Source ID
    linked_session_id VARCHAR(255),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_linked_events_live_session FOREIGN KEY (linked_session_id) REFERENCES live_session(id) ON DELETE SET NULL
);

CREATE INDEX idx_linked_events_linked_session_id ON linked_events(linked_session_id);
CREATE INDEX idx_linked_events_source ON linked_events(source, source_id);

-- 4. Create Linked Users Table
-- tracks users linked to a source (polymorphic)

CREATE TABLE IF NOT EXISTS linked_users (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    source      VARCHAR(255),
    source_id   VARCHAR(255),
    user_id     VARCHAR(255),
    created_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at  TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_linked_users_user_id ON linked_users(user_id);
CREATE INDEX idx_linked_users_source ON linked_users(source, source_id);

-- 5. Create Users Operations Log Table
-- Audit log for user operations

CREATE TABLE IF NOT EXISTS users_operations_log (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    action_user_id  VARCHAR(255),    -- User performing the action
    source          VARCHAR(255),    -- Target resource type
    source_id       VARCHAR(255),   -- Target resource ID
    created_by      VARCHAR(255),   -- Name or ID of creator
    from_value      TEXT,
    to_value        TEXT,
    created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_users_ops_log_source ON users_operations_log(source, source_id);
CREATE INDEX idx_users_ops_log_action_user ON users_operations_log(action_user_id);
