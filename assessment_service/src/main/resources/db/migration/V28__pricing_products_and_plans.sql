-- Per-product pricing, admin-editable.
--
-- Replaces the hard-coded rate card: every product carries its own plans and its own pricing
-- model, so LMS can sell learner tiers while CRM sells seats and Meet sells usage. Adding a
-- new CRM tier later is an INSERT, not a deploy.
--
-- Products are now fully standalone: nothing is waived because of what you bought elsewhere.
-- The one exception is a declared dependency (requires_product_code), used by the parent app,
-- which is only sold alongside the LMS and mirrors whichever LMS tier was chosen.

CREATE TABLE IF NOT EXISTS public.pricing_product (
    id                    varchar(255) PRIMARY KEY,
    code                  varchar(50)  NOT NULL UNIQUE,   -- LMS, CRM, ANDROID …
    name                  varchar(255) NOT NULL,
    tagline               varchar(500) NULL,
    icon                  varchar(50)  NULL,              -- lucide icon name for the FE
    pricing_model         varchar(30)  NOT NULL,          -- see below
    -- PER_LEARNER_TIER : pick a plan; price = plan.price × plan.unit_count
    -- FLAT_ANNUAL      : pick a plan (or the only one); price = plan.price per year
    -- ONE_TIME         : price = plan.price, charged once
    -- SEAT_BASED       : base_price + max(0, seats - included_units) × unit_price, per year
    -- COUNT_BASED      : quantity × unit_price, per year
    -- USAGE            : quantity (per month) × unit_price × 12, per year
    base_price            numeric(14,2) NULL,             -- SEAT_BASED base
    unit_price            numeric(14,2) NULL,             -- SEAT_BASED / COUNT_BASED / USAGE
    included_units        int           NULL,             -- SEAT_BASED seats bundled into base
    unit_label            varchar(100)  NULL,             -- "team members", "sub-organizations"
    min_quantity          int           NOT NULL DEFAULT 1,
    requires_product_code varchar(50)   NULL,             -- only sellable alongside this product
    mirrors_product_code  varchar(50)   NULL,             -- tier follows that product's chosen plan
    sort_order            int           NOT NULL DEFAULT 0,
    is_active             boolean       NOT NULL DEFAULT true,
    created_at            timestamp     DEFAULT CURRENT_TIMESTAMP,
    updated_at            timestamp     DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS public.pricing_plan (
    id            varchar(255) PRIMARY KEY,
    product_code  varchar(50)  NOT NULL REFERENCES public.pricing_product (code) ON DELETE CASCADE,
    code          varchar(50)  NOT NULL,
    name          varchar(255) NOT NULL,
    description   varchar(500) NULL,
    unit_count    int          NULL,          -- learners this tier covers
    price         numeric(14,2) NOT NULL,     -- per unit for PER_LEARNER_TIER, else absolute
    is_popular    boolean      NOT NULL DEFAULT false,
    sort_order    int          NOT NULL DEFAULT 0,
    is_active     boolean      NOT NULL DEFAULT true,
    created_at    timestamp    DEFAULT CURRENT_TIMESTAMP,
    updated_at    timestamp    DEFAULT CURRENT_TIMESTAMP,
    UNIQUE (product_code, code)
);
CREATE INDEX IF NOT EXISTS idx_pricing_plan_product ON public.pricing_plan (product_code, sort_order);

-- What a plan does and doesn't get. Rendered as ticks and crosses under the plan picker.
CREATE TABLE IF NOT EXISTS public.pricing_plan_feature (
    id         varchar(255) PRIMARY KEY,
    plan_id    varchar(255) NOT NULL REFERENCES public.pricing_plan (id) ON DELETE CASCADE,
    label      varchar(500) NOT NULL,
    included   boolean      NOT NULL DEFAULT true,
    sort_order int          NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_pricing_plan_feature_plan ON public.pricing_plan_feature (plan_id, sort_order);

-- Global commercial terms (GST, cycle multipliers, FX). Editable without a deploy.
CREATE TABLE IF NOT EXISTS public.pricing_setting (
    key        varchar(100) PRIMARY KEY,
    value      varchar(255) NOT NULL,
    label      varchar(255) NULL,
    updated_at timestamp    DEFAULT CURRENT_TIMESTAMP
);

-- A quote is no longer anchored to one global bracket — the selections JSON carries each
-- product's chosen plan — so these two columns become optional.
ALTER TABLE public.pricing_quote ALTER COLUMN bracket_code  DROP NOT NULL;
ALTER TABLE public.pricing_quote ALTER COLUMN student_count DROP NOT NULL;

-- ---------------------------------------------------------------------------
-- Seed: the rate card as agreed on 2026-07-29
-- ---------------------------------------------------------------------------

INSERT INTO public.pricing_setting (key, value, label) VALUES
    ('gst_rate',            '0.18', 'GST rate applied to INR quotes'),
    ('usd_per_inr',         '0.01', 'Flat FX used for USD quotes'),
    ('cycle_monthly',       '1.20', 'Monthly billing multiplier'),
    ('cycle_half_yearly',   '1.00', 'Half-yearly billing multiplier'),
    ('cycle_annual',        '0.85', 'Annual-upfront billing multiplier'),
    ('rate_card_version',   '2026-07-v2', 'Stamped onto saved quotes')
ON CONFLICT (key) DO NOTHING;

INSERT INTO public.pricing_product
    (id, code, name, tagline, icon, pricing_model, base_price, unit_price, included_units,
     unit_label, min_quantity, requires_product_code, mirrors_product_code, sort_order)
VALUES
    ('prod-lms',       'LMS',        'LMS',                  'Courses, batches, exams and live classes', 'graduation-cap', 'PER_LEARNER_TIER', NULL,    NULL,   NULL, 'learners',           1, NULL,  NULL,  1),
    ('prod-crm',       'CRM',        'CRM',                  'Leads, pipeline and follow-ups',           'trending-up',    'SEAT_BASED',       32000,   2000,   10,   'team members',       1, NULL,  NULL,  2),
    ('prod-comms',     'COMMS',      'WhatsApp & payments',  'Broadcasts, notifications and fee collection', 'message-circle', 'FLAT_ANNUAL',  NULL,    NULL,   NULL, NULL,                 1, NULL,  NULL,  3),
    ('prod-android',   'ANDROID',    'Android app',          'Your brand on the Play Store',             'smartphone',     'ONE_TIME',         NULL,    NULL,   NULL, NULL,                 1, NULL,  NULL,  4),
    ('prod-ios',       'IOS',        'iOS app',              'Your brand on the App Store',              'smartphone',     'ONE_TIME',         NULL,    NULL,   NULL, NULL,                 1, NULL,  NULL,  5),
    ('prod-parent',    'PARENT_APP', 'Parent app',           'Keep parents in the loop',                 'users',          'PER_LEARNER_TIER', NULL,    NULL,   NULL, 'learners',           1, 'LMS', 'LMS', 6),
    ('prod-website',   'WEBSITE',    'Website builder',      'Your site and public course catalogue',    'globe',          'FLAT_ANNUAL',      NULL,    NULL,   NULL, NULL,                 1, NULL,  NULL,  7),
    ('prod-suborgs',   'SUB_ORGS',   'Sub-orgs & partners',  'Branches, franchisees and channel partners','building-2',    'COUNT_BASED',      NULL,    1800,   NULL, 'sub-organizations',  1, NULL,  NULL,  8),
    ('prod-meet',      'MEET',       'Vacademy Meet',        'Live classes without bringing your own Zoom','video',        'USAGE',            NULL,    64,     NULL, 'sessions per month', 1, NULL,  NULL,  9),
    ('prod-support',   'SUPPORT',    'Support',              'How quickly we respond when you need us',  'life-buoy',      'FLAT_ANNUAL',      NULL,    NULL,   NULL, NULL,                 1, NULL,  NULL, 10)
ON CONFLICT (code) DO NOTHING;

-- LMS tiers: price is per learner per year, unit_count is the learner cap.
INSERT INTO public.pricing_plan (id, product_code, code, name, description, unit_count, price, is_popular, sort_order) VALUES
    ('plan-lms-100',   'LMS', 'STARTER',    'Starter',    'Up to 100 learners',    100,   300, false, 1),
    ('plan-lms-300',   'LMS', 'GROWTH',     'Growth',     'Up to 300 learners',    300,   200, false, 2),
    ('plan-lms-500',   'LMS', 'SCALE',      'Scale',      'Up to 500 learners',    500,   200, true,  3),
    ('plan-lms-1000',  'LMS', 'PRO',        'Pro',        'Up to 1,000 learners',  1000,  180, false, 4),
    ('plan-lms-2000',  'LMS', 'PREMIER',    'Premier',    'Up to 2,000 learners',  2000,  150, false, 5),
    ('plan-lms-5000',  'LMS', 'ELITE',      'Elite',      'Up to 5,000 learners',  5000,  135, false, 6),
    ('plan-lms-10000', 'LMS', 'ENTERPRISE', 'Enterprise', 'Up to 10,000 learners', 10000, 105, false, 7)
ON CONFLICT (product_code, code) DO NOTHING;

-- Parent app mirrors the LMS tiers at a fifth of the rate.
INSERT INTO public.pricing_plan (id, product_code, code, name, description, unit_count, price, sort_order) VALUES
    ('plan-parent-100',   'PARENT_APP', 'STARTER',    'Starter',    'Up to 100 learners',    100,   60, 1),
    ('plan-parent-300',   'PARENT_APP', 'GROWTH',     'Growth',     'Up to 300 learners',    300,   40, 2),
    ('plan-parent-500',   'PARENT_APP', 'SCALE',      'Scale',      'Up to 500 learners',    500,   40, 3),
    ('plan-parent-1000',  'PARENT_APP', 'PRO',        'Pro',        'Up to 1,000 learners',  1000,  36, 4),
    ('plan-parent-2000',  'PARENT_APP', 'PREMIER',    'Premier',    'Up to 2,000 learners',  2000,  30, 5),
    ('plan-parent-5000',  'PARENT_APP', 'ELITE',      'Elite',      'Up to 5,000 learners',  5000,  27, 6),
    ('plan-parent-10000', 'PARENT_APP', 'ENTERPRISE', 'Enterprise', 'Up to 10,000 learners', 10000, 21, 7)
ON CONFLICT (product_code, code) DO NOTHING;

-- Single-plan products.
INSERT INTO public.pricing_plan (id, product_code, code, name, description, unit_count, price, sort_order) VALUES
    ('plan-crm-standard',  'CRM',      'STANDARD', 'CRM',              'Includes 10 team members',              NULL, 32000,  1),
    ('plan-comms-std',     'COMMS',    'STANDARD', 'WhatsApp & payments', 'Both integrations, per year',        NULL,  5000,  1),
    ('plan-android-std',   'ANDROID',  'STANDARD', 'Android app',      'One-time build and Play Store release', NULL,  8000,  1),
    ('plan-ios-std',       'IOS',      'STANDARD', 'iOS app',          'One-time build and App Store release',  NULL, 10000,  1),
    ('plan-website-std',   'WEBSITE',  'STANDARD', 'Website builder',  'Development and maintenance, per year', NULL,  5000,  1),
    ('plan-suborg-std',    'SUB_ORGS', 'STANDARD', 'Sub-organization', 'Per sub-org, per year',                 NULL,  1800,  1),
    ('plan-meet-std',      'MEET',     'STANDARD', 'Vacademy Meet',    'Per session-hour',                      NULL,    64,  1)
ON CONFLICT (product_code, code) DO NOTHING;

-- Support tiers.
INSERT INTO public.pricing_plan (id, product_code, code, name, description, unit_count, price, sort_order) VALUES
    ('plan-support-basic',     'SUPPORT', 'BASIC',     'Basic',     'Email support, standard response times', NULL,      0, 1),
    ('plan-support-premium',   'SUPPORT', 'PREMIUM',   'Premium',   'Priority queue and faster response',     NULL,  20000, 2),
    ('plan-support-dedicated', 'SUPPORT', 'DEDICATED', 'Dedicated', 'A named account manager, ₹15,000/month', NULL, 180000, 3)
ON CONFLICT (product_code, code) DO NOTHING;

-- What each LMS tier does and doesn't include.
INSERT INTO public.pricing_plan_feature (id, plan_id, label, included, sort_order) VALUES
    ('f-lms-100-1',   'plan-lms-100',   'Unlimited courses, batches and exams', true,  1),
    ('f-lms-100-2',   'plan-lms-100',   'Live classes with your own Zoom or Meet', true, 2),
    ('f-lms-100-3',   'plan-lms-100',   'Certificates', true, 3),
    ('f-lms-300-1',   'plan-lms-300',   'Everything in Starter', true, 1),
    ('f-lms-300-2',   'plan-lms-300',   'Lower per-learner rate', true, 2),
    ('f-lms-500-1',   'plan-lms-500',   'Everything in Growth', true, 1),
    ('f-lms-500-2',   'plan-lms-500',   'Priority onboarding', true, 2),
    ('f-lms-1000-1',  'plan-lms-1000',  'Everything in Scale', true, 1),
    ('f-lms-1000-2',  'plan-lms-1000',  'Lowest per-learner rate at this size', true, 2),
    ('f-lms-2000-1',  'plan-lms-2000',  'Everything in Pro', true, 1),
    ('f-lms-5000-1',  'plan-lms-5000',  'Everything in Premier', true, 1),
    ('f-lms-10000-1', 'plan-lms-10000', 'Everything in Elite', true, 1),
    ('f-lms-10000-2', 'plan-lms-10000', 'Custom feature development available', true, 2)
ON CONFLICT DO NOTHING;
