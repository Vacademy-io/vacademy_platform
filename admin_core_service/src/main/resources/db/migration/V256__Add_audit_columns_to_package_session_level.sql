-- Adds created_by_user_id / updated_by_user_id to course-domain tables and ensures
-- created_at / updated_at exist with safe defaults so existing rows remain valid
-- after Hibernate switches to managing these timestamps via @CreationTimestamp /
-- @UpdateTimestamp.

-- ===== package =====
ALTER TABLE package
    ADD COLUMN IF NOT EXISTS updated_by_user_id VARCHAR(255);

-- created_at / updated_at already exist on package; ensure defaults so legacy
-- rows and any rows inserted by paths that bypass Hibernate keep working.
ALTER TABLE package
    ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE package
    ALTER COLUMN updated_at SET DEFAULT now();

-- ===== session =====
ALTER TABLE session
    ADD COLUMN IF NOT EXISTS created_by_user_id VARCHAR(255);
ALTER TABLE session
    ADD COLUMN IF NOT EXISTS updated_by_user_id VARCHAR(255);
ALTER TABLE session
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT now();
ALTER TABLE session
    ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP DEFAULT now();

-- ===== level =====
ALTER TABLE level
    ADD COLUMN IF NOT EXISTS created_by_user_id VARCHAR(255);
ALTER TABLE level
    ADD COLUMN IF NOT EXISTS updated_by_user_id VARCHAR(255);

ALTER TABLE level
    ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE level
    ALTER COLUMN updated_at SET DEFAULT now();

-- ===== package_session =====
ALTER TABLE package_session
    ADD COLUMN IF NOT EXISTS created_by_user_id VARCHAR(255);
ALTER TABLE package_session
    ADD COLUMN IF NOT EXISTS updated_by_user_id VARCHAR(255);

ALTER TABLE package_session
    ALTER COLUMN created_at SET DEFAULT now();
ALTER TABLE package_session
    ALTER COLUMN updated_at SET DEFAULT now();
