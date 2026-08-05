-- The super-admin support console gained a date-wise filter (created_at range) and a sort
-- selector, and its inbox/board now default to newest-activity-first. Previously the search
-- query had no ORDER BY at all, so nothing here was ever range-scanned or ordered on disk.

-- last_message_at already has idx_support_ticket_last_msg (V14). This adds the matching index
-- for the created_at range filter and the "newest created" sort.
CREATE INDEX IF NOT EXISTS idx_support_ticket_created_at
    ON public.support_ticket (created_at DESC);

-- The default sort is `last_message_at DESC`, and Postgres orders NULLs FIRST on a DESC sort —
-- so a single null would pin that ticket above every real conversation. Spring Data JPA cannot
-- fix this from the application side: QueryUtils applies a Sort's direction but drops its null
-- handling for @Query methods, so Sort.Order.nullsLast() is silently ignored.
--
-- Both ticket-creation paths have always set last_message_at, so this only touches rows that
-- predate that or were inserted by hand. Backfilling makes the column effectively non-null and
-- keeps the ordering correct without a query-level COALESCE.
UPDATE public.support_ticket
   SET last_message_at = COALESCE(created_at, CURRENT_TIMESTAMP)
 WHERE last_message_at IS NULL;
