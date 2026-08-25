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
import vacademy.io.admin_core_service.features.booking.entity.BookingInstance;
import vacademy.io.admin_core_service.features.booking.repository.BookingInstanceRepository;
import vacademy.io.admin_core_service.features.booking.repository.BookingPageRepository;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorFeedbackDTOs.FeedbackDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorFeedbackDTOs.PendingFeedbackDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorFeedbackDTOs.SubmitFeedbackRequest;
import vacademy.io.admin_core_service.features.mentorship.entity.Mentor;
import vacademy.io.admin_core_service.features.mentorship.entity.MentorSessionFeedback;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorRepository;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorSessionFeedbackRepository;
import vacademy.io.common.auth.dto.UserServiceDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
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
 * Post-session feedback. The rules that matter: only the learner who was on a
 * session can rate it, only after it happened, only for sessions a mentor hosted,
 * and re-rating revises rather than duplicates. The mentor average is derived, so
 * it has to stay consistent with whatever rows exist.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MentorFeedbackServiceTest {

    private static final String INSTITUTE = "inst-1";
    private static final String STUDENT = "stu-1";
    private static final String MENTOR_USER = "mentor-user-1";
    private static final Instant NOW = Instant.now();

    @Mock private MentorSessionFeedbackRepository feedbackRepository;
    @Mock private BookingInstanceRepository bookingInstanceRepository;
    @Mock private BookingPageRepository bookingPageRepository;
    @Mock private MentorRepository mentorRepository;
    @Mock private AuthService authService;

    @InjectMocks private MentorFeedbackService service;

    // ---------------------------------------------------------------- fixtures

    private static CustomUserDetails caller() {
        UserServiceDTO dto = new UserServiceDTO();
        dto.setUserId(STUDENT);
        dto.setUsername(STUDENT);
        dto.setFullName("Riya");
        return new CustomUserDetails(dto);
    }

    private static BookingInstance booking(String id, Instant start, String status, String inviteeUserId) {
        BookingInstance b = new BookingInstance();
        b.setId(id);
        b.setInstituteId(INSTITUTE);
        b.setHostUserId(MENTOR_USER);
        b.setInviteeUserId(inviteeUserId);
        b.setScheduledStartUtc(Timestamp.from(start));
        b.setStatus(status);
        return b;
    }

    private static Mentor mentor() {
        return Mentor.builder()
                .id("m1").instituteId(INSTITUTE).userId(MENTOR_USER)
                .displayName("Asha").status("ACTIVE").build();
    }

    private void hostIsAMentor() {
        when(mentorRepository.findByInstituteIdAndUserIdAndStatusNot(eq(INSTITUTE), eq(MENTOR_USER), anyString()))
                .thenReturn(Optional.of(mentor()));
        when(mentorRepository.findByInstituteIdAndUserIdInAndStatusNot(eq(INSTITUTE), anyList(), anyString()))
                .thenReturn(List.of(mentor()));
    }

    @Nested
    @DisplayName("sessions awaiting a rating")
    class Pending {

        @Test
        @DisplayName("lists a finished mentor session the learner hasn't rated")
        void listsUnratedPastSession() {
            when(bookingInstanceRepository.findByInstituteIdAndInviteeUserIdOrderByScheduledStartUtcDesc(
                    INSTITUTE, STUDENT))
                    .thenReturn(List.of(booking("b1", NOW.minus(Duration.ofDays(1)), "CONFIRMED", STUDENT)));
            when(feedbackRepository.findByInstituteIdAndStudentUserId(INSTITUTE, STUDENT)).thenReturn(List.of());
            hostIsAMentor();

            List<PendingFeedbackDTO> pending = service.pendingForStudent(INSTITUTE, STUDENT);

            assertEquals(1, pending.size());
            assertEquals("b1", pending.get(0).getBookingInstanceId());
            assertEquals("Asha", pending.get(0).getMentorName());
            assertEquals("Mentor session", pending.get(0).getSessionTitle());
        }

        @Test
        @DisplayName("a session that hasn't happened yet is never asked about")
        void skipsFutureSessions() {
            when(bookingInstanceRepository.findByInstituteIdAndInviteeUserIdOrderByScheduledStartUtcDesc(
                    INSTITUTE, STUDENT))
                    .thenReturn(List.of(booking("b1", NOW.plus(Duration.ofDays(1)), "CONFIRMED", STUDENT)));
            hostIsAMentor();

            assertTrue(service.pendingForStudent(INSTITUTE, STUDENT).isEmpty());
        }

        @Test
        @DisplayName("cancelled and rescheduled sessions are not ratable")
        void skipsCancelledSessions() {
            when(bookingInstanceRepository.findByInstituteIdAndInviteeUserIdOrderByScheduledStartUtcDesc(
                    INSTITUTE, STUDENT))
                    .thenReturn(List.of(
                            booking("b1", NOW.minus(Duration.ofDays(1)), "CANCELLED", STUDENT),
                            booking("b2", NOW.minus(Duration.ofDays(1)), "RESCHEDULED", STUDENT)));
            hostIsAMentor();

            assertTrue(service.pendingForStudent(INSTITUTE, STUDENT).isEmpty());
        }

        @Test
        @DisplayName("an already-rated session drops off the prompt")
        void skipsRatedSessions() {
            when(bookingInstanceRepository.findByInstituteIdAndInviteeUserIdOrderByScheduledStartUtcDesc(
                    INSTITUTE, STUDENT))
                    .thenReturn(List.of(booking("b1", NOW.minus(Duration.ofDays(1)), "CONFIRMED", STUDENT)));
            when(feedbackRepository.findByInstituteIdAndStudentUserId(INSTITUTE, STUDENT))
                    .thenReturn(List.of(MentorSessionFeedback.builder().bookingInstanceId("b1").build()));
            hostIsAMentor();

            assertTrue(service.pendingForStudent(INSTITUTE, STUDENT).isEmpty());
        }

        @Test
        @DisplayName("a stale session past the prompt window stops nagging")
        void skipsVeryOldSessions() {
            when(bookingInstanceRepository.findByInstituteIdAndInviteeUserIdOrderByScheduledStartUtcDesc(
                    INSTITUTE, STUDENT))
                    .thenReturn(List.of(booking("b1", NOW.minus(Duration.ofDays(120)), "CONFIRMED", STUDENT)));
            when(feedbackRepository.findByInstituteIdAndStudentUserId(INSTITUTE, STUDENT)).thenReturn(List.of());
            hostIsAMentor();

            assertTrue(service.pendingForStudent(INSTITUTE, STUDENT).isEmpty());
        }

        @Test
        @DisplayName("an ordinary meeting whose host isn't a mentor never asks for a rating")
        void skipsNonMentorshipSessions() {
            when(bookingInstanceRepository.findByInstituteIdAndInviteeUserIdOrderByScheduledStartUtcDesc(
                    INSTITUTE, STUDENT))
                    .thenReturn(List.of(booking("b1", NOW.minus(Duration.ofDays(1)), "CONFIRMED", STUDENT)));
            when(feedbackRepository.findByInstituteIdAndStudentUserId(INSTITUTE, STUDENT)).thenReturn(List.of());
            when(mentorRepository.findByInstituteIdAndUserIdInAndStatusNot(eq(INSTITUTE), anyList(), anyString()))
                    .thenReturn(List.of());

            assertTrue(service.pendingForStudent(INSTITUTE, STUDENT).isEmpty());
        }
    }

    @Nested
    @DisplayName("submitting a rating")
    class Submit {

        private void bookingExists(BookingInstance b) {
            when(bookingInstanceRepository.findById(b.getId())).thenReturn(Optional.of(b));
        }

        @Test
        @DisplayName("stores the rating and trimmed comment against the mentor")
        void storesRating() {
            bookingExists(booking("b1", NOW.minus(Duration.ofHours(2)), "CONFIRMED", STUDENT));
            hostIsAMentor();
            when(feedbackRepository.findByBookingInstanceIdAndStudentUserId("b1", STUDENT))
                    .thenReturn(Optional.empty());
            when(feedbackRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            FeedbackDTO dto = service.submit(INSTITUTE, caller(), SubmitFeedbackRequest.builder()
                    .bookingInstanceId("b1").rating(5).comment("  really helpful  ").build());

            ArgumentCaptor<MentorSessionFeedback> captor = ArgumentCaptor.forClass(MentorSessionFeedback.class);
            verify(feedbackRepository).save(captor.capture());
            assertEquals(5, captor.getValue().getRating());
            assertEquals("really helpful", captor.getValue().getComment());
            assertEquals("m1", captor.getValue().getMentorId());
            assertEquals(MENTOR_USER, captor.getValue().getMentorUserId());
            assertEquals(5, dto.getRating());
        }

        @Test
        @DisplayName("re-rating revises the existing row instead of adding a second")
        void reRatingUpdatesInPlace() {
            bookingExists(booking("b1", NOW.minus(Duration.ofHours(2)), "CONFIRMED", STUDENT));
            hostIsAMentor();
            MentorSessionFeedback existing = MentorSessionFeedback.builder()
                    .id("f1").instituteId(INSTITUTE).bookingInstanceId("b1")
                    .studentUserId(STUDENT).rating(2).comment("meh").build();
            when(feedbackRepository.findByBookingInstanceIdAndStudentUserId("b1", STUDENT))
                    .thenReturn(Optional.of(existing));
            when(feedbackRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.submit(INSTITUTE, caller(), SubmitFeedbackRequest.builder()
                    .bookingInstanceId("b1").rating(4).comment("better on reflection").build());

            assertEquals("f1", existing.getId(), "must reuse the same row");
            assertEquals(4, existing.getRating());
            assertEquals("better on reflection", existing.getComment());
        }

        @Test
        @DisplayName("a blank comment is stored as absent, not as an empty string")
        void blankCommentBecomesNull() {
            bookingExists(booking("b1", NOW.minus(Duration.ofHours(2)), "CONFIRMED", STUDENT));
            hostIsAMentor();
            when(feedbackRepository.findByBookingInstanceIdAndStudentUserId("b1", STUDENT))
                    .thenReturn(Optional.empty());
            when(feedbackRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));

            service.submit(INSTITUTE, caller(), SubmitFeedbackRequest.builder()
                    .bookingInstanceId("b1").rating(3).comment("   ").build());

            ArgumentCaptor<MentorSessionFeedback> captor = ArgumentCaptor.forClass(MentorSessionFeedback.class);
            verify(feedbackRepository).save(captor.capture());
            assertNull(captor.getValue().getComment());
        }

        @Test
        @DisplayName("ratings outside 1-5 are refused before touching the DB")
        void refusesOutOfRangeRatings() {
            bookingExists(booking("b1", NOW.minus(Duration.ofHours(2)), "CONFIRMED", STUDENT));
            hostIsAMentor();

            for (Integer bad : new Integer[] {null, 0, -1, 6, 99}) {
                assertThrows(VacademyException.class, () -> service.submit(INSTITUTE, caller(),
                        SubmitFeedbackRequest.builder().bookingInstanceId("b1").rating(bad).build()));
            }
            verify(feedbackRepository, never()).save(any());
        }

        @Test
        @DisplayName("someone else's session is not ratable, and reads as not-found")
        void cannotRateSomeoneElsesSession() {
            bookingExists(booking("b1", NOW.minus(Duration.ofHours(2)), "CONFIRMED", "other-learner"));
            hostIsAMentor();

            VacademyException e = assertThrows(VacademyException.class, () -> service.submit(INSTITUTE, caller(),
                    SubmitFeedbackRequest.builder().bookingInstanceId("b1").rating(5).build()));
            // Deliberately indistinguishable from a missing session — no probing.
            assertTrue(e.getMessage().contains("not found"));
            verify(feedbackRepository, never()).save(any());
        }

        @Test
        @DisplayName("a session in another institute is not reachable")
        void cannotRateCrossInstituteSession() {
            BookingInstance other = booking("b1", NOW.minus(Duration.ofHours(2)), "CONFIRMED", STUDENT);
            other.setInstituteId("inst-2");
            bookingExists(other);

            assertThrows(VacademyException.class, () -> service.submit(INSTITUTE, caller(),
                    SubmitFeedbackRequest.builder().bookingInstanceId("b1").rating(5).build()));
        }

        @Test
        @DisplayName("a session that hasn't happened yet can't be rated")
        void cannotRateFutureSession() {
            bookingExists(booking("b1", NOW.plus(Duration.ofHours(2)), "CONFIRMED", STUDENT));
            hostIsAMentor();

            VacademyException e = assertThrows(VacademyException.class, () -> service.submit(INSTITUTE, caller(),
                    SubmitFeedbackRequest.builder().bookingInstanceId("b1").rating(5).build()));
            assertTrue(e.getMessage().contains("has taken place"));
        }

        @Test
        @DisplayName("a cancelled session can't be rated")
        void cannotRateCancelledSession() {
            bookingExists(booking("b1", NOW.minus(Duration.ofHours(2)), "CANCELLED", STUDENT));
            hostIsAMentor();

            VacademyException e = assertThrows(VacademyException.class, () -> service.submit(INSTITUTE, caller(),
                    SubmitFeedbackRequest.builder().bookingInstanceId("b1").rating(5).build()));
            assertTrue(e.getMessage().contains("didn't take place"));
        }

        @Test
        @DisplayName("a non-mentorship meeting can't be rated as mentorship")
        void cannotRateNonMentorshipSession() {
            bookingExists(booking("b1", NOW.minus(Duration.ofHours(2)), "CONFIRMED", STUDENT));
            when(mentorRepository.findByInstituteIdAndUserIdAndStatusNot(anyString(), anyString(), anyString()))
                    .thenReturn(Optional.empty());

            VacademyException e = assertThrows(VacademyException.class, () -> service.submit(INSTITUTE, caller(),
                    SubmitFeedbackRequest.builder().bookingInstanceId("b1").rating(5).build()));
            assertTrue(e.getMessage().contains("wasn't a mentorship session"));
        }
    }

    @Nested
    @DisplayName("mentor rating average")
    class Summary {

        @Test
        @DisplayName("rounds to one decimal, the precision the UI shows")
        void roundsAverage() {
            when(feedbackRepository.aggregateByMentor(INSTITUTE)).thenReturn(List.of(
                    new Object[] {"m1", 4.6666666, 3L},
                    new Object[] {"m2", 5.0, 1L}));

            Map<String, MentorFeedbackService.RatingSummary> summary = service.summaryByMentor(INSTITUTE);

            assertEquals(4.7, summary.get("m1").average());
            assertEquals(3, summary.get("m1").count());
            assertEquals(5.0, summary.get("m2").average());
        }

        @Test
        @DisplayName("an unrated mentor simply has no entry, so the UI shows no score")
        void unratedMentorHasNoEntry() {
            when(feedbackRepository.aggregateByMentor(INSTITUTE)).thenReturn(List.of());
            assertTrue(service.summaryByMentor(INSTITUTE).isEmpty());
        }
    }
}
