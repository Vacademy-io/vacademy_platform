-- Denormalized pointer to the linked guardian (auth_service.users.id), kept
-- in sync by ParentLinkService on every successful link (assignment-time
-- link, link-new-guardian, and backfill). Source of truth for the actual
-- relationship remains auth_service.users.linked_parent_id — this column
-- exists purely so admin_core_service can answer "which students in this
-- institute still need a guardian?" (the backfill preview) and show a
-- guardian-linked indicator without a cross-service call per student.
ALTER TABLE student ADD COLUMN IF NOT EXISTS guardian_user_id VARCHAR(255) NULL;

-- Powers the backfill preview: "give me every enrolled student in this
-- institute with guardian_user_id IS NULL".
CREATE INDEX IF NOT EXISTS idx_student_guardian_user_id
    ON student (guardian_user_id);
