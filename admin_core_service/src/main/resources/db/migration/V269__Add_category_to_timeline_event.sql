-- Separate lead-journey system events from manual activity (notes, calls).
-- Existing rows get ACTIVITY so the notes/calls UI is unaffected.
-- New journey events (status changes, submissions, score updates) use JOURNEY.
ALTER TABLE timeline_event
    ADD COLUMN IF NOT EXISTS category VARCHAR(20) NOT NULL DEFAULT 'ACTIVITY';

-- Index to make GET /journey queries fast (type + typeId + category is the common filter)
CREATE INDEX IF NOT EXISTS idx_timeline_event_type_typeid_category
    ON timeline_event (type, type_id, category);

-- Index for student cross-stage journey view
CREATE INDEX IF NOT EXISTS idx_timeline_event_student_category
    ON timeline_event (student_user_id, category);
