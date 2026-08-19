package vacademy.io.admin_core_service.features.mentorship.scheduler;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import net.javacrumbs.shedlock.spring.annotation.SchedulerLock;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import vacademy.io.admin_core_service.features.booking.entity.BookingInstance;
import vacademy.io.admin_core_service.features.booking.entity.BookingPage;
import vacademy.io.admin_core_service.features.booking.repository.BookingInstanceRepository;
import vacademy.io.admin_core_service.features.booking.repository.BookingPageRepository;
import vacademy.io.admin_core_service.features.mentorship.entity.Mentor;
import vacademy.io.admin_core_service.features.mentorship.entity.MentorStudentAssignment;
import vacademy.io.admin_core_service.features.mentorship.entity.MentorshipNotificationLog;
import vacademy.io.admin_core_service.features.mentorship.enums.MentorStatus;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorRepository;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorStudentAssignmentRepository;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorshipNotificationLogRepository;
import vacademy.io.admin_core_service.features.mentorship.service.MentorshipErrorReporter;
import vacademy.io.admin_core_service.features.mentorship.service.MentorshipNotificationService;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;

/**
 * Scheduler behind the two time-based mentorship triggers:
 *
 * <ul>
 *   <li><b>session_reminder</b> — one reminder per booked mentor session, sent to the
 *       invitee once the session is within the institute's configured lead time
 *       (default 24h). Sessions booked inside the lead window are skipped — the
 *       booking confirmation just covered them.</li>
 *   <li><b>checkin_reminder</b> — a nudge to students who haven't had a session with
 *       their mentor for the institute's inactivity window (default 14 days), at most
 *       once per window. Opt-in per institute (master flag defaults off).</li>
 * </ul>
 *
 * ShedLock keeps each job single-flight across replicas; the
 * {@code mentorship_notification_log} ledger keeps sends idempotent across ticks
 * (rows are claimed BEFORE dispatch, so a crash mid-send drops one notification
 * rather than ever double-sending). Channel/message config is the institute's
 * {@code MENTORSHIP_SETTING} blob, resolved by {@link MentorshipNotificationService}.
 */
@Component
@RequiredArgsConstructor
@Slf4j
public class MentorshipReminderScheduler {

    public static final String TYPE_SESSION_REMINDER = "SESSION_REMINDER";
    public static final String TYPE_CHECKIN_NUDGE = "CHECKIN_NUDGE";

    private static final List<String> INACTIVE_BOOKING_STATUSES = List.of("CANCELLED", "RESCHEDULED");
    /** Candidate-fetch horizon; also the cap on the admin-configurable lead time. */
    private static final int MAX_LEAD_HOURS = 168;
    private static final DateTimeFormatter WHEN_FORMAT =
            DateTimeFormatter.ofPattern("EEE, dd MMM yyyy 'at' HH:mm");

    private final BookingInstanceRepository bookingInstanceRepository;
    private final BookingPageRepository bookingPageRepository;
    private final MentorRepository mentorRepository;
    private final MentorStudentAssignmentRepository assignmentRepository;
    private final MentorshipNotificationLogRepository logRepository;
    private final MentorshipNotificationService notificationService;

    /** Every 10 minutes: reminders for mentor sessions entering their lead window. */
    @Scheduled(cron = "0 */10 * * * *", zone = "UTC")
    @SchedulerLock(name = "MentorshipSessionReminderJob", lockAtMostFor = "PT9M", lockAtLeastFor = "PT30S")
    public void sendSessionReminders() {
        Instant now = Instant.now();
        List<BookingInstance> candidates = bookingInstanceRepository
                .findByStatusNotInAndScheduledStartUtcBetween(INACTIVE_BOOKING_STATUSES,
                        Timestamp.from(now), Timestamp.from(now.plus(Duration.ofHours(MAX_LEAD_HOURS))));
        if (candidates.isEmpty()) return;

        Map<String, Boolean> enabledByInstitute = new HashMap<>();
        Map<String, Integer> hoursByInstitute = new HashMap<>();
        Map<String, Optional<Mentor>> mentorByHost = new HashMap<>();
        int sent = 0;
        for (BookingInstance booking : candidates) {
            try {
                String instituteId = booking.getInstituteId();
                if (!enabledByInstitute.computeIfAbsent(instituteId,
                        id -> notificationService.triggerEnabled(id, "session_reminder", true))) continue;
                int hoursBefore = hoursByInstitute.computeIfAbsent(instituteId,
                        notificationService::sessionReminderHoursBefore);
                Instant start = booking.getScheduledStartUtc().toInstant();
                if (start.isAfter(now.plus(Duration.ofHours(hoursBefore)))) continue; // not due yet
                // Booked inside the lead window → confirmation email just covered it.
                Instant windowEntry = start.minus(Duration.ofHours(hoursBefore));
                if (booking.getCreatedAt() != null && booking.getCreatedAt().toInstant().isAfter(windowEntry)) continue;

                Mentor mentor = mentorByHost.computeIfAbsent(instituteId + "|" + booking.getHostUserId(),
                        k -> mentorRepository.findByInstituteIdAndUserIdAndStatusNot(
                                instituteId, booking.getHostUserId(), MentorStatus.DELETED.name()))
                        .orElse(null);
                if (mentor == null) continue; // not a mentorship booking

                if (logRepository.existsByNotificationTypeAndRefId(TYPE_SESSION_REMINDER, booking.getId())) continue;
                if (!claim(instituteId, TYPE_SESSION_REMINDER, booking.getId())) continue;

                BookingPage page = booking.getBookingPageId() == null ? null
                        : bookingPageRepository.findById(booking.getBookingPageId()).orElse(null);
                notificationService.notifySessionReminder(instituteId, mentor.getDisplayName(),
                        booking.getInviteeUserId(), booking.getInviteeEmail(), booking.getInviteePhone(),
                        booking.getInviteeName(), titleOf(page), whenTextOf(booking, page));
                sent++;
            } catch (Exception e) {
                log.warn("mentorship session reminder skipped for booking {}: {}", booking.getId(), e.getMessage());
                // A skipped booking means one learner silently never got their reminder.
                MentorshipErrorReporter.report(e, "scheduler-session-reminder",
                        booking.getInstituteId(), Map.of("booking_id", String.valueOf(booking.getId())));
            }
        }
        if (sent > 0) log.info("mentorship session reminders sent: {}", sent);
    }

