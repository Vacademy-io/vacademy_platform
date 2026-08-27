package vacademy.io.admin_core_service.features.mentorship.service;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.booking.dto.PublicBookingDTOs;
import vacademy.io.admin_core_service.features.booking.entity.BookingInstance;
import vacademy.io.admin_core_service.features.booking.repository.BookingInstanceRepository;
import vacademy.io.admin_core_service.features.booking.repository.BookingPageRepository;
import vacademy.io.admin_core_service.features.booking.service.PublicBookingService;
import vacademy.io.admin_core_service.features.mentorship.entity.Mentor;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorRepository;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorSessionFeedbackRepository;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorSessionRecordRepository;
import vacademy.io.common.auth.dto.UserServiceDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Authenticated cancel/reschedule. The behaviour that matters is who may act and
 * that the work is delegated to the booking module rather than reimplemented —
 * the emailed manage-token link and these endpoints must stay one code path, so
 * the live session, reminders, calendar event and notifications are handled once.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MentorSessionCancelRescheduleTest {

    private static final String INSTITUTE = "inst-1";
    private static final String MENTOR_USER = "mentor-user-1";
    private static final String OTHER_MENTOR_USER = "mentor-user-2";
    private static final Instant NOW = Instant.now();

    @Mock private MentorSessionRecordRepository recordRepository;
    @Mock private MentorSessionFeedbackRepository feedbackRepository;
    @Mock private BookingInstanceRepository bookingInstanceRepository;
    @Mock private BookingPageRepository bookingPageRepository;
    @Mock private MentorRepository mentorRepository;
    @Mock private PublicBookingService publicBookingService;
    @Mock private AuthService authService;

    @InjectMocks private MentorSessionService service;

    private static CustomUserDetails caller(String userId) {
        UserServiceDTO dto = new UserServiceDTO();
        dto.setUserId(userId);
        dto.setUsername(userId);
        dto.setFullName("Caller");
        return new CustomUserDetails(dto);
    }

    private static Mentor mentor(String userId) {
        return Mentor.builder().id("m-" + userId).instituteId(INSTITUTE).userId(userId)
                .displayName("Asha").status("ACTIVE").build();
    }

    private BookingInstance session(String hostUserId) {
        BookingInstance b = new BookingInstance();
        b.setId("b1");
        b.setInstituteId(INSTITUTE);
        b.setHostUserId(hostUserId);
        b.setInviteeUserId("stu-1");
        b.setScheduledStartUtc(Timestamp.from(NOW.plus(Duration.ofDays(1))));
        b.setStatus("CONFIRMED");
        when(bookingInstanceRepository.findById("b1")).thenReturn(Optional.of(b));
        return b;
    }

    private void hostIsAMentor(String hostUserId) {
        when(mentorRepository.findByInstituteIdAndUserIdAndStatusNot(eq(INSTITUTE), eq(hostUserId), anyString()))
                .thenReturn(Optional.of(mentor(hostUserId)));
    }

    /** The reload path after the operation — irrelevant to these assertions. */
    private void reloadReturnsNothing() {
        when(bookingInstanceRepository.findForInstituteInWindow(eq(INSTITUTE), any(), any()))
                .thenReturn(List.of());
        when(mentorRepository.findByInstituteIdAndUserIdInAndStatusNot(eq(INSTITUTE), anyList(), anyString()))
                .thenReturn(List.of());
    }

    @Nested
    @DisplayName("cancellation")
    class Cancel {

        @Test
        @DisplayName("an admin can cancel any mentorship session, via the booking module")
        void adminCancels() {
            BookingInstance booking = session(MENTOR_USER);
            hostIsAMentor(MENTOR_USER);
            reloadReturnsNothing();

            service.cancelSession(INSTITUTE, caller("admin-1"), "b1", "  Mentor is unwell  ", true);

            // Delegated, not reimplemented — same code the emailed link runs.
            verify(publicBookingService).cancelInstance(eq(booking), eq("Mentor is unwell"));
        }

        @Test
        @DisplayName("a mentor can cancel their own session")
        void mentorCancelsOwn() {
            BookingInstance booking = session(MENTOR_USER);
            hostIsAMentor(MENTOR_USER);
            reloadReturnsNothing();

            service.cancelSession(INSTITUTE, caller(MENTOR_USER), "b1", "Clash", false);

            verify(publicBookingService).cancelInstance(eq(booking), eq("Clash"));
        }

        @Test
        @DisplayName("a mentor cannot cancel another mentor's session")
        void mentorCannotCancelSomeoneElses() {
            session(OTHER_MENTOR_USER);
            hostIsAMentor(OTHER_MENTOR_USER);

            VacademyException e = assertThrows(VacademyException.class,
                    () -> service.cancelSession(INSTITUTE, caller(MENTOR_USER), "b1", null, false));

            // Reads as not-found so one mentor can't probe for another's bookings.
            assertTrue(e.getMessage().contains("not found"));
            verify(publicBookingService, never()).cancelInstance(any(), any());
        }

        @Test
        @DisplayName("a non-mentorship booking can't be cancelled through the mentorship API")
        void refusesNonMentorshipBooking() {
            session("sales-rep");
            when(mentorRepository.findByInstituteIdAndUserIdAndStatusNot(anyString(), anyString(), anyString()))
                    .thenReturn(Optional.empty());

            VacademyException e = assertThrows(VacademyException.class,
                    () -> service.cancelSession(INSTITUTE, caller("admin-1"), "b1", null, true));
            assertTrue(e.getMessage().contains("isn't a mentorship session"));
            verify(publicBookingService, never()).cancelInstance(any(), any());
        }

        @Test
        @DisplayName("a session in another institute is not reachable")
        void refusesCrossInstitute() {
            BookingInstance other = session(MENTOR_USER);
            other.setInstituteId("inst-2");
            hostIsAMentor(MENTOR_USER);

            assertThrows(VacademyException.class,
                    () -> service.cancelSession(INSTITUTE, caller("admin-1"), "b1", null, true));
            verify(publicBookingService, never()).cancelInstance(any(), any());
        }

        @Test
        @DisplayName("a missing booking id is refused before any lookup")
        void refusesMissingId() {
            assertThrows(VacademyException.class,
                    () -> service.cancelSession(INSTITUTE, caller("admin-1"), "  ", null, true));
            verify(publicBookingService, never()).cancelInstance(any(), any());
        }
    }

    @Nested
    @DisplayName("rescheduling")
    class Reschedule {

        /** The booking module returns the REPLACEMENT instance, which is a new row. */
        private void rescheduleReturns(String newId) {
            BookingInstance replacement = new BookingInstance();
            replacement.setId(newId);
            replacement.setInstituteId(INSTITUTE);
            when(publicBookingService.rescheduleInstance(any(), any())).thenReturn(replacement);
        }

        @Test
        @DisplayName("an admin can move a session, and the booking module does the work")
        void adminReschedules() {
            BookingInstance booking = session(MENTOR_USER);
            hostIsAMentor(MENTOR_USER);
            rescheduleReturns("b2");
            reloadReturnsNothing();

            service.rescheduleSession(INSTITUTE, caller("admin-1"), "b1",
                    "2026-09-01T10:00:00Z", "Asia/Kolkata", true);

            ArgumentCaptor<PublicBookingDTOs.PublicRescheduleRequestDTO> captor =
                    ArgumentCaptor.forClass(PublicBookingDTOs.PublicRescheduleRequestDTO.class);
            verify(publicBookingService).rescheduleInstance(eq(booking), captor.capture());
            assertEquals("2026-09-01T10:00:00Z", captor.getValue().getStartTime());
            assertEquals("Asia/Kolkata", captor.getValue().getInviteeTimezone());
        }

        @Test
        @DisplayName("the replacement booking is returned, not the retired one")
        void returnsTheReplacement() {
            session(MENTOR_USER);
            hostIsAMentor(MENTOR_USER);
            rescheduleReturns("b2-replacement");
            reloadReturnsNothing();

            var dto = service.rescheduleSession(INSTITUTE, caller("admin-1"), "b1",
                    "2026-09-01T10:00:00Z", null, true);

            // Rescheduling retires b1 and creates a new instance; callers must see the new one
            // so they don't act on a row that is now RESCHEDULED.
            assertEquals("b2-replacement", dto.getBookingInstanceId());
        }

        @Test
        @DisplayName("a mentor can move their own session")
        void mentorReschedulesOwn() {
            BookingInstance booking = session(MENTOR_USER);
            hostIsAMentor(MENTOR_USER);
            rescheduleReturns("b2");
            reloadReturnsNothing();

            service.rescheduleSession(INSTITUTE, caller(MENTOR_USER), "b1",
                    "2026-09-01T10:00:00Z", null, false);

            verify(publicBookingService).rescheduleInstance(eq(booking), any());
        }

        @Test
        @DisplayName("a mentor cannot move another mentor's session")
        void mentorCannotRescheduleSomeoneElses() {
            session(OTHER_MENTOR_USER);
            hostIsAMentor(OTHER_MENTOR_USER);

            assertThrows(VacademyException.class, () -> service.rescheduleSession(INSTITUTE,
                    caller(MENTOR_USER), "b1", "2026-09-01T10:00:00Z", null, false));
            verify(publicBookingService, never()).rescheduleInstance(any(), any());
        }

        @Test
        @DisplayName("a missing start time is refused before anything is touched")
        void refusesMissingStartTime() {
            VacademyException e = assertThrows(VacademyException.class, () -> service.rescheduleSession(
                    INSTITUTE, caller("admin-1"), "b1", "  ", null, true));
            assertTrue(e.getMessage().contains("start time"));
            verify(publicBookingService, never()).rescheduleInstance(any(), any());
        }

        @Test
        @DisplayName("a slot taken in the meantime surfaces the booking module's refusal")
        void surfacesSlotConflict() {
            session(MENTOR_USER);
            hostIsAMentor(MENTOR_USER);
            // This is the double-booking guard: the booking module refuses a taken slot.
            when(publicBookingService.rescheduleInstance(any(), any()))
                    .thenThrow(new VacademyException("This slot is no longer available. Please pick another time."));

            VacademyException e = assertThrows(VacademyException.class, () -> service.rescheduleSession(
                    INSTITUTE, caller("admin-1"), "b1", "2026-09-01T10:00:00Z", null, true));
            assertTrue(e.getMessage().contains("no longer available"));
        }

        @Test
        @DisplayName("a concurrent reschedule surfaces the optimistic-lock refusal, not a duplicate")
        void surfacesConcurrentModification() {
            session(MENTOR_USER);
            hostIsAMentor(MENTOR_USER);
            when(publicBookingService.rescheduleInstance(any(), any()))
                    .thenThrow(new VacademyException("This booking was just modified. Please reload and try again."));

            VacademyException e = assertThrows(VacademyException.class, () -> service.rescheduleSession(
                    INSTITUTE, caller("admin-1"), "b1", "2026-09-01T10:00:00Z", null, true));
            assertTrue(e.getMessage().contains("just modified"));
        }
    }
}
