-- Super-admin-managed per-institute dashboard widgets.
-- Served by community-service (feature/dashboardwidget) but, like support_ticket / status_incident /
-- onboarding_*, they live in the shared assessment_service DB whose schema is owned by
-- assessment-service's Flyway.
-- NOTE: if a rebase introduces another V17, renumber this file to the next free version.
--
-- A super admin attaches widgets to a specific institute's admin dashboard from the health-check
-- portal. If an institute has no widgets, its dashboard is unchanged (purely additive). v1 types:
--   ONBOARDING_TRACKER - implementation milestones (status + ETA), two-way comment/confirm
--   INFO_CARD          - announcement / maintenance notice (severity, optional image + CTA)

-- ---------------------------------------------------------------------------
-- One row = one widget. Targeted at a single institute OR a lead-tag group.
-- payload is a type-specific jsonb blob so widget types can grow without a migration.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.institute_dashboard_widget (
    id              varchar(255) PRIMARY KEY,
    widget_type     varchar(50)  NOT NULL,                     -- ONBOARDING_TRACKER|INFO_CARD
    target_type     varchar(30)  NOT NULL DEFAULT 'INSTITUTE', -- INSTITUTE|LEAD_TAG
    target_value    varchar(255) NOT NULL,                     -- instituteId  OR  lead tag (PROD|LEAD|TEST|FREE_TRIAL)
    visible_roles   jsonb        NULL,                         -- ["ADMIN"]; NULL/empty => ADMIN only
    title           varchar(500) NOT NULL,
    payload         jsonb        NULL,                         -- type-specific (milestones[] | info card body)
    status          varchar(30)  NOT NULL DEFAULT 'DRAFT',     -- DRAFT|PUBLISHED|ARCHIVED
    position        int          NOT NULL DEFAULT 0,
    starts_at       timestamp    NULL,                         -- reserved (v1 unused, no auto-expiry yet)
    ends_at         timestamp    NULL,                         -- reserved (v1 unused)
    created_by      varchar(255) NULL,
    created_at      timestamp    DEFAULT CURRENT_TIMESTAMP,
    updated_at      timestamp    DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_inst_widget_target ON public.institute_dashboard_widget (target_type, target_value, status);
CREATE INDEX IF NOT EXISTS idx_inst_widget_type   ON public.institute_dashboard_widget (widget_type);

-- ---------------------------------------------------------------------------
-- Institute-side interactions on a widget: free-text comments and milestone
-- confirmations. milestone_id is set for milestone-scoped rows (onboarding tracker).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.institute_widget_interaction (
    id                varchar(255) PRIMARY KEY,
    widget_id         varchar(255) NOT NULL,
    milestone_id      varchar(255) NULL,                       -- onboarding milestone id, if scoped
    interaction_type  varchar(30)  NOT NULL,                   -- COMMENT|CONFIRM
    message           text         NULL,
    user_id           varchar(255) NOT NULL,
    user_name         varchar(500) NULL,
    institute_id      varchar(255) NOT NULL,                   -- denormalized for filtering/isolation
    created_at        timestamp    DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_widget_interaction_widget ON public.institute_widget_interaction (widget_id, created_at);
