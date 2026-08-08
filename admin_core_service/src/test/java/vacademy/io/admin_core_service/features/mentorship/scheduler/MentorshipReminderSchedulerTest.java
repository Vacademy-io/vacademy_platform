package vacademy.io.admin_core_service.features.mentorship.scheduler;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.InOrder;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.mockito.junit.jupiter.MockitoSettings;
import org.mockito.quality.Strictness;
import vacademy.io.admin_core_service.features.booking.entity.BookingInstance;
import vacademy.io.admin_core_service.features.booking.entity.BookingPage;
import vacademy.io.admin_core_service.features.booking.repository.BookingInstanceRepository;
import vacademy.io.admin_core_service.features.booking.repository.BookingPageRepository;
import vacademy.io.admin_core_service.features.mentorship.entity.Mentor;
import vacademy.io.admin_core_service.features.mentorship.entity.MentorStudentAssignment;
import vacademy.io.admin_core_service.features.mentorship.entity.MentorshipNotificationLog;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorRepository;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorStudentAssignmentRepository;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorshipNotificationLogRepository;
import vacademy.io.admin_core_service.features.mentorship.service.MentorshipNotificationService;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.times;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/**
 * Edge cases of the two time-based mentorship jobs. Pinned behaviors:
 * one reminder per booking exactly when it enters the lead window (never for
 * bookings created inside it), claim-before-send idempotency, and the check-in
 * nudge's opt-in + inactivity + cadence guards.
 */
@ExtendWith(MockitoExtension.class)
@MockitoSettings(strictness = Strictness.LENIENT)
class MentorshipReminderSchedulerTest {

    private static final String INSTITUTE = "inst-1";
    private static final Instant NOW = Instant.now();

    @Mock private BookingInstanceRepository bookingInstanceRepository;
    @Mock private BookingPageRepository bookingPageRepository;
    @Mock private MentorRepository mentorRepository;
    @Mock private MentorStudentAssignmentRepository assignmentRepository;
    @Mock private MentorshipNotificationLogRepository logRepository;
    @Mock private MentorshipNotificationService notificationService;

    @InjectMocks private MentorshipReminderScheduler scheduler;

    private Mentor mentor;

    @BeforeEach
    void defaults() {
        mentor = Mentor.builder().id("m-1").instituteId(INSTITUTE).userId("host-1")
                .displayName("Anjali Sharma").status("ACTIVE").build();
        when(notificationService.triggerEnabled(INSTITUTE, "session_reminder", true)).thenReturn(true);
        when(notificationService.sessionReminderHoursBefore(INSTITUTE)).thenReturn(24);
        when(notificationService.triggerEnabled(INSTITUTE, "checkin_reminder", false)).thenReturn(true);
        when(notificationService.checkinInactivityDays(INSTITUTE)).thenReturn(14);
        when(mentorRepository.findByInstituteIdAndUserIdAndStatusNot(INSTITUTE, "host-1", "DELETED"))
                .thenReturn(Optional.of(mentor));
        when(mentorRepository.findById("m-1")).thenReturn(Optional.of(mentor));
        when(logRepository.existsByNotificationTypeAndRefId(anyString(), anyString())).thenReturn(false);
        when(logRepository.lastSentAt(anyString(), anyString())).thenReturn(null);
        when(bookingInstanceRepository
                .existsByHostUserIdAndInviteeUserIdAndStatusNotInAndScheduledStartUtcAfter(
                        anyString(), anyString(), any(), any(Timestamp.class)))
                .thenReturn(false);
    }

    private BookingInstance booking(String id, Instant start, Instant createdAt) {
        return BookingInstance.builder()
                .id(id).instituteId(INSTITUTE).hostUserId("host-1")
                .liveSessionId("ls-" + id)
                .inviteeUserId("stud-1").inviteeEmail("s@x.com").inviteeName("Stu Dent")
                .scheduledStartUtc(Timestamp.from(start))
                .scheduledEndUtc(Timestamp.from(start.plus(Duration.ofMinutes(30))))
                .status("CONFIRMED")
                .createdAt(createdAt == null ? null : Timestamp.from(createdAt))
                .build();
    }

