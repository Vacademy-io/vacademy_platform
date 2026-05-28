-- Make assignment-slide submission windows timezone-aware so admins and
-- learners in different timezones see/enforce the same actual moment.
--
-- live_date / end_date: DATE -> TIMESTAMPTZ.
-- Legacy date-only rows have no time-of-day context, so we interpret them
-- as wall-clock IST (Asia/Kolkata, the institute zone for the vast majority
-- of existing data) and let PostgreSQL convert to UTC for storage:
--   * live_date  -> 00:00:00 IST  (start-of-day)
--   * end_date   -> 23:59:59 IST  (end-of-day, so assignments due "today"
--                                  don't snap closed at IST midnight)
-- New writes from the admin form use proper ISO-with-Z timestamps so the
-- backfill semantics only matter for pre-deploy rows.
ALTER TABLE public.assignment_slide
    ALTER COLUMN live_date TYPE TIMESTAMPTZ
    USING (live_date::timestamp AT TIME ZONE 'Asia/Kolkata');
ALTER TABLE public.assignment_slide
    ALTER COLUMN end_date TYPE TIMESTAMPTZ
    USING (
        (end_date::timestamp + INTERVAL '23 hours 59 minutes 59 seconds')
        AT TIME ZONE 'Asia/Kolkata'
    );

-- Flag for submissions that arrived after end_date (soft-warning model:
-- backend accepts the submission and stamps it as late rather than rejecting).
ALTER TABLE public.assignment_slide_tracked
    ADD COLUMN IF NOT EXISTS late_submission BOOLEAN NOT NULL DEFAULT FALSE;
