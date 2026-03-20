-- Create timeline_event table to track all actions taken by admins, parents, students, and system.
-- This table provides a general-purpose timeline optimized for audit trail viewing.

CREATE TABLE IF NOT EXISTS timeline_event (
    id VARCHAR(36) PRIMARY KEY,
    type VARCHAR(50) NOT NULL,                           -- Parent entity type: ENQUIRY, APPLICANT, STUDENT, etc.
    type_id VARCHAR(255) NOT NULL,                       -- Parent entity ID (e.g., enquiry UUID)
    action_type VARCHAR(100) NOT NULL,                   -- Standardized action: STATUS_CHANGE, NOTE_ADDED, FEE_PAID, COUNSELOR_ASSIGNED, etc.
    actor_type VARCHAR(50) NOT NULL,                     -- Who did this: ADMIN, SYSTEM, PARENT, STUDENT
    actor_id VARCHAR(255),                               -- User ID of the person who took the action (nullable for SYSTEM actions)
    actor_name VARCHAR(255),                             -- Snapshot of person's name to avoid auth DB lookups
    title VARCHAR(500) NOT NULL,                         -- Human readable title: "Status changed to Application"
    description TEXT,                                     -- Deeper details: what happened, note text, etc.
    metadata_json JSONB,                                 -- Flexible JSON column for extra data: {"from": "NEW", "to": "FOLLOW_UP"}
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Index for fetching timeline events by parent entity (primary use case)
CREATE INDEX IF NOT EXISTS idx_timeline_event_type_type_id 
    ON timeline_event(type, type_id, created_at DESC);

-- Index for fetching timeline events by action type (for filtering/reporting)
CREATE INDEX IF NOT EXISTS idx_timeline_event_action_type 
    ON timeline_event(action_type, created_at DESC);

-- Index for fetching timeline events by actor (to see what a specific user did)
CREATE INDEX IF NOT EXISTS idx_timeline_event_actor 
    ON timeline_event(actor_id, created_at DESC) 
    WHERE actor_id IS NOT NULL;

-- Index for JSONB column for efficient queries on metadata
CREATE INDEX IF NOT EXISTS idx_timeline_event_metadata_json 
    ON timeline_event USING GIN (metadata_json);

-- Comments for documentation
COMMENT ON TABLE timeline_event IS 'Timeline event system for tracking all actions across entities';
COMMENT ON COLUMN timeline_event.type IS 'Parent entity type: ENQUIRY, APPLICANT, STUDENT, etc.';
COMMENT ON COLUMN timeline_event.type_id IS 'Parent entity ID (UUID or identifier)';
COMMENT ON COLUMN timeline_event.action_type IS 'Standardized action type for filtering';
COMMENT ON COLUMN timeline_event.actor_type IS 'Type of actor: ADMIN, SYSTEM, PARENT, STUDENT';
COMMENT ON COLUMN timeline_event.actor_id IS 'User ID of actor (nullable for SYSTEM)';
COMMENT ON COLUMN timeline_event.actor_name IS 'Snapshot of actor name for quick display';
COMMENT ON COLUMN timeline_event.title IS 'Human-readable short title for UI display';
COMMENT ON COLUMN timeline_event.description IS 'Detailed description or note content';
COMMENT ON COLUMN timeline_event.metadata_json IS 'Flexible JSON for additional context (from/to values, etc.)';
