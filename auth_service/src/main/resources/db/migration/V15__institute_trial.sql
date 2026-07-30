-- Trial expiry, enforced at login.
--
-- auth_service and admin_core have separate databases, so auth cannot read institutes.demo_expires_at
-- directly. Provisioning writes the expiry here as well; this table is the ENFORCEMENT source of
-- truth, while institutes.demo_expires_at is the reporting/filtering copy. Extending a trial must
-- go through the provisioning service so both stay in step.

CREATE TABLE IF NOT EXISTS public.institute_trial (
    institute_id     varchar(255) PRIMARY KEY,
    expires_at       timestamp    NOT NULL,
    source_quote_id  varchar(255) NULL,
    created_by       varchar(255) NULL,
    created_at       timestamp    DEFAULT CURRENT_TIMESTAMP,
    updated_at       timestamp    DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_institute_trial_expires ON public.institute_trial (expires_at);
