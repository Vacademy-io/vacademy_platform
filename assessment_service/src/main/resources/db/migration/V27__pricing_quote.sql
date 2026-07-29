-- Pricing quotes built by the plan builder.
--
-- Three ways a quote is created:
--   ONBOARDING - the prospect came from /onboarding/<slug>; submission_id links the quote back to
--                the lead so the sales inbox shows requirements and price side by side.
--   STANDALONE - someone opened the public /pricing link cold; we capture name/email/phone first,
--                so it still lands here as a lead-shaped row, just without a submission.
--   INTERNAL   - a rep built it while logged in, possibly with overridden rates.
--
-- Lives in the assessment_service DB with the other onboarding tables (see V16), even though
-- community-service owns the code.

CREATE TABLE IF NOT EXISTS public.pricing_quote (
    id                  varchar(255) PRIMARY KEY,
    submission_id       varchar(255) NULL,              -- onboarding_submission.id when it came from the form
    source              varchar(30)  NOT NULL DEFAULT 'STANDALONE',
    status              varchar(30)  NOT NULL DEFAULT 'DRAFT',  -- DRAFT|SENT|AGREED|LOST

    contact_name        varchar(500) NULL,
    contact_email       varchar(500) NULL,
    contact_phone       varchar(100) NULL,
    organization_name   varchar(500) NULL,

    currency            varchar(3)   NOT NULL DEFAULT 'INR',    -- INR|USD
    bracket_code        varchar(30)  NOT NULL,                  -- B_100 … B_10000
    student_count       int          NOT NULL,
    billing_cycle       varchar(20)  NOT NULL DEFAULT 'ANNUAL', -- MONTHLY|HALF_YEARLY|ANNUAL

    selections          jsonb        NULL,   -- exactly what the user picked
    breakdown           jsonb        NULL,   -- computed line items, snapshotted at save time

    recurring_annual    numeric(14,2) NOT NULL DEFAULT 0,  -- list, before cycle adjustment
    cycle_adjustment    numeric(14,2) NOT NULL DEFAULT 0,  -- negative = discount, positive = monthly uplift
    one_time_total      numeric(14,2) NOT NULL DEFAULT 0,
    subtotal            numeric(14,2) NOT NULL DEFAULT 0,  -- ex-tax
    tax_amount          numeric(14,2) NOT NULL DEFAULT 0,
    total               numeric(14,2) NOT NULL DEFAULT 0,

    rate_card_version   varchar(20)  NULL,   -- so an old quote can be read back correctly
    notes               text         NULL,
    created_by_user_id  varchar(255) NULL,
    created_at          timestamp    DEFAULT CURRENT_TIMESTAMP,
    updated_at          timestamp    DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pricing_quote_submission ON public.pricing_quote (submission_id);
CREATE INDEX IF NOT EXISTS idx_pricing_quote_created    ON public.pricing_quote (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_pricing_quote_status     ON public.pricing_quote (status);
CREATE INDEX IF NOT EXISTS idx_pricing_quote_email      ON public.pricing_quote (contact_email);
