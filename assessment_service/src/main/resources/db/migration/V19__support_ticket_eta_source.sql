-- Support-team-authored tickets + a manually-set ETA.
--   eta    : optional expected-resolution timestamp the support team fills in (distinct from the
--             SLA-derived first_response_due_at); surfaced to the institute in their dashboard.
--   source : where the issue originated (PORTAL for client-raised; EMAIL/WHATSAPP/PHONE/MANUAL/OTHER
--             for tickets the support team logs on a client's behalf).
ALTER TABLE public.support_ticket ADD COLUMN IF NOT EXISTS eta timestamp NULL;
ALTER TABLE public.support_ticket ADD COLUMN IF NOT EXISTS source varchar(50) NULL;
