-- =============================================================================
-- V13: Rename user_organization_team_mapping → organization_team_member
--      and add parent_user_id (user-to-user reporting line within a team).
--
-- The "_mapping" suffix was leftover from when each row was just a link
-- between a user and a team. The hybrid model has the row carry semantic
-- content too (reporting line, label), so "organization_team_member" matches
-- both the partner table organization_team and what a row actually is:
-- a member of a team.
--
-- The hybrid model after this migration:
--   organization_team           = the team (flat — no sub-teams).
--   organization_team_member    = one row per (user, team). The row also
--                                 carries parent_user_id — who this user
--                                 reports to inside that team.
--
-- A user can have many rows (multi-team membership). parent_user_id can be
-- NULL = "top of this team" (no manager). The same user can have different
-- managers in different teams.
--
-- role_name and is_team_head columns stay in the schema but are no longer
-- read/written by the application code:
--   role_name      → resolved fresh from the user's auth record per render.
--   is_team_head   → derived: head of team = parent_user_id IS NULL.
-- =============================================================================


-- 1. Rename the table. Postgres keeps existing indexes and constraints
--    pointing at the renamed table; we rename those individually below so
--    their names don't lie about which table they belong to.
ALTER TABLE user_organization_team_mapping
    RENAME TO organization_team_member;


-- 2. Rename FK constraints from V12 to match the new table name.
ALTER TABLE organization_team_member
    RENAME CONSTRAINT fk_user_org_team_mapping_team TO fk_org_team_member_team;

ALTER TABLE organization_team_member
    RENAME CONSTRAINT fk_user_org_team_mapping_user TO fk_org_team_member_user;


-- 3. Rename indexes from V12 to match the new table name.
ALTER INDEX idx_user_org_team_mapping_team_status
    RENAME TO idx_org_team_member_team_status;

ALTER INDEX idx_user_org_team_mapping_user_status
    RENAME TO idx_org_team_member_user_status;

ALTER INDEX uk_user_org_team_mapping_one_head
    RENAME TO uk_org_team_member_one_head;

ALTER INDEX uk_user_org_team_mapping_user_team_role
    RENAME TO uk_org_team_member_user_team_role;


-- 4. Add parent_user_id — the user-to-user reporting line inside a team.
ALTER TABLE organization_team_member
    ADD COLUMN IF NOT EXISTS parent_user_id VARCHAR(255);

-- FK is best-effort — parent_user_id points at users.id but we don't enforce
-- CASCADE because removing a user is a cross-service event; the service
-- layer handles re-parenting children to NULL on deletes.
ALTER TABLE organization_team_member
    ADD CONSTRAINT fk_org_team_member_parent_user
    FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Powers the per-team reporting tree walk and the "who reports to X in
-- team Y" lookup used by every chart render and by the workbench scope
-- queries. Partial — we only index ACTIVE rows since dropped memberships
-- shouldn't influence the live tree.
CREATE INDEX IF NOT EXISTS idx_org_team_member_team_parent_user
    ON organization_team_member(team_id, parent_user_id)
    WHERE status = 'ACTIVE';

-- Cycle guard for parent chains is enforced at the service layer (CTE on
-- read + check on write), so no constraint here. The trade-off is keeping
-- the column simple and not blocking the migration on existing data.
