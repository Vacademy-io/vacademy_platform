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
import vacademy.io.admin_core_service.features.mentorship.dto.MentorSessionDTOs.MentorSessionDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorSessionDTOs.RecordSessionRequest;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorSessionDTOs.SessionStatsDTO;
import vacademy.io.admin_core_service.features.mentorship.entity.Mentor;
import vacademy.io.admin_core_service.features.mentorship.entity.MentorSessionFeedback;
import vacademy.io.admin_core_service.features.mentorship.entity.MentorSessionRecord;
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
 * The mentorship session layer. Two things it must get right: a session's
 * lifecycle is derived from the appointment AND the mentor's record (a CONFIRMED
 * booking can still be a NO_SHOW), and the admin session list must contain only
 * mentorship sessions — never the institute's other bookings.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MentorSessionServiceTest {

    private static final String INSTITUTE = "inst-1";
    private static final String MENTOR_USER = "mentor-user-1";
    private static final String STUDENT = "stu-1";
    private static final Instant NOW = Instant.now();

    @Mock private MentorSessionRecordRepository recordRepository;
    @Mock private MentorSessionFeedbackRepository feedbackRepository;
    @Mock private BookingInstanceRepository bookingInstanceRepository;
    @Mock private BookingPageRepository bookingPageRepository;
    @Mock private MentorRepository mentorRepository;
    @Mock private AuthService authService;

    @InjectMocks private MentorSessionService service;

    // ---------------------------------------------------------------- fixtures

    private static CustomUserDetails mentorCaller() {
        UserServiceDTO dto = new UserServiceDTO();
        dto.setUserId(MENTOR_USER);
        dto.setUsername(MENTOR_USER);
        dto.setFullName("Asha");
        return new CustomUserDetails(dto);
    }

    private static Mentor mentor() {
        return Mentor.builder().id("m1").instituteId(INSTITUTE).userId(MENTOR_USER)
                .displayName("Asha").status("ACTIVE").build();
    }

    private static BookingInstance booking(String id, Instant start, String status, String hostUserId) {
        BookingInstance b = new BookingInstance();
        b.setId(id);
        b.setInstituteId(INSTITUTE);
        b.setHostUserId(hostUserId);
        b.setInviteeUserId(STUDENT);
        b.setInviteeName("Riya");
        b.setInviteeEmail("riya@example.com");
        b.setScheduledStartUtc(Timestamp.from(start));
        b.setScheduledEndUtc(Timestamp.from(start.plus(Duration.ofMinutes(30))));
        b.setStatus(status);
        return b;
    }

    private void instituteHas(List<BookingInstance> bookings) {
        when(bookingInstanceRepository.findForInstituteInWindow(eq(INSTITUTE), any(), any()))
                .thenReturn(bookings);
        when(mentorRepository.findByInstituteIdAndUserIdInAndStatusNot(eq(INSTITUTE), anyList(), anyString()))
                .thenReturn(List.of(mentor()));
        when(recordRepository.findByBookingInstanceIdIn(anyList())).thenReturn(List.of());
        when(feedbackRepository.findByBookingInstanceIdIn(anyList())).thenReturn(List.of());
    }

    @Nested
    @DisplayName("recording an outcome")
    class Record {

        private void pastSessionExists() {
            when(bookingInstanceRepository.findById("b1"))
                    .thenReturn(Optional.of(booking("b1", NOW.minus(Duration.ofHours(2)), "CONFIRMED", MENTOR_USER)));
            when(mentorRepository.findByInstituteIdAndUserIdAndStatusNot(eq(INSTITUTE), eq(MENTOR_USER), anyString()))
                    .thenReturn(Optional.of(mentor()));
            when(recordRepository.findByBookingInstanceId("b1")).thenReturn(Optional.empty());
            when(recordRepository.save(any())).thenAnswer(inv -> inv.getArgument(0));
        }

        @Test
        @DisplayName("stores the outcome, topic and notes against the session")
        void storesOutcome() {
            pastSessionExists();

            MentorSessionDTO dto = service.record(INSTITUTE, mentorCaller(), RecordSessionRequest.builder()
                    .bookingInstanceId("b1").outcome("COMPLETED")
                    .topic("  Rotational motion  ").notes("  Needs practice on torque  ").build());

            ArgumentCaptor<MentorSessionRecord> captor = ArgumentCaptor.forClass(MentorSessionRecord.class);
            verify(recordRepository).save(captor.capture());
            assertEquals("COMPLETED", captor.getValue().getOutcome());
            assertEquals("Rotational motion", captor.getValue().getTopic());
            assertEquals("Needs practice on torque", captor.getValue().getNotes());
            assertEquals("m1", captor.getValue().getMentorId());
            assertEquals(STUDENT, captor.getValue().getStudentUserId());
            assertEquals("COMPLETED", dto.getLifecycle());
        }

        @Test
        @DisplayName("accepts NO_SHOW, which is not the same as cancelling")
        void acceptsNoShow() {
            pastSessionExists();
            service.record(INSTITUTE, mentorCaller(), RecordSessionRequest.builder()
                    .bookingInstanceId("b1").outcome("no_show").build());

            ArgumentCaptor<MentorSessionRecord> captor = ArgumentCaptor.forClass(MentorSessionRecord.class);
            verify(recordRepository).save(captor.capture());
            assertEquals("NO_SHOW", captor.getValue().getOutcome());
        }

        @Test
        @DisplayName("re-recording revises the same row instead of adding a second")
        void reRecordingUpdatesInPlace() {
            pastSessionExists();
            MentorSessionRecord existing = MentorSessionRecord.builder()
                    .id("rec-1").instituteId(INSTITUTE).bookingInstanceId("b1")
                    .studentUserId(STUDENT).outcome("NO_SHOW").build();
            when(recordRepository.findByBookingInstanceId("b1")).thenReturn(Optional.of(existing));

            service.record(INSTITUTE, mentorCaller(), RecordSessionRequest.builder()
                    .bookingInstanceId("b1").outcome("COMPLETED").build());

            assertEquals("rec-1", existing.getId(), "must reuse the same record");
            assertEquals("COMPLETED", existing.getOutcome());
        }

        @Test
        @DisplayName("an unknown outcome is refused rather than stored")
        void refusesUnknownOutcome() {
            pastSessionExists();
            for (String bad : new String[] {null, "", "ATTENDED", "done"}) {
                assertThrows(VacademyException.class, () -> service.record(INSTITUTE, mentorCaller(),
                        RecordSessionRequest.builder().bookingInstanceId("b1").outcome(bad).build()));
            }
            verify(recordRepository, never()).save(any());
        }

        @Test
        @DisplayName("a session that hasn't happened yet can't be recorded")
        void refusesFutureSession() {
            when(bookingInstanceRepository.findById("b1"))
                    .thenReturn(Optional.of(booking("b1", NOW.plus(Duration.ofHours(2)), "CONFIRMED", MENTOR_USER)));
            when(mentorRepository.findByInstituteIdAndUserIdAndStatusNot(eq(INSTITUTE), eq(MENTOR_USER), anyString()))
                    .thenReturn(Optional.of(mentor()));

            VacademyException e = assertThrows(VacademyException.class, () -> service.record(INSTITUTE,
                    mentorCaller(), RecordSessionRequest.builder()
                            .bookingInstanceId("b1").outcome("COMPLETED").build()));
            assertTrue(e.getMessage().contains("has taken place"));
        }

        @Test
        @DisplayName("a cancelled session has nothing to record")
        void refusesCancelledSession() {
            when(bookingInstanceRepository.findById("b1"))
                    .thenReturn(Optional.of(booking("b1", NOW.minus(Duration.ofHours(2)), "CANCELLED", MENTOR_USER)));
            when(mentorRepository.findByInstituteIdAndUserIdAndStatusNot(eq(INSTITUTE), eq(MENTOR_USER), anyString()))
                    .thenReturn(Optional.of(mentor()));

            VacademyException e = assertThrows(VacademyException.class, () -> service.record(INSTITUTE,
                    mentorCaller(), RecordSessionRequest.builder()
                            .bookingInstanceId("b1").outcome("COMPLETED").build()));
            assertTrue(e.getMessage().contains("cancelled"));
        }

        @Test
        @DisplayName("another mentor's session is not recordable, and reads as not-found")
        void refusesSomeoneElsesSession() {
            when(bookingInstanceRepository.findById("b1"))
                    .thenReturn(Optional.of(booking("b1", NOW.minus(Duration.ofHours(2)), "CONFIRMED", "other-host")));
            when(mentorRepository.findByInstituteIdAndUserIdAndStatusNot(eq(INSTITUTE), eq(MENTOR_USER), anyString()))
                    .thenReturn(Optional.of(mentor()));

            VacademyException e = assertThrows(VacademyException.class, () -> service.record(INSTITUTE,
                    mentorCaller(), RecordSessionRequest.builder()
                            .bookingInstanceId("b1").outcome("COMPLETED").build()));
            assertTrue(e.getMessage().contains("not found"));
            verify(recordRepository, never()).save(any());
        }

        @Test
        @DisplayName("a non-mentor can't record sessions at all")
        void refusesNonMentor() {
            when(bookingInstanceRepository.findById("b1"))
                    .thenReturn(Optional.of(booking("b1", NOW.minus(Duration.ofHours(2)), "CONFIRMED", MENTOR_USER)));
            when(mentorRepository.findByInstituteIdAndUserIdAndStatusNot(anyString(), anyString(), anyString()))
                    .thenReturn(Optional.empty());

            assertThrows(VacademyException.class, () -> service.record(INSTITUTE, mentorCaller(),
                    RecordSessionRequest.builder().bookingInstanceId("b1").outcome("COMPLETED").build()));
        }
    }

    @Nested
    @DisplayName("admin session list")
    class Listing {

        @Test
        @DisplayName("shows both parties with their emails, as the admin view needs")
        void carriesBothParties() {
            instituteHas(List.of(booking("b1", NOW.minus(Duration.ofHours(1)), "CONFIRMED", MENTOR_USER)));

            MentorSessionDTO dto = service.sessions(INSTITUTE, null, null, null, null).get(0);

            assertEquals("Asha", dto.getMentorName());
            assertEquals("Riya", dto.getStudentName());
            assertEquals("riya@example.com", dto.getStudentEmail());
            assertEquals(30, dto.getDurationMinutes());
        }

        @Test
        @DisplayName("excludes bookings that no mentor hosted — those are not mentorship")
        void excludesNonMentorshipBookings() {
            when(bookingInstanceRepository.findForInstituteInWindow(eq(INSTITUTE), any(), any()))
                    .thenReturn(List.of(booking("b1", NOW.minus(Duration.ofHours(1)), "CONFIRMED", "sales-rep")));
            when(mentorRepository.findByInstituteIdAndUserIdInAndStatusNot(eq(INSTITUTE), anyList(), anyString()))
                    .thenReturn(List.of());

            assertTrue(service.sessions(INSTITUTE, null, null, null, null).isEmpty());
        }

        @Test
        @DisplayName("a past session with no record is awaiting review, not silently complete")
        void pastUnrecordedIsAwaitingReview() {
            instituteHas(List.of(booking("b1", NOW.minus(Duration.ofHours(1)), "CONFIRMED", MENTOR_USER)));
            assertEquals("AWAITING_REVIEW",
                    service.sessions(INSTITUTE, null, null, null, null).get(0).getLifecycle());
        }

        @Test
        @DisplayName("a future session is upcoming")
        void futureIsUpcoming() {
            instituteHas(List.of(booking("b1", NOW.plus(Duration.ofDays(1)), "CONFIRMED", MENTOR_USER)));
            assertEquals("UPCOMING",
                    service.sessions(INSTITUTE, null, null, null, null).get(0).getLifecycle());
        }

        @Test
        @DisplayName("cancellation outranks the recorded outcome — it never took place")
        void cancellationWins() {
            when(bookingInstanceRepository.findForInstituteInWindow(eq(INSTITUTE), any(), any()))
                    .thenReturn(List.of(booking("b1", NOW.minus(Duration.ofHours(1)), "CANCELLED", MENTOR_USER)));
            when(mentorRepository.findByInstituteIdAndUserIdInAndStatusNot(eq(INSTITUTE), anyList(), anyString()))
                    .thenReturn(List.of(mentor()));
            when(recordRepository.findByBookingInstanceIdIn(anyList())).thenReturn(List.of(
                    MentorSessionRecord.builder().bookingInstanceId("b1").outcome("COMPLETED").build()));
            when(feedbackRepository.findByBookingInstanceIdIn(anyList())).thenReturn(List.of());

            assertEquals("CANCELLED",
                    service.sessions(INSTITUTE, null, null, null, null).get(0).getLifecycle());
        }

        @Test
        @DisplayName("a confirmed booking can still be a NO_SHOW")
        void confirmedCanBeNoShow() {
            when(bookingInstanceRepository.findForInstituteInWindow(eq(INSTITUTE), any(), any()))
                    .thenReturn(List.of(booking("b1", NOW.minus(Duration.ofHours(1)), "CONFIRMED", MENTOR_USER)));
            when(mentorRepository.findByInstituteIdAndUserIdInAndStatusNot(eq(INSTITUTE), anyList(), anyString()))
                    .thenReturn(List.of(mentor()));
            when(recordRepository.findByBookingInstanceIdIn(anyList())).thenReturn(List.of(
                    MentorSessionRecord.builder().bookingInstanceId("b1").outcome("NO_SHOW").build()));
            when(feedbackRepository.findByBookingInstanceIdIn(anyList())).thenReturn(List.of());

            MentorSessionDTO dto = service.sessions(INSTITUTE, null, null, null, null).get(0);
            assertEquals("CONFIRMED", dto.getBookingStatus());
            assertEquals("NO_SHOW", dto.getLifecycle());
        }

        @Test
        @DisplayName("attaches the learner's rating to the session")
        void attachesRating() {
            when(bookingInstanceRepository.findForInstituteInWindow(eq(INSTITUTE), any(), any()))
                    .thenReturn(List.of(booking("b1", NOW.minus(Duration.ofHours(1)), "CONFIRMED", MENTOR_USER)));
            when(mentorRepository.findByInstituteIdAndUserIdInAndStatusNot(eq(INSTITUTE), anyList(), anyString()))
                    .thenReturn(List.of(mentor()));
            when(recordRepository.findByBookingInstanceIdIn(anyList())).thenReturn(List.of());
            when(feedbackRepository.findByBookingInstanceIdIn(anyList())).thenReturn(List.of(
                    MentorSessionFeedback.builder().bookingInstanceId("b1").rating(5).comment("great").build()));

            MentorSessionDTO dto = service.sessions(INSTITUTE, null, null, null, null).get(0);
            assertEquals(5, dto.getRating());
            assertEquals("great", dto.getFeedbackComment());
        }

        @Test
        @DisplayName("filters to one mentor and to one learner")
        void filtersByMentorAndStudent() {
            instituteHas(List.of(booking("b1", NOW.minus(Duration.ofHours(1)), "CONFIRMED", MENTOR_USER)));

            assertEquals(1, service.sessions(INSTITUTE, "m1", null, null, null).size());
            assertTrue(service.sessions(INSTITUTE, "other-mentor", null, null, null).isEmpty());
            assertEquals(1, service.sessions(INSTITUTE, null, STUDENT, null, null).size());
            assertTrue(service.sessions(INSTITUTE, null, "someone-else", null, null).isEmpty());
        }

        @Test
        @DisplayName("filters by lifecycle, so 'no shows' means only no-shows")
        void filtersByLifecycle() {
            instituteHas(List.of(booking("b1", NOW.plus(Duration.ofDays(1)), "CONFIRMED", MENTOR_USER)));

            assertEquals(1, service.sessions(INSTITUTE, null, null, "UPCOMING", null).size());
            assertTrue(service.sessions(INSTITUTE, null, null, "NO_SHOW", null).isEmpty());
        }

        @Test
        @DisplayName("newest first, so the list opens on what just happened")
        void newestFirst() {
            instituteHas(List.of(
                    booking("old", NOW.minus(Duration.ofDays(5)), "CONFIRMED", MENTOR_USER),
                    booking("recent", NOW.minus(Duration.ofHours(1)), "CONFIRMED", MENTOR_USER)));

            List<MentorSessionDTO> list = service.sessions(INSTITUTE, null, null, null, null);
            assertEquals("recent", list.get(0).getBookingInstanceId());
        }
    }

    @Nested
    @DisplayName("dashboard counts")
    class Stats {

        @Test
        @DisplayName("counts each lifecycle separately, so cancelled never inflates completed")
        void countsByLifecycle() {
            when(bookingInstanceRepository.findForInstituteInWindow(eq(INSTITUTE), any(), any()))
                    .thenReturn(List.of(
                            booking("done", NOW.minus(Duration.ofHours(3)), "CONFIRMED", MENTOR_USER),
                            booking("noshow", NOW.minus(Duration.ofHours(4)), "CONFIRMED", MENTOR_USER),
                            booking("cancelled", NOW.minus(Duration.ofHours(5)), "CANCELLED", MENTOR_USER),
                            booking("pending", NOW.minus(Duration.ofHours(6)), "CONFIRMED", MENTOR_USER),
                            booking("future", NOW.plus(Duration.ofDays(2)), "CONFIRMED", MENTOR_USER)));
            when(mentorRepository.findByInstituteIdAndUserIdInAndStatusNot(eq(INSTITUTE), anyList(), anyString()))
                    .thenReturn(List.of(mentor()));
            when(recordRepository.findByBookingInstanceIdIn(anyList())).thenReturn(List.of(
                    MentorSessionRecord.builder().bookingInstanceId("done").outcome("COMPLETED").build(),
                    MentorSessionRecord.builder().bookingInstanceId("noshow").outcome("NO_SHOW").build()));
            when(feedbackRepository.findByBookingInstanceIdIn(anyList())).thenReturn(List.of());

            SessionStatsDTO stats = service.stats(INSTITUTE);

            assertEquals(1, stats.getCompleted());
            assertEquals(1, stats.getNoShow());
            assertEquals(1, stats.getCancelled());
            assertEquals(1, stats.getAwaitingReview());
            assertEquals(1, stats.getUpcoming());
        }

        @Test
        @DisplayName("an institute with no mentorship sessions reports zeros, not nulls")
        void emptyInstituteReportsZeros() {
            when(bookingInstanceRepository.findForInstituteInWindow(eq(INSTITUTE), any(), any()))
                    .thenReturn(List.of());

            SessionStatsDTO stats = service.stats(INSTITUTE);
            assertEquals(0, stats.getCompleted());
            assertEquals(0, stats.getCancelled());
            assertEquals(0, stats.getNoShow());
            assertEquals(0, stats.getAwaitingReview());
            assertEquals(0, stats.getUpcoming());
        }
    }
}
