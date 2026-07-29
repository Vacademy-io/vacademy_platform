-- Mentorship: staff↔student relationships within an institute.
-- mentor                    = a user promoted to mentor (custom display name/title/image);
--                             a user can be a mentor in an institute at most once.
-- mentor_student_assignment = which mentor(s) mentor which student. Many-to-many:
--                             a student may have MULTIPLE mentors, a mentor MANY students.
--                             Assignment is either MANUAL (search+select) or ROUND_ROBIN
--                             (bulk equal distribution among a chosen mentor group).
-- Notes attach to the existing timeline_event table (category=ACTIVITY); scheduled calls
-- reuse booking_instance. No new tables for those.

CREATE TABLE IF NOT EXISTS mentor (
    id                    VARCHAR(255) PRIMARY KEY,
    institute_id          VARCHAR(255) NOT NULL,
    user_id               VARCHAR(255) NOT NULL,          -- the promoted platform (auth) user
    display_name          VARCHAR(500),                   -- custom mentor-facing name
    title                 VARCHAR(500),                   -- e.g. "Senior Career Mentor"
    profile_image_file_id VARCHAR(255),                   -- media_service file id
    bio                   TEXT,
    booking_page_id       VARCHAR(255),                   -- their Calendly-style page (nullable)
    sub_org_id            VARCHAR(255),
    status                VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | INACTIVE | DELETED
    created_by_user_id    VARCHAR(255),
    created_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at            TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- A user is a mentor at most once per institute (soft-deleted rows release the slot).
CREATE UNIQUE INDEX IF NOT EXISTS uq_mentor_institute_user
    ON mentor (institute_id, user_id) WHERE status <> 'DELETED';
CREATE INDEX IF NOT EXISTS idx_mentor_institute ON mentor (institute_id);
CREATE INDEX IF NOT EXISTS idx_mentor_user ON mentor (user_id);

CREATE TABLE IF NOT EXISTS mentor_student_assignment (
    id                  VARCHAR(255) PRIMARY KEY,
    institute_id        VARCHAR(255) NOT NULL,
    mentor_id           VARCHAR(255) NOT NULL,            -- -> mentor.id
    mentor_user_id      VARCHAR(255) NOT NULL,            -- denormalized mentor.user_id for fast feeds
    student_user_id     VARCHAR(255) NOT NULL,            -- the mentee's platform user id
    ssigm_id            VARCHAR(255),                     -- optional: specific enrollment (SSIGM row)
    package_session_id  VARCHAR(255),                     -- optional: batch context
    assignment_method   VARCHAR(50) NOT NULL DEFAULT 'MANUAL', -- MANUAL | ROUND_ROBIN | BULK
    assigned_by_user_id VARCHAR(255),
    status              VARCHAR(50) NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | INACTIVE | DELETED
    created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- A given mentor is assigned to a given student at most once (soft-deleted rows re-assignable).
-- Multiple mentors per student remain possible (different mentor_id, same student_user_id).
CREATE UNIQUE INDEX IF NOT EXISTS uq_msa_mentor_student
    ON mentor_student_assignment (institute_id, mentor_id, student_user_id) WHERE status <> 'DELETED';
CREATE INDEX IF NOT EXISTS idx_msa_student ON mentor_student_assignment (institute_id, student_user_id);
CREATE INDEX IF NOT EXISTS idx_msa_mentor ON mentor_student_assignment (institute_id, mentor_user_id);
CREATE INDEX IF NOT EXISTS idx_msa_mentor_id ON mentor_student_assignment (mentor_id);

-- updated_at maintenance (entities mark the column insertable/updatable=false;
-- mirrors the V397 booking trigger precedent). One shared function for both tables.
CREATE OR REPLACE FUNCTION update_mentor_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = CURRENT_TIMESTAMP;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_mentor_updated_at ON mentor;
CREATE TRIGGER trigger_update_mentor_updated_at
    BEFORE UPDATE ON mentor
    FOR EACH ROW EXECUTE FUNCTION update_mentor_updated_at();

DROP TRIGGER IF EXISTS trigger_update_mentor_student_assignment_updated_at ON mentor_student_assignment;
CREATE TRIGGER trigger_update_mentor_student_assignment_updated_at
    BEFORE UPDATE ON mentor_student_assignment
    FOR EACH ROW EXECUTE FUNCTION update_mentor_updated_at();
