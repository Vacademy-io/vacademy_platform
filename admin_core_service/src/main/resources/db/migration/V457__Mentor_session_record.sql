-- Mentor-side record of what happened in a session.
--
-- Sessions themselves stay in booking_instance — this does NOT introduce a second
-- session or booking entity. booking_instance tracks whether a slot is CONFIRMED /
-- CANCELLED / RESCHEDULED, i.e. the state of the *appointment*, and it is shared
-- with non-mentorship bookings (lead calls, counselling). What was missing is the
-- state of the *mentorship*: did it actually take place, and what came out of it.
--
-- That lives here, alongside mentor_session_feedback (V456), which holds the
-- learner's half of the same session. One row per session:
--   mentor_session_record   = mentor's outcome + notes  (this table)
--   mentor_session_feedback = learner's rating + comment (V456)
--
-- Because outcome lives here rather than in booking_instance.status, existing
-- bookings are untouched and non-mentorship bookings keep their current semantics.

CREATE TABLE IF NOT EXISTS mentor_session_record (
    id                  VARCHAR(255) PRIMARY KEY,
    institute_id        VARCHAR(255) NOT NULL,
    booking_instance_id VARCHAR(255) NOT NULL,   -- the session (booking_instance.id)
    mentor_id           VARCHAR(255) NOT NULL,   -- -> mentor.id
    mentor_user_id      VARCHAR(255) NOT NULL,   -- denormalized for mentor-facing reads
    student_user_id     VARCHAR(255) NOT NULL,
    outcome             VARCHAR(50)  NOT NULL,   -- COMPLETED | NO_SHOW
    notes               TEXT,                    -- mentor's private-to-staff notes
    topic               VARCHAR(500),            -- what the session covered
    marked_by_user_id   VARCHAR(255),
    marked_at           TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_msr_outcome CHECK (outcome IN ('COMPLETED', 'NO_SHOW'))
);

-- One record per session. Re-marking updates it rather than adding a second.
CREATE UNIQUE INDEX IF NOT EXISTS uq_msr_booking
    ON mentor_session_record (booking_instance_id);
CREATE INDEX IF NOT EXISTS idx_msr_institute_outcome
    ON mentor_session_record (institute_id, outcome);
CREATE INDEX IF NOT EXISTS idx_msr_mentor ON mentor_session_record (mentor_id);
CREATE INDEX IF NOT EXISTS idx_msr_student ON mentor_session_record (institute_id, student_user_id);

COMMENT ON COLUMN mentor_session_record.outcome IS 'COMPLETED or NO_SHOW, enforced by ck_msr_outcome. Absence of a row means the session has not been reviewed yet.';
COMMENT ON COLUMN mentor_session_record.notes   IS 'Mentor''s notes on the session. Visible to the mentor and to admins; never shown to the learner.';

-- updated_at maintenance, reusing the shared function from V411.
DROP TRIGGER IF EXISTS trigger_update_mentor_session_record_updated_at ON mentor_session_record;
CREATE TRIGGER trigger_update_mentor_session_record_updated_at
    BEFORE UPDATE ON mentor_session_record
    FOR EACH ROW EXECUTE FUNCTION update_mentor_updated_at();
