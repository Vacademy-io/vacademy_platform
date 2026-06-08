-- =============================================================================
-- V13: parent_user_id on user_organization_team_mapping.
--
-- Captures the user-to-user reporting line INSIDE a team. The hybrid model:
--   organization_team               = the team (flat — no sub-teams).
--   user_organization_team_mapping  = one row per (user, team). The row also
--                                     carries parent_user_id — who this user
--                                     reports to inside that team.
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

ALTER TABLE user_organization_team_mapping
    ADD COLUMN IF NOT EXISTS parent_user_id VARCHAR(255);

-- FK is optional/best-effort — parent_user_id points at users.id but we
-- don't enforce CASCADE because removing a user is a cross-service event;
-- the service layer handles re-parenting children to NULL on deletes.
ALTER TABLE user_organization_team_mapping
    ADD CONSTRAINT fk_user_org_mapping_parent_user
    FOREIGN KEY (parent_user_id) REFERENCES users(id) ON DELETE SET NULL;

-- Powers the per-team reporting tree walk and the "who reports to X in
-- team Y" lookup used by every chart render and by the workbench scope
-- queries. Partial — we only index ACTIVE rows since dropped memberships
-- shouldn't influence the live tree.
CREATE INDEX IF NOT EXISTS idx_user_org_mapping_team_parent_user
    ON user_organization_team_mapping(team_id, parent_user_id)
    WHERE status = 'ACTIVE';

-- Cycle guard for parent chains is enforced at the service layer (CTE on
-- read + check on write), so no constraint here. The trade-off is keeping
-- the column simple and not blocking the migration on existing data.
