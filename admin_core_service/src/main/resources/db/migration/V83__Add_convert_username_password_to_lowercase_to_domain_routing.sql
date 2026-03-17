ALTER TABLE public.institute_domain_routing ADD COLUMN IF NOT EXISTS convert_username_password_to_lowercase bool NOT NULL DEFAULT false;

