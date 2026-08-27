-- Stop two people booking the same host at the same moment.
--
-- Booking creation validates the slot and then inserts:
--
--     if (!bookingSlotService.isSlotAvailable(page, slotStart, duration)) throw ...
--     ... meetingBookingService.createBooking(...)
--
-- Between those two steps another request can pass the same check, so two
-- simultaneous bookings for one mentor slot could both succeed. Slot generation
-- already subtracts busy ranges, which is why this is rare — but it is a real race,
-- and the only reliable arbiter is the database.
--
-- One live booking per (host, exact start). Cancelled and rescheduled rows are
-- excluded so a freed slot can be re-booked, which is the existing behaviour.
-- The application catches the violation and returns the same
-- "This slot is no longer available" message the pre-check produces, so the loser
-- of a race sees a normal message rather than an error.
--
-- NOTE: this indexes exact start equality, not overlap. Postgres cannot express
-- "no overlapping ranges" as a plain unique index (that needs an exclusion
-- constraint over a range type, which would mean a schema change to how start/end
-- are stored). Exact-start collision is the case the booking UI can actually
-- produce, since invitees pick from generated slots rather than arbitrary times.

DO $$
DECLARE
    conflict_count INTEGER;
BEGIN
    -- Existing duplicates would make CREATE UNIQUE INDEX fail and take the whole
    -- deploy down. Check first: create the index when the data is clean, and warn
    -- loudly when it isn't, so the migration stays forward-compatible either way.
    SELECT COUNT(*) INTO conflict_count
    FROM (
        SELECT host_user_id, scheduled_start_utc
        FROM booking_instance
        WHERE status NOT IN ('CANCELLED', 'RESCHEDULED')
          AND host_user_id IS NOT NULL
          AND scheduled_start_utc IS NOT NULL
        GROUP BY host_user_id, scheduled_start_utc
        HAVING COUNT(*) > 1
    ) duplicates;

    IF conflict_count = 0 THEN
        CREATE UNIQUE INDEX IF NOT EXISTS uq_booking_host_slot
            ON booking_instance (host_user_id, scheduled_start_utc)
            WHERE status NOT IN ('CANCELLED', 'RESCHEDULED');
        RAISE NOTICE 'uq_booking_host_slot created — double-booking is now prevented at the database.';
    ELSE
        RAISE WARNING 'uq_booking_host_slot NOT created: % host/start combinations already have more than one live booking. Resolve those rows (cancel the duplicates), then re-run this index creation manually.', conflict_count;
    END IF;
END $$;
