-- Self-service "Guides" for the super-admin portal (health-check): the team uploads an HTML
-- walkthrough + fills in its details (title, which pages it applies to) instead of editing code.
CREATE TABLE IF NOT EXISTS public.portal_guide (
    id varchar(255) PRIMARY KEY,
    title varchar(500) NOT NULL,
    file_id varchar(255),
    file_url varchar(2048) NOT NULL,
    -- jsonb array of pathname prefixes (e.g. ["/support", "/onboarding"]) this guide applies to.
    routes jsonb NOT NULL,
    active boolean NOT NULL DEFAULT true,
    created_at timestamp NOT NULL DEFAULT now(),
    updated_at timestamp NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_portal_guide_active ON public.portal_guide (active);
