package vacademy.io.admin_core_service.features.mentorship.enums;

/**
 * What actually happened in a booked mentor session, as recorded by the mentor.
 *
 * <p>Distinct from {@code booking_instance.status}, which tracks the appointment
 * (CONFIRMED / CANCELLED / RESCHEDULED). A session can be CONFIRMED and still have
 * been a NO_SHOW; the absence of a record means nobody has reviewed it yet.
 */
public enum SessionOutcome {
    COMPLETED,
    NO_SHOW
}