    private void candidates(BookingInstance... bookings) {
        when(bookingInstanceRepository.findByStatusNotInAndScheduledStartUtcBetween(
                any(), any(Timestamp.class), any(Timestamp.class)))
                .thenReturn(List.of(bookings));
    }

    private MentorStudentAssignment assignment(String id, Instant createdAt) {
        return MentorStudentAssignment.builder()
                .id(id).instituteId(INSTITUTE).mentorId("m-1").mentorUserId("host-1")
                .studentUserId("stud-1").assignmentMethod("MANUAL").status("ACTIVE")
                .createdAt(createdAt == null ? null : Timestamp.from(createdAt))
                .build();
    }

    // ------------------------------------------------------------ session reminder

    @Test
    @DisplayName("due booking → claims the ledger row BEFORE sending, then notifies")
    void dueBookingClaimsThenSends() {
        candidates(booking("b-1", NOW.plus(Duration.ofHours(2)), NOW.minus(Duration.ofDays(3))));

        scheduler.sendSessionReminders();

        InOrder order = inOrder(logRepository, notificationService);
        ArgumentCaptor<MentorshipNotificationLog> claim =
                ArgumentCaptor.forClass(MentorshipNotificationLog.class);
        order.verify(logRepository).save(claim.capture());
        order.verify(notificationService).notifySessionReminder(
                eq(INSTITUTE), eq("Anjali Sharma"), eq("stud-1"), eq("s@x.com"),
                any(), eq("Stu Dent"), eq("Mentor session"), anyString());
        assertEquals("SESSION_REMINDER", claim.getValue().getNotificationType());
        assertEquals("b-1", claim.getValue().getRefId());
        assertEquals(INSTITUTE, claim.getValue().getInstituteId());
    }

