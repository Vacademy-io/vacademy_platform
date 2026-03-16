-- Create a system-level PLATFORM institute for the super admin user.
-- This is NOT a real customer institute — it exists only so the root user
-- can authenticate through the institute-centric auth flow.

INSERT INTO institutes (id, name, email, type, created_at, updated_at)
VALUES (
    '00000000-0000-0000-0000-000000000001',
    'Vacademy Platform',
    'platform@vacademy.io',
    'PLATFORM',
    CURRENT_TIMESTAMP,
    CURRENT_TIMESTAMP
)
ON CONFLICT (id) DO NOTHING;
