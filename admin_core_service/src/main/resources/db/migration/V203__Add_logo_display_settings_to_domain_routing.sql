-- White-label logo display settings, per portal.
--
-- hide_institute_name: when true, the institute name is hidden wherever the
--                     logo is rendered (login page and sidebar). Default NULL
--                     keeps the existing behavior (name visible).
-- logo_width_px      : optional pixel override for logo width.
-- logo_height_px     : optional pixel override for logo height.
ALTER TABLE public.institute_domain_routing
    ADD COLUMN IF NOT EXISTS hide_institute_name bool;
ALTER TABLE public.institute_domain_routing
    ADD COLUMN IF NOT EXISTS logo_width_px integer;
ALTER TABLE public.institute_domain_routing
    ADD COLUMN IF NOT EXISTS logo_height_px integer;
