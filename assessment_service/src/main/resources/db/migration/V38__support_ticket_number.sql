-- Human-facing ticket numbers (VAC-001, VAC-002, … VAC-999, VAC-1000).
--
-- Until now the only reference was the first 8 characters of the ticket UUID, which meant nothing
-- to a customer and could not be quoted back over the phone. This adds a single global running
-- number in the ServiceNow/Zendesk style, zero-padded to three digits and growing naturally.

ALTER TABLE public.support_ticket ADD COLUMN IF NOT EXISTS ticket_number varchar(32) NULL;

-- A real sequence rather than a counter column: nextval is atomic and lock-free, so two tickets
-- created at the same instant can never collide. Sequences do not roll back, so a failed insert
-- burns a number — gaps are expected and harmless for a reference.
CREATE SEQUENCE IF NOT EXISTS public.support_ticket_number_seq START 1;

-- Backfill every existing ticket in creation order, so the oldest issue is VAC-001 and the
-- numbering reads chronologically rather than by UUID.
WITH numbered AS (
    SELECT id, row_number() OVER (ORDER BY created_at, id) AS rn
      FROM public.support_ticket
     WHERE ticket_number IS NULL
)
-- NOT LPAD: Postgres truncates when the value is longer than the width, so LPAD('1000',3,'0')
-- returns '100' and ticket 1000 would collide with ticket 100. (to_char(1000,'FM000') is worse —
-- it yields '###'.) Pad below 1000, pass through unchanged above it.
UPDATE public.support_ticket t
   SET ticket_number = 'VAC-' || CASE WHEN n.rn < 1000
                                      THEN LPAD(n.rn::text, 3, '0')
                                      ELSE n.rn::text END
  FROM numbered n
 WHERE t.id = n.id;

-- Park the sequence just past the backfilled rows. is_called=false means the next nextval()
-- returns exactly this value, so an empty table starts at 1 rather than skipping it.
SELECT setval('public.support_ticket_number_seq',
              COALESCE((SELECT count(*) FROM public.support_ticket), 0) + 1,
              false);

-- Unique so a duplicate can never be issued silently; the partial predicate keeps it valid while
-- any row is still unnumbered.
CREATE UNIQUE INDEX IF NOT EXISTS ux_support_ticket_number
    ON public.support_ticket (ticket_number)
    WHERE ticket_number IS NOT NULL;
