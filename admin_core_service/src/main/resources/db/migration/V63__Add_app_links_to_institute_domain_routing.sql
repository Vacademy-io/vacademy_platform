ALTER TABLE public.institute_domain_routing ADD COLUMN IF NOT EXISTS play_store_app_link varchar(500) NULL;
ALTER TABLE public.institute_domain_routing ADD COLUMN IF NOT EXISTS app_store_app_link varchar(500) NULL;
ALTER TABLE public.institute_domain_routing ADD COLUMN IF NOT EXISTS windows_app_link varchar(500) NULL;
ALTER TABLE public.institute_domain_routing ADD COLUMN IF NOT EXISTS mac_app_link varchar(500) NULL;
