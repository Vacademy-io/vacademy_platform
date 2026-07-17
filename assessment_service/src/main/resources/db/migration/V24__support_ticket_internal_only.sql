-- Internal-only support tickets: work the support team tracks on an institute's behalf that the
-- institute must never see (internal follow-ups, infra chores, notes-to-self on a client account).
-- Institute-facing reads filter these out entirely; the super-admin console still sees them.
-- Named internal_only (not "internal") to avoid colliding with Postgres's `internal` pseudo-type.
ALTER TABLE public.support_ticket
    ADD COLUMN IF NOT EXISTS internal_only boolean NOT NULL DEFAULT false;

-- The institute-facing list/count always filters on (institute_id, internal_only).
CREATE INDEX IF NOT EXISTS idx_support_ticket_institute_internal
    ON public.support_ticket (institute_id, internal_only);
