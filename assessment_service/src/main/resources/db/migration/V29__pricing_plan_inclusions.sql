-- What a plan bundles in for free.
--
-- Products stay independently sellable, but a plan can now waive the price of other products:
-- LMS Growth throws in the Android app, Pro throws in WhatsApp & payments, and so on. This is
-- the tiered bundling from the original rate card, expressed as data so it can be changed
-- without a deploy.
--
-- Semantics:
--   included_plan_code NULL  -> whichever plan of that product is chosen is free
--   included_plan_code set   -> only that plan is free (e.g. Premium support, but not Dedicated)
--   included_quantity  NULL  -> the whole product is free
--   included_quantity  set   -> that many units are free, extras are charged (e.g. 2 sub-orgs)

CREATE TABLE IF NOT EXISTS public.pricing_plan_inclusion (
    id                    varchar(255) PRIMARY KEY,
    plan_id               varchar(255) NOT NULL REFERENCES public.pricing_plan (id) ON DELETE CASCADE,
    included_product_code varchar(50)  NOT NULL,
    included_plan_code    varchar(50)  NULL,
    included_quantity     int          NULL,
    sort_order            int          NOT NULL DEFAULT 0,
    UNIQUE (plan_id, included_product_code)
);
CREATE INDEX IF NOT EXISTS idx_pricing_plan_inclusion_plan ON public.pricing_plan_inclusion (plan_id);

-- ---------------------------------------------------------------------------
-- Seed: the tiered bundling as originally agreed
--   Growth      -> Android
--   Scale       -> Android, iOS, website, premium support
--   Pro+        -> the above plus WhatsApp & payments, and a sub-org allowance (2/3/5/7)
-- ---------------------------------------------------------------------------

INSERT INTO public.pricing_plan_inclusion (id, plan_id, included_product_code, included_plan_code, included_quantity, sort_order) VALUES
    ('inc-growth-android',   'plan-lms-300',   'ANDROID',  NULL,      NULL, 1),

    ('inc-scale-android',    'plan-lms-500',   'ANDROID',  NULL,      NULL, 1),
    ('inc-scale-ios',        'plan-lms-500',   'IOS',      NULL,      NULL, 2),
    ('inc-scale-website',    'plan-lms-500',   'WEBSITE',  NULL,      NULL, 3),
    ('inc-scale-support',    'plan-lms-500',   'SUPPORT',  'PREMIUM', NULL, 4),

    ('inc-pro-android',      'plan-lms-1000',  'ANDROID',  NULL,      NULL, 1),
    ('inc-pro-ios',          'plan-lms-1000',  'IOS',      NULL,      NULL, 2),
    ('inc-pro-website',      'plan-lms-1000',  'WEBSITE',  NULL,      NULL, 3),
    ('inc-pro-support',      'plan-lms-1000',  'SUPPORT',  'PREMIUM', NULL, 4),
    ('inc-pro-comms',        'plan-lms-1000',  'COMMS',    NULL,      NULL, 5),
    ('inc-pro-suborgs',      'plan-lms-1000',  'SUB_ORGS', NULL,      2,    6),

    ('inc-premier-android',  'plan-lms-2000',  'ANDROID',  NULL,      NULL, 1),
    ('inc-premier-ios',      'plan-lms-2000',  'IOS',      NULL,      NULL, 2),
    ('inc-premier-website',  'plan-lms-2000',  'WEBSITE',  NULL,      NULL, 3),
    ('inc-premier-support',  'plan-lms-2000',  'SUPPORT',  'PREMIUM', NULL, 4),
    ('inc-premier-comms',    'plan-lms-2000',  'COMMS',    NULL,      NULL, 5),
    ('inc-premier-suborgs',  'plan-lms-2000',  'SUB_ORGS', NULL,      3,    6),

    ('inc-elite-android',    'plan-lms-5000',  'ANDROID',  NULL,      NULL, 1),
    ('inc-elite-ios',        'plan-lms-5000',  'IOS',      NULL,      NULL, 2),
    ('inc-elite-website',    'plan-lms-5000',  'WEBSITE',  NULL,      NULL, 3),
    ('inc-elite-support',    'plan-lms-5000',  'SUPPORT',  'PREMIUM', NULL, 4),
    ('inc-elite-comms',      'plan-lms-5000',  'COMMS',    NULL,      NULL, 5),
    ('inc-elite-suborgs',    'plan-lms-5000',  'SUB_ORGS', NULL,      5,    6),

    ('inc-ent-android',      'plan-lms-10000', 'ANDROID',  NULL,      NULL, 1),
    ('inc-ent-ios',          'plan-lms-10000', 'IOS',      NULL,      NULL, 2),
    ('inc-ent-website',      'plan-lms-10000', 'WEBSITE',  NULL,      NULL, 3),
    ('inc-ent-support',      'plan-lms-10000', 'SUPPORT',  'PREMIUM', NULL, 4),
    ('inc-ent-comms',        'plan-lms-10000', 'COMMS',    NULL,      NULL, 5),
    ('inc-ent-suborgs',      'plan-lms-10000', 'SUB_ORGS', NULL,      7,    6)
ON CONFLICT (plan_id, included_product_code) DO NOTHING;
