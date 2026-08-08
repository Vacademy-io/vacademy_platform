-- Admin-configurable invoice number strategy.
--
-- Two problems with the old numbering, both fixed here:
--
--  1. `invoice_number` was GLOBALLY unique (invoice_invoice_number_key from V64),
--     but the counter was computed PER INSTITUTE (countByInstituteIdAndInvoiceDate).
--     Two institutes issuing on the same day both computed -0001 and the second was
--     silently bumped by a retry loop. Once institutes choose their own formats this
--     becomes routine, so uniqueness moves to (institute_id, invoice_number).
--
--  2. Allocation was `count(*) + 1` over a non-indexable `DATE(invoice_date)` predicate,
--     followed by a read-then-write existence loop — neither atomic nor cheap.
--
-- The counter lives ON THE INVOICE ROW rather than in a side table: the next number is
-- MAX(seq_no) + 1 for the (institute, window), and the unique constraint below is what
-- makes concurrent allocation safe — the INSERT itself is the arbiter, so nothing needs
-- to be reserved ahead of time. Two consequences worth knowing:
--   * no gaps: a number is only consumed if an invoice actually exists (a side-table
--     counter burns numbers when PDF generation fails afterwards);
--   * no drift: the counter IS the data, so it cannot disagree with the invoice list.

-- ================================================================================
-- 1. Per-invoice sequence position
-- ================================================================================
-- seq_scope_key encodes the window the counter resets on, and is self-distinguishing
-- by length so one column serves every scope:
--   'ALL'      -> never resets
--   '2026'     -> YEARLY
--   '202608'   -> MONTHLY
--   '20260805' -> DAILY
-- Both columns are NULL for every pre-existing invoice. That is intended: MAX() skips
-- them, so the first invoice in any window starts at 1 and the unique constraint below
-- catches the rare case where that collides with a legacy number.
ALTER TABLE invoice
    ADD COLUMN IF NOT EXISTS seq_no        BIGINT,
    ADD COLUMN IF NOT EXISTS seq_scope_key VARCHAR(32);

COMMENT ON COLUMN invoice.seq_no IS
    'Sequence position within seq_scope_key. Next number = MAX(seq_no)+1 for the institute + window. NULL for invoices issued before V432.';
COMMENT ON COLUMN invoice.seq_scope_key IS
    'ALL | YYYY | YYYYMM | YYYYMMDD - the reset window this number was allocated in.';

-- Serves the MAX(seq_no) allocation lookup; DESC so it is a single index-scan backwards.
CREATE INDEX IF NOT EXISTS idx_invoice_seq_allocation
    ON invoice (institute_id, seq_scope_key, seq_no DESC);

-- ================================================================================
-- 1b. Backfill existing invoices
-- ================================================================================
-- Without this every institute restarts at seq 1 on deploy day. The allocator would
-- then have to probe forward past all of today's already-issued numbers, and any
-- institute that has issued more than a couple of dozen invoices in the current
-- window would exhaust the probe limit and fall back to a random-suffix number.
--
-- Numbered per (institute, day) because DAILY is the legacy scope the hardcoded
-- INV-yyyyMMdd-NNNN generator used, so this reproduces the positions those numbers
-- already imply. Ordered by created_at (id as a tiebreaker) so the positions match
-- issue order.
WITH numbered AS (
    SELECT id,
           to_char(invoice_date, 'YYYYMMDD') AS scope_key,
           ROW_NUMBER() OVER (
               PARTITION BY institute_id, to_char(invoice_date, 'YYYYMMDD')
               ORDER BY created_at, id
           ) AS position
    FROM invoice
    WHERE invoice_date IS NOT NULL
      AND seq_no IS NULL
)
UPDATE invoice i
   SET seq_no        = n.position,
       seq_scope_key = n.scope_key
  FROM numbered n
 WHERE i.id = n.id;

-- ================================================================================
-- 2. invoice_number: unique PER INSTITUTE instead of globally
-- ================================================================================
-- This constraint is load-bearing, not just a safety net: it is what serialises two
-- concurrent allocations that compute the same MAX(seq_no)+1. The loser gets a unique
-- violation and retries with the next candidate.
--
-- Strictly weaker than the constraint it replaces, so it cannot fail on existing data
-- (today's numbers are already globally unique => no duplicate pairs exist).
--
-- NOTE: InvoiceRepository lookups by bare invoice_number had to go — post-V432 a bare
-- number can match several rows and would throw NonUniqueResultException.
ALTER TABLE invoice DROP CONSTRAINT IF EXISTS invoice_invoice_number_key;

DO $$
BEGIN
    ALTER TABLE invoice
        ADD CONSTRAINT uq_invoice_institute_number UNIQUE (institute_id, invoice_number);
EXCEPTION
    WHEN duplicate_table THEN NULL;   -- constraint already present (re-run)
    WHEN duplicate_object THEN NULL;
END $$;

-- idx_invoice_invoice_number (V64) is deliberately kept: lookups by bare invoice
-- number still exist and the new composite constraint's index cannot serve them.
