-- Support / help-desk tables.
-- Served by community-service (feature/support) but, like status_incident, they live in the
-- shared assessment_service DB whose schema is owned by assessment-service's Flyway.
-- NOTE: if a rebase introduces another V14, renumber this file to the next free version.

-- Per-institute support configuration: which plan they're on + optional alert-email override.
-- Absence of a row means the institute is on the default plan (PREMIUM), resolved in code.
CREATE TABLE IF NOT EXISTS public.institute_support_config (
    id            varchar(255) PRIMARY KEY,
    institute_id  varchar(255) NOT NULL UNIQUE,
    plan          varchar(50)  NOT NULL DEFAULT 'PREMIUM',   -- DEDICATED|PREMIUM|AVERAGE|LOW|NONE
    alert_emails  jsonb        NULL,                          -- ["ops@inst.com", ...] override list
    created_at    timestamp    DEFAULT CURRENT_TIMESTAMP,
    updated_at    timestamp    DEFAULT CURRENT_TIMESTAMP
);

-- Internal support staff that our super-admins can assign to institutes / tickets.
CREATE TABLE IF NOT EXISTS public.support_engineer (
    id          varchar(255) PRIMARY KEY,
    name        varchar(255) NOT NULL,
    email       varchar(255) NOT NULL,
    user_id     varchar(255) NULL,                            -- optional link to an auth user
    active      boolean      NOT NULL DEFAULT true,
    created_at  timestamp    DEFAULT CURRENT_TIMESTAMP,
    updated_at  timestamp    DEFAULT CURRENT_TIMESTAMP
);

-- Dedicated-engineer assignments (an institute on the Dedicated plan gets one or more).
CREATE TABLE IF NOT EXISTS public.institute_engineer_assignment (
    id            varchar(255) PRIMARY KEY,
    institute_id  varchar(255) NOT NULL,
    engineer_id   varchar(255) NOT NULL,
    is_primary    boolean      NOT NULL DEFAULT false,
    created_at    timestamp    DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_institute_engineer UNIQUE (institute_id, engineer_id)
);
CREATE INDEX IF NOT EXISTS idx_iea_institute ON public.institute_engineer_assignment (institute_id);

-- A support ticket == one conversation/issue raised by an institute.
CREATE TABLE IF NOT EXISTS public.support_ticket (
    id                     varchar(255) PRIMARY KEY,
    institute_id           varchar(255) NOT NULL,
    institute_name         varchar(500) NULL,
    raised_by_user_id      varchar(255) NULL,
    raised_by_name         varchar(255) NULL,
    raised_by_email        varchar(255) NULL,
    raised_by_role         varchar(50)  NULL,                 -- ADMIN | LEARNER (future)
    subject                varchar(500) NOT NULL,
    category               varchar(50)  NOT NULL DEFAULT 'QUESTION',  -- BUG|QUESTION|BILLING|FEATURE_REQUEST|OTHER
    priority               varchar(50)  NOT NULL DEFAULT 'MINOR',     -- MAJOR|MINOR
    status                 varchar(50)  NOT NULL DEFAULT 'OPEN',      -- OPEN|IN_PROGRESS|WAITING_ON_CUSTOMER|RESOLVED|CLOSED
    plan_at_creation       varchar(50)  NULL,                 -- snapshot of the plan when raised
    assigned_engineer_id   varchar(255) NULL,
    first_response_due_at  timestamp    NULL,                 -- created_at + plan SLA for the priority
    first_responded_at     timestamp    NULL,                 -- first SUPPORT reply
    resolved_at            timestamp    NULL,
    last_message_at        timestamp    NULL,
    message_count          int          NOT NULL DEFAULT 0,
    client_context         jsonb        NULL,                 -- auto-captured browser/device + server-side IP (support-only)
    created_at             timestamp    DEFAULT CURRENT_TIMESTAMP,
    updated_at             timestamp    DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_support_ticket_institute ON public.support_ticket (institute_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_status    ON public.support_ticket (status);
CREATE INDEX IF NOT EXISTS idx_support_ticket_assigned  ON public.support_ticket (assigned_engineer_id);
CREATE INDEX IF NOT EXISTS idx_support_ticket_last_msg  ON public.support_ticket (last_message_at DESC);

-- Individual messages in a ticket's thread (customer + support + system notes).
CREATE TABLE IF NOT EXISTS public.support_ticket_message (
    id              varchar(255) PRIMARY KEY,
    ticket_id       varchar(255) NOT NULL,
    sender_type     varchar(50)  NOT NULL,            -- CUSTOMER | SUPPORT | SYSTEM
    sender_user_id  varchar(255) NULL,
    sender_name     varchar(255) NULL,
    body            text         NOT NULL,
    attachments     jsonb        NULL,                -- [{fileId,fileName,url}]
    internal_note   boolean      NOT NULL DEFAULT false,   -- SUPPORT-only note, hidden from customer
    created_at      timestamp    DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_support_msg_ticket ON public.support_ticket_message (ticket_id, created_at);

-- Single-row global settings (super-admin alert-email recipients).
CREATE TABLE IF NOT EXISTS public.support_global_settings (
    id            varchar(255) PRIMARY KEY,
    alert_emails  jsonb        NULL,                  -- ["support@vacademy.io", ...]
    updated_at    timestamp    DEFAULT CURRENT_TIMESTAMP
);
