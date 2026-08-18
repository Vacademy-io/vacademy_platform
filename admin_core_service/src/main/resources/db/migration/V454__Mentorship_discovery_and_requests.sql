-- Mentorship discovery & requests.
--
-- Until now mentorship was admin-push only: an admin picked students and pushed
-- them onto a mentor. This adds the pull direction that mentorship products are
-- expected to have — a learner browses a mentor directory and requests a mentor,
-- an admin approves, and the approval creates the same assignment row as before.
--
-- Also adds the two mentor attributes that make matching and fair distribution
-- possible: what they mentor on (expertise_tags) and how many mentees they can
-- carry (max_mentees, enforced by manual + round-robin assignment).

-- ---------- mentor: discovery attributes ----------

ALTER TABLE mentor ADD COLUMN IF NOT EXISTS expertise_tags  TEXT;
ALTER TABLE mentor ADD COLUMN IF NOT EXISTS max_mentees     INTEGER;
ALTER TABLE mentor ADD COLUMN IF NOT EXISTS is_discoverable BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN mentor.expertise_tags  IS 'Comma-separated topics this mentor covers, e.g. "JEE Physics,Career guidance". Free text, admin-managed.';
COMMENT ON COLUMN mentor.max_mentees     IS 'Capacity: max ACTIVE assignments. NULL = unlimited. Assignment skips mentors at capacity.';
COMMENT ON COLUMN mentor.is_discoverable IS 'Whether learners see this mentor in the Find-a-mentor directory and can request them. Defaults FALSE so existing institutes are unchanged until an admin opts a mentor in.';

-- ---------- mentor_request: learner asks for a mentor, admin decides ----------

CREATE TABLE IF NOT EXISTS mentor_request (
    id                  VARCHAR(255) PRIMARY KEY,
    institute_id        VARCHAR(255) NOT NULL,
    student_user_id     VARCHAR(255) NOT NULL,       -- the learner asking
    mentor_id           VARCHAR(255),                -- requested mentor; NULL = "any available mentor"
    message             TEXT,                        -- learner's note: what they need help with
    status              VARCHAR(50)  NOT NULL DEFAULT 'PENDING', -- PENDING | APPROVED | DECLINED | CANCELLED
    decided_by_user_id  VARCHAR(255),
    decided_at          TIMESTAMP,
    decision_note       TEXT,                        -- admin's reason, shown to the learner on decline
    assignment_id       VARCHAR(255),                -- the mentor_student_assignment created on approval
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- One live request per (student, mentor) — re-requesting after a decision is allowed.
-- A NULL mentor_id ("any mentor") is covered by the second index: one open
-- open-ended request per student, since NULLs don't collide in a unique index.
CREATE UNIQUE INDEX IF NOT EXISTS uq_mentor_request_pending
    ON mentor_request (institute_id, student_user_id, mentor_id) WHERE status = 'PENDING';
CREATE UNIQUE INDEX IF NOT EXISTS uq_mentor_request_pending_any
    ON mentor_request (institute_id, student_user_id) WHERE status = 'PENDING' AND mentor_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_mentor_request_institute_status
    ON mentor_request (institute_id, status);
CREATE INDEX IF NOT EXISTS idx_mentor_request_student
    ON mentor_request (institute_id, student_user_id);
CREATE INDEX IF NOT EXISTS idx_mentor_request_mentor
    ON mentor_request (mentor_id) WHERE mentor_id IS NOT NULL;

-- updated_at maintenance (entity marks the column insertable/updatable=false),
-- reusing the shared function created in V411.
DROP TRIGGER IF EXISTS trigger_update_mentor_request_updated_at ON mentor_request;
CREATE TRIGGER trigger_update_mentor_request_updated_at
    BEFORE UPDATE ON mentor_request
    FOR EACH ROW EXECUTE FUNCTION update_mentor_updated_at();
