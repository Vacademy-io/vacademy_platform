-- =============================================================================
-- V12: Organization teams + user-team membership.
--
-- Two new tables that live alongside users / user_role in auth_service,
-- because the relationships they capture are fundamentally about users:
--
--   organization_team             — hierarchical team graph (Sales > North > …)
--   user_organization_team_mapping — which users belong to which teams, with
--                                    a per-mapping role_label for the org chart
--
-- All hierarchy traversal (ancestors / descendants) goes through recursive
-- CTEs in the repository layer — no closure table, since org charts are
-- shallow (< 10 levels expected). The depth here is well-bounded so a CTE
-- on every read is cheap and avoids the write-amplification of a closure.
--
-- admin_core_service consumes these via HMAC-internal HTTP endpoints
-- (/auth-service/internal/organization-team/...), mirroring how it already
-- talks to auth_service for users, roles, and institute settings.
-- =============================================================================


-- 1. The team graph itself. parent_id = NULL marks a top-level vertical.
CREATE TABLE IF NOT EXISTS organization_team (
    id              VARCHAR(255) PRIMARY KEY,
    institute_id    VARCHAR(255) NOT NULL,
    parent_id       VARCHAR(255),
    name            VARCHAR(255) NOT NULL,
    description     TEXT,
    -- Convenience pointer to the user_organization_team_mapping row flagged
    -- is_team_head=true. Kept in sync by the service layer.
    head_user_id    VARCHAR(255),
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    sort_order      INTEGER NOT NULL DEFAULT 0,
    created_by      VARCHAR(255),
    created_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_organization_team_parent
        FOREIGN KEY (parent_id) REFERENCES organization_team(id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS idx_organization_team_institute_status
    ON organization_team(institute_id, status);

CREATE INDEX IF NOT EXISTS idx_organization_team_parent
    ON organization_team(parent_id);

-- Prevent duplicate sibling names within an institute. COALESCE so NULL
-- parent_id (root teams) also gets uniqueness enforcement.
CREATE UNIQUE INDEX IF NOT EXISTS uk_organization_team_institute_parent_name
    ON organization_team(institute_id, COALESCE(parent_id, ''), name)
    WHERE status = 'ACTIVE';


-- 2. User <-> Team membership. A user can belong to multiple teams and
-- carry a different role_label per team. STUDENT is forbidden at the
-- service layer (org charts are for non-student org members only).
CREATE TABLE IF NOT EXISTS user_organization_team_mapping (
    id              VARCHAR(255) PRIMARY KEY,
    team_id         VARCHAR(255) NOT NULL,
    user_id         VARCHAR(255) NOT NULL,
    role_name       VARCHAR(100) NOT NULL,                       -- e.g. 'ADMIN', 'TEACHER', 'COUNSELLOR'
    role_label      VARCHAR(100),                                -- per-mapping UI label, e.g. 'Org Head'
    is_team_head    BOOLEAN NOT NULL DEFAULT FALSE,
    status          VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    added_by        VARCHAR(255),
    added_at        TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMP NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_user_org_team_mapping_team
        FOREIGN KEY (team_id) REFERENCES organization_team(id) ON DELETE CASCADE,
    CONSTRAINT fk_user_org_team_mapping_user
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_org_team_mapping_team_status
    ON user_organization_team_mapping(team_id, status);

CREATE INDEX IF NOT EXISTS idx_user_org_team_mapping_user_status
    ON user_organization_team_mapping(user_id, status);

-- One head per team (partial unique). Prevents accidental dual-head state.
CREATE UNIQUE INDEX IF NOT EXISTS uk_user_org_team_mapping_one_head
    ON user_organization_team_mapping(team_id)
    WHERE is_team_head = TRUE AND status = 'ACTIVE';

-- A user can only hold one ACTIVE mapping per (team, role_name).
CREATE UNIQUE INDEX IF NOT EXISTS uk_user_org_team_mapping_user_team_role
    ON user_organization_team_mapping(team_id, user_id, role_name)
    WHERE status = 'ACTIVE';
