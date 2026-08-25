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
import vacademy.io.admin_core_service.features.booking.entity.BookingPage;
import vacademy.io.admin_core_service.features.booking.repository.BookingInstanceRepository;
import vacademy.io.admin_core_service.features.booking.repository.BookingPageRepository;
import vacademy.io.admin_core_service.features.booking.service.PublicBookingService;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorSessionDTOs.ScheduleSessionRequest;
import vacademy.io.admin_core_service.features.mentorship.entity.Mentor;
import vacademy.io.admin_core_service.features.mentorship.entity.MentorStudentAssignment;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorRepository;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorSessionFeedbackRepository;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorSessionRecordRepository;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorStudentAssignmentRepository;
import vacademy.io.common.auth.dto.UserDTO;
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
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyBoolean;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Scheduling a 1:1 on a learner's behalf, and the learner's own view of their sessions.
 *
 * The two things worth pinning: scheduling goes through the SAME booking service the
 * learner's own booking page uses (so availability, Meet links, reminders and emails are
 * not reimplemented), and each actor may only touch what is theirs.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MentorSessionScheduleTest {

    private static final String INSTITUTE = "inst-1";
    private static final String MENTOR_USER = "mentor-user-1";
    private static final String MENTOR_ID = "m-1";
    private static final String STUDENT = "stu-1";
    private static final String SLOT = "2026-09-01T10:00:00+05:30";

    @Mock private MentorSessionRecordRepository recordRepository;
    @Mock private MentorSessionFeedbackRepository feedbackRepository;
    @Mock private BookingInstanceRepository bookingInstanceRepository;
    @Mock private BookingPageRepository bookingPageRepository;
    @Mock private MentorRepository mentorRepository;
    @Mock private PublicBookingService publicBookingService;
    @Mock private AuthService authService;
    @Mock private MentorStudentAssignmentRepository assignmentRepository;

    @InjectMocks private MentorSessionService service;

    private static CustomUserDetails caller(String userId) {
        UserServiceDTO dto = new UserServiceDTO();
        dto.setUserId(userId);
        dto.setUsername(userId);
        dto.setFullName("Caller");
        return new CustomUserDetails(dto);
    }

    private static ScheduleSessionRequest request() {
        return ScheduleSessionRequest.builder()
                .mentorId(MENTOR_ID)
                .studentUserId(STUDENT)
                .startTime(SLOT)
                .inviteeTimezone("Asia/Kolkata")
                .build();
    }

    private Mentor mentorWithBookingPage() {
        Mentor mentor = Mentor.builder().id(MENTOR_ID).instituteId(INSTITUTE).userId(MENTOR_USER)
                .displayName("Asha").status("ACTIVE").bookingPageId("page-1").build();
        when(mentorRepository.findById(MENTOR_ID)).thenReturn(Optional.of(mentor));
        when(mentorRepository.findByInstituteIdAndUserIdAndStatusNot(eq(INSTITUTE), eq(MENTOR_USER), anyString()))
                .thenReturn(Optional.of(mentor));
        BookingPage page = new BookingPage();
        page.setId("page-1");
        page.setSlug("asha-1-1");
        when(bookingPageRepository.findById("page-1")).thenReturn(Optional.of(page));
        return mentor;
    }

    private void studentExists(String email, String phone) {
        UserDTO student = new UserDTO();
        student.setId(STUDENT);
        student.setFullName("Ravi Kumar");
        student.setEmail(email);
        student.setMobileNumber(phone);
        when(authService.getUsersFromAuthServiceByUserIds(anyList())).thenReturn(List.of(student));
    }

    /** The booking succeeds and the created instance is readable back by its token. */
    private void bookingSucceeds() {
        PublicBookingDTOs.PublicBookingViewDTO view = PublicBookingDTOs.PublicBookingViewDTO.builder()
                .manageToken("tok-1").build();
        when(publicBookingService.book(anyString(), anyString(), any(), anyString(), anyBoolean()))
                .thenReturn(view);
        BookingInstance created = new BookingInstance();
        created.setId("b-new");
        created.setInstituteId(INSTITUTE);
        created.setHostUserId(MENTOR_USER);
        created.setInviteeUserId(STUDENT);
        created.setStatus("CONFIRMED");
        created.setScheduledStartUtc(Timestamp.from(Instant.now().plus(Duration.ofDays(1))));
        when(bookingInstanceRepository.findByManageToken("tok-1")).thenReturn(Optional.of(created));
        // The reload path re-reads through the list query; an empty window is enough
        // for these assertions and keeps the fixture small.
        when(bookingInstanceRepository.findForInstituteInWindow(eq(INSTITUTE), any(), any()))
                .thenReturn(List.of());
        when(mentorRepository.findByInstituteIdAndUserIdInAndStatusNot(eq(INSTITUTE), anyList(), anyString()))
                .thenReturn(List.of());
    }

    @Nested
    @DisplayName("admin scheduling")
    class AdminSchedules {

        @Test
        @DisplayName("books through the booking service with the learner's own details")
        void booksWithLearnerDetails() {
            mentorWithBookingPage();
            studentExists("ravi@example.com", "9998887776");
            bookingSucceeds();

            service.scheduleSession(INSTITUTE, caller("admin-1"), request(),
                    MentorSessionService.SessionActor.ADMIN);

            ArgumentCaptor<PublicBookingDTOs.PublicBookRequestDTO> payload =
                    ArgumentCaptor.forClass(PublicBookingDTOs.PublicBookRequestDTO.class);
            ArgumentCaptor<Boolean> trusted = ArgumentCaptor.forClass(Boolean.class);
            verify(publicBookingService).book(eq(INSTITUTE), eq("asha-1-1"), payload.capture(),
                    eq(STUDENT), trusted.capture());

            assertEquals("Ravi Kumar", payload.getValue().getName());
            assertEquals("ravi@example.com", payload.getValue().getEmail());
            assertEquals(SLOT, payload.getValue().getStartTime());
            // Staff-initiated bookings skip the public link's anti-abuse caps.
            assertTrue(trusted.getValue());
        }

        @Test
        @DisplayName("refuses a mentor who has no booking page, naming the fix")
        void refusesMentorWithoutBookingPage() {
            Mentor mentor = Mentor.builder().id(MENTOR_ID).instituteId(INSTITUTE).userId(MENTOR_USER)
                    .status("ACTIVE").build();
            when(mentorRepository.findById(MENTOR_ID)).thenReturn(Optional.of(mentor));

            VacademyException e = assertThrows(VacademyException.class,
                    () -> service.scheduleSession(INSTITUTE, caller("admin-1"), request(),
                            MentorSessionService.SessionActor.ADMIN));
            assertTrue(e.getMessage().contains("enable booking"));
            verify(publicBookingService, never()).book(anyString(), anyString(), any(), anyString(), anyBoolean());
        }

        @Test
        @DisplayName("refuses a learner with no email and no phone rather than booking silently")
        void refusesUnreachableLearner() {
            mentorWithBookingPage();
            studentExists(null, null);

            VacademyException e = assertThrows(VacademyException.class,
                    () -> service.scheduleSession(INSTITUTE, caller("admin-1"), request(),
                            MentorSessionService.SessionActor.ADMIN));
            assertTrue(e.getMessage().contains("no email or phone"));
            verify(publicBookingService, never()).book(anyString(), anyString(), any(), anyString(), anyBoolean());
        }

        @Test
        @DisplayName("requires a mentor id")
        void requiresMentorId() {
            ScheduleSessionRequest req = request();
            req.setMentorId(null);
            assertThrows(VacademyException.class,
                    () -> service.scheduleSession(INSTITUTE, caller("admin-1"), req,
                            MentorSessionService.SessionActor.ADMIN));
        }
    }

    @Nested
    @DisplayName("mentor scheduling")
    class MentorSchedules {

        @Test
        @DisplayName("books on their own page even if the request names another mentor")
        void ignoresRequestedMentorId() {
            mentorWithBookingPage();
            studentExists("ravi@example.com", null);
            bookingSucceeds();
            when(assignmentRepository.findByInstituteIdAndMentorIdAndStudentUserIdAndStatus(
                    INSTITUTE, MENTOR_ID, STUDENT, "ACTIVE"))
                    .thenReturn(Optional.of(new MentorStudentAssignment()));

            ScheduleSessionRequest req = request();
            req.setMentorId("someone-elses-mentor-id");

            service.scheduleSession(INSTITUTE, caller(MENTOR_USER), req,
                    MentorSessionService.SessionActor.MENTOR);

            verify(publicBookingService).book(eq(INSTITUTE), eq("asha-1-1"), any(), eq(STUDENT), eq(true));
        }

        @Test
        @DisplayName("refuses a learner who isn't one of their mentees")
        void refusesNonMentee() {
            mentorWithBookingPage();
            when(assignmentRepository.findByInstituteIdAndMentorIdAndStudentUserIdAndStatus(
                    INSTITUTE, MENTOR_ID, STUDENT, "ACTIVE"))
                    .thenReturn(Optional.empty());

            VacademyException e = assertThrows(VacademyException.class,
                    () -> service.scheduleSession(INSTITUTE, caller(MENTOR_USER), request(),
                            MentorSessionService.SessionActor.MENTOR));
            assertTrue(e.getMessage().contains("not one of your mentees"));
            verify(publicBookingService, never()).book(anyString(), anyString(), any(), anyString(), anyBoolean());
        }
    }

    @Nested
    @DisplayName("learner acting on their own sessions")
    class LearnerActs {

        private BookingInstance sessionInvitedTo(String inviteeUserId) {
            BookingInstance b = new BookingInstance();
            b.setId("b1");
            b.setInstituteId(INSTITUTE);
            b.setHostUserId(MENTOR_USER);
            b.setInviteeUserId(inviteeUserId);
            b.setStatus("CONFIRMED");
            b.setScheduledStartUtc(Timestamp.from(Instant.now().plus(Duration.ofDays(1))));
            when(bookingInstanceRepository.findById("b1")).thenReturn(Optional.of(b));
            when(mentorRepository.findByInstituteIdAndUserIdAndStatusNot(eq(INSTITUTE), eq(MENTOR_USER), anyString()))
                    .thenReturn(Optional.of(Mentor.builder().id(MENTOR_ID).instituteId(INSTITUTE)
                            .userId(MENTOR_USER).status("ACTIVE").build()));
            when(bookingInstanceRepository.findForInstituteInWindow(eq(INSTITUTE), any(), any()))
                    .thenReturn(List.of());
            when(mentorRepository.findByInstituteIdAndUserIdInAndStatusNot(eq(INSTITUTE), anyList(), anyString()))
                    .thenReturn(List.of());
            return b;
        }

        @Test
        @DisplayName("the invitee may cancel their own session")
        void inviteeCancels() {
            BookingInstance booking = sessionInvitedTo(STUDENT);

            service.cancelSession(INSTITUTE, caller(STUDENT), "b1", "Clash",
                    MentorSessionService.SessionActor.STUDENT);

            verify(publicBookingService).cancelInstance(eq(booking), eq("Clash"));
        }

        @Test
        @DisplayName("someone else's session is reported as not found, not as forbidden")
        void otherLearnerRefused() {
            sessionInvitedTo("stu-other");

            VacademyException e = assertThrows(VacademyException.class,
                    () -> service.cancelSession(INSTITUTE, caller(STUDENT), "b1", null,
                            MentorSessionService.SessionActor.STUDENT));
            assertEquals("Session not found", e.getMessage());
            verify(publicBookingService, never()).cancelInstance(any(), any());
        }

        @Test
        @DisplayName("a guest booking with no invitee user id is not claimable by any learner")
        void guestBookingNotClaimable() {
            sessionInvitedTo(null);

            assertThrows(VacademyException.class,
                    () -> service.cancelSession(INSTITUTE, caller(STUDENT), "b1", null,
                            MentorSessionService.SessionActor.STUDENT));
        }
    }

    @Nested
    @DisplayName("learner session list")
    class LearnerList {

        @Test
        @DisplayName("strips the mentor's private notes")
        void stripsNotes() {
            BookingInstance b = new BookingInstance();
            b.setId("b1");
            b.setInstituteId(INSTITUTE);
            b.setHostUserId(MENTOR_USER);
            b.setInviteeUserId(STUDENT);
            b.setStatus("CONFIRMED");
            b.setScheduledStartUtc(Timestamp.from(Instant.now().minus(Duration.ofDays(1))));
            when(bookingInstanceRepository.findForInstituteInWindow(eq(INSTITUTE), any(), any()))
                    .thenReturn(List.of(b));
            when(mentorRepository.findByInstituteIdAndUserIdInAndStatusNot(eq(INSTITUTE), anyList(), anyString()))
                    .thenReturn(List.of(Mentor.builder().id(MENTOR_ID).instituteId(INSTITUTE)
                            .userId(MENTOR_USER).displayName("Asha").status("ACTIVE").build()));
            when(recordRepository.findByBookingInstanceIdIn(anyList())).thenReturn(List.of(
                    vacademy.io.admin_core_service.features.mentorship.entity.MentorSessionRecord.builder()
                            .bookingInstanceId("b1")
                            .outcome("COMPLETED")
                            .topic("Revision plan")
                            .notes("Struggles with trigonometry; parents unaware")
                            .build()));
            when(feedbackRepository.findByBookingInstanceIdIn(anyList())).thenReturn(List.of());

            var sessions = service.sessionsForStudent(INSTITUTE, STUDENT, null);

            assertEquals(1, sessions.size());
            assertNull(sessions.get(0).getNotes());
            // The topic is deliberately kept — it tells the learner what the session covered.
            assertEquals("Revision plan", sessions.get(0).getTopic());
        }
    }
}
