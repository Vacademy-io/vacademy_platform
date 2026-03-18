-- Create the platform super admin user (root user).
-- Username: superadmin
-- Password: VacademyAdmin@2024  (BCrypt-hashed below)
--
-- This user is NOT tied to any real institute. The PLATFORM institute
-- (00000000-0000-0000-0000-000000000001) is a system marker so the
-- institute-centric auth flow works.

-- 1. Ensure the ADMIN role exists (it may already be seeded by the app)
INSERT INTO roles (id, role_name, created_at, updated_at)
VALUES (gen_random_uuid()::TEXT, 'ADMIN', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (role_name) DO NOTHING;

-- 2. Insert the super admin user
INSERT INTO users (id, username, email, password_hash, full_name, is_root_user, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000002',
    'superadmin',
    'superadmin@vacademy.io',
    '$2a$10$L9myw4nm.iCRl3LOcg7Kdu8/0q8fB55v.GidwH2DaZFy0FmARuBiC',
    'Super Admin',
    true,
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;

-- 3. Link user to the PLATFORM institute with ADMIN role
INSERT INTO user_role (id, user_id, role_id, institute_id, status, created_at, updated_at)
SELECT
    gen_random_uuid()::TEXT,
    '00000000-0000-0000-0000-000000000002',
    r.id,
    '00000000-0000-0000-0000-000000000001',
    'ACTIVE',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
FROM roles r
WHERE r.role_name = 'ADMIN'
ON CONFLICT DO NOTHING;