    @Test
    @DisplayName("booking outside the lead window is not yet due")
    void notYetDueSkips() {
        candidates(booking("b-1", NOW.plus(Duration.ofHours(48)), NOW.minus(Duration.ofDays(3))));

        scheduler.sendSessionReminders();

        verify(logRepository, never()).save(any());
        verify(notificationService, never()).notifySessionReminder(
                anyString(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("booking created inside the lead window is skipped — confirmation just covered it")
    void bookedInsideWindowSkips() {
        candidates(booking("b-1", NOW.plus(Duration.ofHours(2)), NOW.minus(Duration.ofHours(1))));

        scheduler.sendSessionReminders();

        verify(notificationService, never()).notifySessionReminder(
                anyString(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("null createdAt (legacy row) is treated as an old booking and still reminded")
    void nullCreatedAtStillSends() {
        candidates(booking("b-1", NOW.plus(Duration.ofHours(2)), null));

        scheduler.sendSessionReminders();

        verify(notificationService).notifySessionReminder(
                anyString(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("institute with the trigger disabled never reaches the mentor lookup")
    void disabledInstituteSkips() {
        when(notificationService.triggerEnabled(INSTITUTE, "session_reminder", true)).thenReturn(false);
        candidates(booking("b-1", NOW.plus(Duration.ofHours(2)), NOW.minus(Duration.ofDays(3))));

        scheduler.sendSessionReminders();

        verify(mentorRepository, never()).findByInstituteIdAndUserIdAndStatusNot(any(), any(), any());
        verify(notificationService, never()).notifySessionReminder(
                anyString(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("non-mentor host (ordinary booking) is ignored")
    void nonMentorHostSkips() {
        when(mentorRepository.findByInstituteIdAndUserIdAndStatusNot(INSTITUTE, "host-1", "DELETED"))
                .thenReturn(Optional.empty());
        candidates(booking("b-1", NOW.plus(Duration.ofHours(2)), NOW.minus(Duration.ofDays(3))));

        scheduler.sendSessionReminders();

        verify(logRepository, never()).save(any());
        verify(notificationService, never()).notifySessionReminder(
                anyString(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("already-reminded booking is not re-sent")
    void alreadyRemindedSkips() {
        when(logRepository.existsByNotificationTypeAndRefId("SESSION_REMINDER", "b-1")).thenReturn(true);
        candidates(booking("b-1", NOW.plus(Duration.ofHours(2)), NOW.minus(Duration.ofDays(3))));

        scheduler.sendSessionReminders();

        verify(logRepository, never()).save(any());
        verify(notificationService, never()).notifySessionReminder(
                anyString(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("losing the claim race (unique index) suppresses the send — never double-notifies")
    void claimFailureSuppressesSend() {
        when(logRepository.save(any())).thenThrow(new RuntimeException("duplicate key"));
        candidates(booking("b-1", NOW.plus(Duration.ofHours(2)), NOW.minus(Duration.ofDays(3))));

        scheduler.sendSessionReminders();

        verify(notificationService, never()).notifySessionReminder(
                anyString(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("one poisoned booking doesn't stop the rest of the sweep")
    void poisonedBookingDoesNotStopSweep() {
        BookingInstance bad = booking("b-bad", NOW.plus(Duration.ofHours(2)), NOW.minus(Duration.ofDays(3)));
        bad.setScheduledStartUtc(null); // NPE inside the loop body
        BookingInstance good = booking("b-good", NOW.plus(Duration.ofHours(2)), NOW.minus(Duration.ofDays(3)));
        candidates(bad, good);

        scheduler.sendSessionReminders();

        verify(notificationService, times(1)).notifySessionReminder(
                anyString(), any(), any(), any(), any(), any(), any(), any());
    }

    @Test
    @DisplayName("booking-page title and timezone flow into the notification")
    void pageTitleAndInviteeTimezoneUsed() {
        BookingInstance b = booking("b-1", NOW.plus(Duration.ofHours(2)), NOW.minus(Duration.ofDays(3)));
        b.setBookingPageId("bp-1");
        b.setInviteeTimezone("America/New_York");
        when(bookingPageRepository.findById("bp-1")).thenReturn(Optional.of(
                BookingPage.builder().id("bp-1").title("Career guidance").timezone("Asia/Kolkata").build()));
        candidates(b);

        ArgumentCaptor<String> title = ArgumentCaptor.forClass(String.class);
        ArgumentCaptor<String> when = ArgumentCaptor.forClass(String.class);
        scheduler.sendSessionReminders();
        verify(notificationService).notifySessionReminder(
                eq(INSTITUTE), eq("Anjali Sharma"), eq("stud-1"), eq("s@x.com"),
                any(), eq("Stu Dent"), title.capture(), when.capture());
        assertEquals("Career guidance", title.getValue());
        assertTrue(when.getValue().endsWith("(America/New_York)"),
                "invitee timezone should win: " + when.getValue());
    }

    @Test
    @DisplayName("invalid invitee timezone falls back to IST")
    void invalidTimezoneFallsBackToIst() {
        BookingInstance b = booking("b-1", NOW.plus(Duration.ofHours(2)), NOW.minus(Duration.ofDays(3)));
        b.setInviteeTimezone("Mars/Base");
        candidates(b);

        ArgumentCaptor<String> when = ArgumentCaptor.forClass(String.class);
        scheduler.sendSessionReminders();
        verify(notificationService).notifySessionReminder(
                anyString(), any(), any(), any(), any(), any(), any(), when.capture());
        assertTrue(when.getValue().endsWith("(Asia/Kolkata)"), when.getValue());
    }

    // ------------------------------------------------------------- check-in nudge

    @Test
    @DisplayName("inactive pair past the window → claims then nudges with the mentor's name")
    void inactivePairNudged() {
        when(assignmentRepository.findByStatus("ACTIVE"))
                .thenReturn(List.of(assignment("a-1", NOW.minus(Duration.ofDays(30)))));

        scheduler.sendCheckinNudges();

        InOrder order = inOrder(logRepository, notificationService);
        ArgumentCaptor<MentorshipNotificationLog> claim =
                ArgumentCaptor.forClass(MentorshipNotificationLog.class);
        order.verify(logRepository).save(claim.capture());
        order.verify(notificationService).notifyCheckinReminder(INSTITUTE, "stud-1", "Anjali Sharma");
        assertEquals("CHECKIN_NUDGE", claim.getValue().getNotificationType());
        assertEquals("a-1", claim.getValue().getRefId());
    }

    @Test
    @DisplayName("check-in nudge is opt-in: institute without the flag never nudges")
    void checkinDefaultOff() {
        when(notificationService.triggerEnabled(INSTITUTE, "checkin_reminder", false)).thenReturn(false);
        when(assignmentRepository.findByStatus("ACTIVE"))
                .thenReturn(List.of(assignment("a-1", NOW.minus(Duration.ofDays(30)))));

        scheduler.sendCheckinNudges();

        verify(notificationService, never()).notifyCheckinReminder(any(), any(), any());
    }

    @Test
    @DisplayName("fresh assignment gets its first window quietly")
    void freshAssignmentSkipped() {
        when(assignmentRepository.findByStatus("ACTIVE"))
                .thenReturn(List.of(assignment("a-1", NOW.minus(Duration.ofDays(5)))));

        scheduler.sendCheckinNudges();

        verify(notificationService, never()).notifyCheckinReminder(any(), any(), any());
    }

    @Test
    @DisplayName("assignment with null createdAt is skipped, not nudged")
    void nullCreatedAtAssignmentSkipped() {
        when(assignmentRepository.findByStatus("ACTIVE"))
                .thenReturn(List.of(assignment("a-1", null)));

        scheduler.sendCheckinNudges();

        verify(notificationService, never()).notifyCheckinReminder(any(), any(), any());
    }

    @Test
    @DisplayName("a session after the cutoff — past or scheduled ahead — counts as connected")
    void recentSessionSuppressesNudge() {
        when(bookingInstanceRepository
                .existsByHostUserIdAndInviteeUserIdAndStatusNotInAndScheduledStartUtcAfter(
                        eq("host-1"), eq("stud-1"), any(), any(Timestamp.class)))
                .thenReturn(true);
        when(assignmentRepository.findByStatus("ACTIVE"))
                .thenReturn(List.of(assignment("a-1", NOW.minus(Duration.ofDays(30)))));

        scheduler.sendCheckinNudges();

        verify(notificationService, never()).notifyCheckinReminder(any(), any(), any());
    }

    @Test
    @DisplayName("at most one nudge per inactivity window")
    void recentNudgeSuppressesRenudge() {
        when(logRepository.lastSentAt("CHECKIN_NUDGE", "a-1"))
                .thenReturn(Timestamp.from(NOW.minus(Duration.ofDays(3))));
        when(assignmentRepository.findByStatus("ACTIVE"))
                .thenReturn(List.of(assignment("a-1", NOW.minus(Duration.ofDays(30)))));

        scheduler.sendCheckinNudges();

        verify(notificationService, never()).notifyCheckinReminder(any(), any(), any());
    }

    @Test
    @DisplayName("after the window elapses again, the pair is re-nudged")
    void renudgeAfterWindowElapses() {
        when(logRepository.lastSentAt("CHECKIN_NUDGE", "a-1"))
                .thenReturn(Timestamp.from(NOW.minus(Duration.ofDays(20))));
        when(assignmentRepository.findByStatus("ACTIVE"))
                .thenReturn(List.of(assignment("a-1", NOW.minus(Duration.ofDays(60)))));

        scheduler.sendCheckinNudges();

        verify(notificationService).notifyCheckinReminder(INSTITUTE, "stud-1", "Anjali Sharma");
    }

    @Test
    @DisplayName("soft-deleted mentor row suppresses the nudge")
    void deletedMentorSkipped() {
        mentor.setStatus("DELETED");
        when(assignmentRepository.findByStatus("ACTIVE"))
                .thenReturn(List.of(assignment("a-1", NOW.minus(Duration.ofDays(30)))));

        scheduler.sendCheckinNudges();

        verify(notificationService, never()).notifyCheckinReminder(any(), any(), any());
        verify(logRepository, never()).save(any());
    }

    @Test
    @DisplayName("losing the check-in claim suppresses the nudge")
    void checkinClaimFailureSuppressesSend() {
        when(logRepository.save(any())).thenThrow(new RuntimeException("duplicate key"));
        when(assignmentRepository.findByStatus("ACTIVE"))
                .thenReturn(List.of(assignment("a-1", NOW.minus(Duration.ofDays(30)))));

        scheduler.sendCheckinNudges();

        verify(notificationService, never()).notifyCheckinReminder(any(), any(), any());
    }
}
