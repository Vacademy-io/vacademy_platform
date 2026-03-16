-- V161: Add B2B sub-org subscription support
-- 1. Add sub_org_id to enroll_invite table
ALTER TABLE enroll_invite ADD COLUMN IF NOT EXISTS sub_org_id VARCHAR(255);
ALTER TABLE enroll_invite ADD CONSTRAINT fk_enroll_invite_sub_org
    FOREIGN KEY (sub_org_id) REFERENCES institute(id);
CREATE INDEX IF NOT EXISTS idx_enroll_invite_sub_org_id ON enroll_invite(sub_org_id);

-- 2. Create student_sub_org junction table (many-to-many student <-> sub-org)
CREATE TABLE IF NOT EXISTS student_sub_org (
    id VARCHAR(255) PRIMARY KEY DEFAULT gen_random_uuid(),
    student_id VARCHAR(255) NOT NULL,
    user_id VARCHAR(255) NOT NULL,
    sub_org_id VARCHAR(255) NOT NULL,
    link_type VARCHAR(50) NOT NULL DEFAULT 'DIRECT',
    status VARCHAR(50) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT fk_student_sub_org_student FOREIGN KEY (student_id) REFERENCES student(id),
    CONSTRAINT fk_student_sub_org_institute FOREIGN KEY (sub_org_id) REFERENCES institute(id),
    CONSTRAINT uq_student_sub_org_user_suborg UNIQUE (user_id, sub_org_id)
);
CREATE INDEX IF NOT EXISTS idx_student_sub_org_user ON student_sub_org(user_id);
CREATE INDEX IF NOT EXISTS idx_student_sub_org_sub_org ON student_sub_org(sub_org_id);