    /** Daily at 03:30 UTC (~09:00 IST): check-in nudges for inactive mentorship pairs. */
    @Scheduled(cron = "0 30 3 * * *", zone = "UTC")
    @SchedulerLock(name = "MentorshipCheckinNudgeJob", lockAtMostFor = "PT30M", lockAtLeastFor = "PT1M")
    public void sendCheckinNudges() {
        Instant now = Instant.now();
        List<MentorStudentAssignment> assignments = assignmentRepository.findByStatus("ACTIVE");
        if (assignments.isEmpty()) return;

        Map<String, Boolean> enabledByInstitute = new HashMap<>();
        Map<String, Integer> daysByInstitute = new HashMap<>();
        Map<String, Optional<Mentor>> mentorById = new HashMap<>();
        int sent = 0;
        for (MentorStudentAssignment assignment : assignments) {
            try {
                String instituteId = assignment.getInstituteId();
                if (!enabledByInstitute.computeIfAbsent(instituteId,
                        id -> notificationService.triggerEnabled(id, "checkin_reminder", false))) continue;
                int days = daysByInstitute.computeIfAbsent(instituteId,
                        notificationService::checkinInactivityDays);
                Instant cutoff = now.minus(Duration.ofDays(days));
                // Fresh assignments get their first window quietly — the assignment email just went out.
                if (assignment.getCreatedAt() == null || assignment.getCreatedAt().toInstant().isAfter(cutoff)) continue;
                // A session after the cutoff — recent past or scheduled ahead — counts as connected.
                if (bookingInstanceRepository.existsByHostUserIdAndInviteeUserIdAndStatusNotInAndScheduledStartUtcAfter(
                        assignment.getMentorUserId(), assignment.getStudentUserId(),
                        INACTIVE_BOOKING_STATUSES, Timestamp.from(cutoff))) continue;
                // At most one nudge per inactivity window.
                Timestamp lastNudge = logRepository.lastSentAt(TYPE_CHECKIN_NUDGE, assignment.getId());
                if (lastNudge != null && lastNudge.toInstant().isAfter(cutoff)) continue;

                Mentor mentor = mentorById.computeIfAbsent(assignment.getMentorId(),
                        id -> mentorRepository.findById(id)
                                .filter(m -> !MentorStatus.DELETED.name().equals(m.getStatus())))
                        .orElse(null);
                if (mentor == null) continue;

                if (!claim(instituteId, TYPE_CHECKIN_NUDGE, assignment.getId())) continue;
                notificationService.notifyCheckinReminder(instituteId, assignment.getStudentUserId(),
                        mentor.getDisplayName());
                sent++;
            } catch (Exception e) {
                log.warn("mentorship check-in nudge skipped for assignment {}: {}", assignment.getId(), e.getMessage());
                MentorshipErrorReporter.report(e, "scheduler-checkin-nudge",
                        assignment.getInstituteId(), Map.of("assignment_id", String.valueOf(assignment.getId())));
            }
        }
        if (sent > 0) log.info("mentorship check-in nudges sent: {}", sent);
    }

    /**
     * Insert the ledger row before dispatch. False (skip the send) when the insert
     * fails — for SESSION_REMINDER the partial unique index makes a cross-pod race
     * lose here instead of double-sending.
     */
    private boolean claim(String instituteId, String type, String refId) {
        try {
            logRepository.save(MentorshipNotificationLog.builder()
                    .instituteId(instituteId)
                    .notificationType(type)
                    .refId(refId)
                    .build());
            return true;
        } catch (Exception e) {
            log.warn("mentorship notification claim failed ({} {}): {}", type, refId, e.getMessage());
            // A failed claim drops the notification entirely — the ledger row is the
            // send permit, so nothing else will retry it.
            MentorshipErrorReporter.report(e, "notification-claim", instituteId,
                    Map.of("notification_type", String.valueOf(type), "ref_id", String.valueOf(refId)));
            return false;
        }
    }

    private static String titleOf(BookingPage page) {
        return page != null && page.getTitle() != null && !page.getTitle().isBlank()
                ? page.getTitle() : "Mentor session";
    }

    /** Session start in the invitee's timezone (falling back to the page's, then IST) — mirrors booking emails. */
    private static String whenTextOf(BookingInstance booking, BookingPage page) {
        ZoneId zone;
        try {
            String tz = booking.getInviteeTimezone() != null && !booking.getInviteeTimezone().isBlank()
                    ? booking.getInviteeTimezone()
                    : (page != null && page.getTimezone() != null && !page.getTimezone().isBlank()
                        ? page.getTimezone() : "Asia/Kolkata");
            zone = ZoneId.of(tz);
        } catch (Exception e) {
            zone = ZoneId.of("Asia/Kolkata");
        }
        return booking.getScheduledStartUtc().toInstant().atZone(zone).format(WHEN_FORMAT)
                + " (" + zone.getId() + ")";
    }
}
