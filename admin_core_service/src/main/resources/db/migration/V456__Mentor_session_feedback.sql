-- Post-session feedback: the learner rates a mentor session after it happens.
--
-- Mentorship had no quality signal at all — an admin could see how many sessions
-- ran but never whether they were any good, and a mentor got no feedback loop.
-- One rating per (session, learner); the mentor's average is derived, never stored,
-- so a deleted row can't leave a stale score behind.
--
-- Ratings are attached to booking_instance (the session that already exists), not
-- to the assignment, so the same table serves per-session and per-mentor views.

CREATE TABLE IF NOT EXISTS mentor_session_feedback (
    id                  VARCHAR(255) PRIMARY KEY,
    institute_id        VARCHAR(255) NOT NULL,
    booking_instance_id VARCHAR(255) NOT NULL,   -- the session being rated
    mentor_id           VARCHAR(255) NOT NULL,   -- -> mentor.id
    mentor_user_id      VARCHAR(255) NOT NULL,   -- denormalized for mentor-facing reads
    student_user_id     VARCHAR(255) NOT NULL,   -- the learner who rated it
    rating              SMALLINT     NOT NULL,
    comment             TEXT,
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT ck_msf_rating CHECK (rating BETWEEN 1 AND 5)
);

-- A learner rates a given session once. Editing updates the existing row.
CREATE UNIQUE INDEX IF NOT EXISTS uq_msf_booking_student
    ON mentor_session_feedback (booking_instance_id, student_user_id);
CREATE INDEX IF NOT EXISTS idx_msf_mentor ON mentor_session_feedback (mentor_id);
CREATE INDEX IF NOT EXISTS idx_msf_institute ON mentor_session_feedback (institute_id);
CREATE INDEX IF NOT EXISTS idx_msf_student ON mentor_session_feedback (institute_id, student_user_id);

COMMENT ON COLUMN mentor_session_feedback.rating  IS '1-5 stars, enforced by ck_msf_rating so a bad client can never store 0 or 7.';
COMMENT ON COLUMN mentor_session_feedback.comment IS 'Optional free text from the learner. Visible to admins; never shown to other learners.';

-- updated_at maintenance, reusing the shared function from V411.
DROP TRIGGER IF EXISTS trigger_update_mentor_session_feedback_updated_at ON mentor_session_feedback;
CREATE TRIGGER trigger_update_mentor_session_feedback_updated_at
    BEFORE UPDATE ON mentor_session_feedback
    FOR EACH ROW EXECUTE FUNCTION update_mentor_updated_at();
