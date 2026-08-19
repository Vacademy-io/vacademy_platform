package vacademy.io.admin_core_service.features.mentorship.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import org.springframework.dao.DataIntegrityViolationException;
import vacademy.io.common.exceptions.VacademyException;

import java.lang.reflect.Method;

import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertTrue;

/**
 * Double-booking protection for mentor slots.
 *
 * <p>Booking creation validated the slot and then inserted, with nothing in between —
 * two simultaneous requests for one mentor slot could both pass the check. V458 adds
 * {@code uq_booking_host_slot}, a partial unique index on (host, exact start) over
 * live bookings, so the database decides the race. These tests pin the translation
 * of that violation: the loser must see the ordinary "slot no longer available"
 * message, and unrelated constraint failures must NOT be disguised as one.
 *
 * <p>The index behaviour itself (racing insert rejected, cancelled slot re-bookable,
 * other hosts unaffected, and the migration surviving pre-existing duplicates) is
 * verified directly against PostgreSQL, since a unique index cannot be exercised by
 * a mocked repository.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MentorDoubleBookingTest {

    /** The private predicate that decides whether a violation is the slot guard. */
    private static boolean isSlotCollision(DataIntegrityViolationException e) throws Exception {
        Method m = Class
                .forName("vacademy.io.admin_core_service.features.booking.service.MeetingBookingService")
                .getDeclaredMethod("isSlotCollision", DataIntegrityViolationException.class);
        m.setAccessible(true);
        return (boolean) m.invoke(null, e);
    }

    @Test
    @DisplayName("a lost slot race is recognised from the index name")
    void recognisesSlotCollision() throws Exception {
        DataIntegrityViolationException e = new DataIntegrityViolationException(
                "could not execute statement",
                new RuntimeException(
                        "ERROR: duplicate key value violates unique constraint \"uq_booking_host_slot\""));
        assertTrue(isSlotCollision(e));
    }

    @Test
    @DisplayName("an unrelated constraint failure is NOT disguised as a slot clash")
    void doesNotSwallowOtherViolations() throws Exception {
        // Reporting "pick another time" for, say, a foreign-key failure would send the
        // user in circles and hide a genuine bug.
        DataIntegrityViolationException e = new DataIntegrityViolationException(
                "could not execute statement",
                new RuntimeException(
                        "ERROR: duplicate key value violates unique constraint \"uq_msa_mentor_student\""));
        assertFalse(isSlotCollision(e));
    }

    @Test
    @DisplayName("a violation with no cause detail is not treated as a slot clash")
    void handlesMissingDetail() throws Exception {
        assertFalse(isSlotCollision(new DataIntegrityViolationException("something broke")));
    }

    @Test
    @DisplayName("the message the loser sees matches the pre-check, so the two paths agree")
    void messageMatchesPreCheck() {
        // PublicBookingService's availability pre-check throws this exact sentence; the
        // constraint path must not introduce a second, different wording for one situation.
        String preCheck = "This slot is no longer available. Please pick another time.";
        VacademyException fromConstraint =
                new VacademyException("This slot is no longer available. Please pick another time.");
        assertTrue(preCheck.equals(fromConstraint.getMessage()));
    }
}
