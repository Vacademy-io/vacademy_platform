-- Link a quote to the demo workspace it produced.
--
-- The institute already carries source_quote_id (admin_core V411); this is the other direction,
-- so the Quotes tab can show "demo created, expires on X" without querying admin_core.

ALTER TABLE public.pricing_quote ADD COLUMN IF NOT EXISTS provisioned_institute_id varchar(255) NULL;
ALTER TABLE public.pricing_quote ADD COLUMN IF NOT EXISTS provisioned_at timestamp NULL;
ALTER TABLE public.pricing_quote ADD COLUMN IF NOT EXISTS demo_expires_at timestamp NULL;

CREATE INDEX IF NOT EXISTS idx_pricing_quote_provisioned
    ON public.pricing_quote (provisioned_institute_id) WHERE provisioned_institute_id IS NOT NULL;
