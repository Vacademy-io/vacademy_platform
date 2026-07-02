-- Public onboarding + demo-management tables.
-- Served by community-service (feature/onboarding) but, like support_ticket / status_incident,
-- they live in the shared assessment_service DB whose schema is owned by assessment-service's Flyway.
-- NOTE: if a rebase introduces another V16, renumber this file to the next free version.

-- ---------------------------------------------------------------------------
-- The four demo institutes a prospect can be dropped into. Editable from the
-- super-admin Demo tab; institute_id is fixed but names/credentials/URLs can change.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.onboarding_demo_account (
    id                  varchar(255) PRIMARY KEY,
    institute_type      varchar(50)  NOT NULL UNIQUE,   -- SCHOOL|DISTANCE_LEARNING|CORPORATE|UNIVERSITY
    institute_id        varchar(255) NOT NULL,          -- fixed real institute id
    display_name        varchar(500) NOT NULL,
    admin_username      varchar(255) NULL,
    admin_password      varchar(255) NULL,              -- shared throwaway demo cred
    learner_username    varchar(255) NULL,
    learner_password    varchar(255) NULL,              -- shared throwaway demo cred
    admin_portal_url    varchar(1000) NULL,             -- NULL => FE default base
    learner_portal_url  varchar(1000) NULL,
    is_active           boolean      NOT NULL DEFAULT true,
    sort_order          int          NOT NULL DEFAULT 0,
    created_at          timestamp    DEFAULT CURRENT_TIMESTAMP,
    updated_at          timestamp    DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- A generated onboarding link. The public form is rendered from this config.
--   GENERAL     - asks everything, prospect picks institute type at the end
--   CUSTOM      - super-admin chose which questions to show + prefilled known answers
--   DIRECT_DEMO - no questions, straight to the demo handoff (type may be forced)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.onboarding_link (
    id                      varchar(255) PRIMARY KEY,
    slug                    varchar(120) NOT NULL UNIQUE,      -- used in the public URL
    name                    varchar(500) NOT NULL,            -- internal label
    link_type               varchar(30)  NOT NULL DEFAULT 'GENERAL',
    visible_question_keys   jsonb        NULL,                 -- NULL/empty => all questions
    prefilled_values        jsonb        NULL,                 -- {questionKey: value} known answers, hidden
    forced_institute_type   varchar(50)  NULL,                 -- skip the institute-type question
    intro_heading           varchar(500) NULL,
    intro_subheading        varchar(1000) NULL,
    is_active               boolean      NOT NULL DEFAULT true,
    expires_at              timestamp    NULL,
    submission_count        int          NOT NULL DEFAULT 0,
    created_by_user_id      varchar(255) NULL,
    created_at              timestamp    DEFAULT CURRENT_TIMESTAMP,
    updated_at              timestamp    DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_onboarding_link_slug ON public.onboarding_link (slug);

-- ---------------------------------------------------------------------------
-- A completed onboarding form. Promoted columns power the list view; the full
-- answer set is kept as a generic jsonb blob so the question catalogue can grow
-- without a migration.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.onboarding_submission (
    id                   varchar(255) PRIMARY KEY,
    link_id              varchar(255) NULL,
    link_slug            varchar(120) NULL,
    link_type            varchar(30)  NULL,
    contact_name         varchar(500) NULL,
    contact_email        varchar(500) NULL,
    contact_phone        varchar(100) NULL,
    organization_name    varchar(500) NULL,
    role                 varchar(255) NULL,
    institute_type       varchar(50)  NULL,
    source               varchar(255) NULL,                    -- "how did you hear about us"
    features_of_interest jsonb        NULL,                    -- ["LIVE_CLASSES", ...]
    answers              jsonb        NULL,                    -- {questionKey: value} full payload
    demo_institute_id    varchar(255) NULL,                    -- which demo they were routed to
    status               varchar(30)  NOT NULL DEFAULT 'NEW',  -- NEW|VIEWED|CONTACTED|WON|LOST
    email_sent           boolean      NOT NULL DEFAULT false,
    referrer             varchar(1000) NULL,
    created_at           timestamp    DEFAULT CURRENT_TIMESTAMP,
    updated_at           timestamp    DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_onboarding_submission_created ON public.onboarding_submission (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_onboarding_submission_status  ON public.onboarding_submission (status);
CREATE INDEX IF NOT EXISTS idx_onboarding_submission_type    ON public.onboarding_submission (institute_type);

-- ---------------------------------------------------------------------------
-- Editable list of super-admin team members notified on each new submission.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.onboarding_notification_recipient (
    id          varchar(255) PRIMARY KEY,
    email       varchar(255) NOT NULL,
    name        varchar(255) NULL,
    is_active   boolean      NOT NULL DEFAULT true,
    created_at  timestamp    DEFAULT CURRENT_TIMESTAMP
);

-- ---------------------------------------------------------------------------
-- Seeds
-- ---------------------------------------------------------------------------

-- Four demo institutes (initial values; editable from the Demo tab).
INSERT INTO public.onboarding_demo_account
    (id, institute_type, institute_id, display_name, admin_username, admin_password, learner_username, learner_password, sort_order)
VALUES
    ('seed-demo-school',   'SCHOOL',            '3716991c-f83b-429b-9391-0aa7596b6b7e', 'School Demo',            'admin_school_demo',     'admin_26', 'vishal@vacademy.com', '4uJJOb5G', 1),
    ('seed-demo-distance', 'DISTANCE_LEARNING', '3be88465-0100-4a34-807b-c22c80c86b87', 'Distance Learning Demo', 'admin_distancelearning','admin_26', 'kabi1372',            '2oZVWe22', 2),
    ('seed-demo-corp',     'CORPORATE',         '81d3fbb6-50e2-461a-8763-34cf7067a1c7', 'Corporate Demo',         'admin_corporate',       'admin_26', 'Neerej@vacademy.com', 'GsoD8Uur', 3),
    ('seed-demo-univ',     'UNIVERSITY',        'eaed3e6e-4d74-4c6d-8714-30e54363ec96', 'University Demo',        'admin_univesity_demo',  'admin_26', 'sanjay@vacademy.com', 'iflqcwed', 4)
ON CONFLICT (institute_type) DO NOTHING;

-- A canonical "general" link that asks everything (visible_question_keys NULL => all).
INSERT INTO public.onboarding_link (id, slug, name, link_type, intro_heading, intro_subheading)
VALUES ('seed-link-general', 'general', 'General onboarding', 'GENERAL',
        'Welcome to Vacademy', 'Tell us a little about you and we''ll set up a live demo tailored to your needs.')
ON CONFLICT (slug) DO NOTHING;

-- Seed notification recipient.
INSERT INTO public.onboarding_notification_recipient (id, email, name)
VALUES ('seed-recipient-shreyash', 'shreyash@vidyayatan.com', 'Shreyash')
ON CONFLICT DO NOTHING;
