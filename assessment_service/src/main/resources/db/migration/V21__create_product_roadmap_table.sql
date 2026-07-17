-- Single-row product roadmap: super-admin pastes/edits raw HTML in health-check, and every
-- admin-dashboard user sees it (with a "new" indicator) via the right rail's Roadmap viewer.
CREATE TABLE IF NOT EXISTS public.product_roadmap (
    id varchar(50) PRIMARY KEY,
    html_content text NOT NULL,
    updated_at timestamp NOT NULL DEFAULT now()
);
