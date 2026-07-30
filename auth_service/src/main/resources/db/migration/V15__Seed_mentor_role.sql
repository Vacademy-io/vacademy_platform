-- Mentorship feature: a dedicated MENTOR role.
-- roles.role_name is globally unique (uk_roles_name), and RoleService.addRolesToUser
-- resolves roles by name (findByNameIn), so ONE system-wide MENTOR role (institute_id
-- NULL) is enough for every institute — the per-institute scoping lives on the
-- user_role row created by add-user-roles, not on the role itself. Mirrors the
-- V9 ADMIN seed pattern (ON CONFLICT (role_name) DO NOTHING = idempotent).
INSERT INTO roles (id, role_name, created_at, updated_at)
VALUES (gen_random_uuid()::TEXT, 'MENTOR', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT (role_name) DO NOTHING;
