-- Double-book guard (Phase 4 hardening): at most one ACTIVE booking per
-- (booking_page, exact slot start). Cancelled/rescheduled bookings free the slot
-- for rebooking (they're excluded, matching findActiveOverlapping's semantics).
--
-- This closes the check-then-insert race a pure availability check can't: two
-- invitees picking the same slot in the same instant both pass isSlotAvailable,
-- but only one insert can win this unique index — the other's whole booking
-- transaction (live_session + schedule + instance) rolls back and the caller is
-- told to pick another time. booking_page_id IS NOT NULL so admin create-on-behalf
-- bookings without a page are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_instance_page_slot
    ON booking_instance (booking_page_id, scheduled_start_utc)
    WHERE status NOT IN ('CANCELLED', 'RESCHEDULED') AND booking_page_id IS NOT NULL;
