package vacademy.io.admin_core_service.features.mentorship.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.auth_service.service.AuthService;
import vacademy.io.admin_core_service.features.booking.entity.BookingInstance;
import vacademy.io.admin_core_service.features.booking.entity.BookingPage;
import vacademy.io.admin_core_service.features.booking.repository.BookingInstanceRepository;
import vacademy.io.admin_core_service.features.booking.repository.BookingPageRepository;
import vacademy.io.admin_core_service.features.booking.dto.PublicBookingDTOs;
import vacademy.io.admin_core_service.features.booking.service.PublicBookingService;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorSessionDTOs.ScheduleSessionRequest;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorSessionDTOs.MentorSessionDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorSessionDTOs.RecordSessionRequest;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorSessionDTOs.SessionStatsDTO;
import vacademy.io.admin_core_service.features.mentorship.entity.Mentor;
import vacademy.io.admin_core_service.features.mentorship.entity.MentorSessionFeedback;
import vacademy.io.admin_core_service.features.mentorship.entity.MentorSessionRecord;
import vacademy.io.admin_core_service.features.mentorship.enums.MentorStatus;
import vacademy.io.admin_core_service.features.mentorship.enums.SessionOutcome;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorRepository;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorSessionFeedbackRepository;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorSessionRecordRepository;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorStudentAssignmentRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.sql.Timestamp;
import java.time.Duration;
import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneOffset;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Mentorship sessions: the mentor records what happened, and admins get the
 * session-level visibility the dashboard previously lacked.
 *
 * <p>Deliberately builds on what already exists rather than adding a session
 * entity: the session IS a {@code booking_instance} (created by the existing
 * booking flow, hosted by the mentor, with the existing meet link and reminders).
 * This layer only joins that with the mentorship-side facts —
 * {@code mentor_session_record} (mentor's outcome/notes) and
 * {@code mentor_session_feedback} (learner's rating) — and resolves identities.
 *
 * <p>Booking status and session outcome are separate on purpose: a CONFIRMED
 * booking can still be a NO_SHOW, and cancelling is an appointment-level fact that
 * non-mentorship bookings share.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MentorSessionService {

    /** Who is asking to act on a session, and therefore what they are allowed to touch. */
    public enum SessionActor {
        /** Institute admin — may act on any mentorship session in their institute. */
        ADMIN,
        /** A mentor — may act only on sessions they host. */
        MENTOR,
        /** A learner — may act only on sessions they are the invitee of. */
        STUDENT
    }

    /** Appointment states that mean the session never happened. */
    private static final Set<String> INACTIVE_BOOKING_STATUSES = Set.of("CANCELLED", "RESCHEDULED");
    /** How far back the admin session list and stats look by default. */
    private static final int DEFAULT_HISTORY_DAYS = 90;
    private static final int MAX_NOTES_LENGTH = 5000;

    private final MentorSessionRecordRepository recordRepository;
    private final MentorSessionFeedbackRepository feedbackRepository;
    private final BookingInstanceRepository bookingInstanceRepository;
    private final BookingPageRepository bookingPageRepository;
    private final MentorRepository mentorRepository;
    private final PublicBookingService publicBookingService;
    private final AuthService authService;
    private final MentorStudentAssignmentRepository assignmentRepository;

    // ============================== mentor: record an outcome ==============================

    /**
     * The mentor records what happened. Re-recording revises the existing row, so a
     * mentor can correct a mis-tap without creating a second record.
     */
    @Transactional
    public MentorSessionDTO record(String instituteId, CustomUserDetails user, RecordSessionRequest req) {
        if (req == null || req.getBookingInstanceId() == null || req.getBookingInstanceId().isBlank()) {
            throw new VacademyException("bookingInstanceId is required");
        }
        SessionOutcome outcome;
        try {
            outcome = SessionOutcome.valueOf(String.valueOf(req.getOutcome()).trim().toUpperCase());
        } catch (Exception e) {
            throw new VacademyException("Outcome must be COMPLETED or NO_SHOW");
        }

        BookingInstance booking = bookingInstanceRepository.findById(req.getBookingInstanceId())
                .filter(b -> instituteId.equals(b.getInstituteId()))
                .orElseThrow(() -> new VacademyException("Session not found"));
        // Only the mentor who hosted it may record it.
        Mentor mentor = mentorRepository
                .findByInstituteIdAndUserIdAndStatusNot(instituteId, user.getUserId(), MentorStatus.DELETED.name())
                .orElseThrow(() -> new VacademyException("You are not a mentor in this institute"));
        if (!user.getUserId().equals(booking.getHostUserId())) {
            throw new VacademyException("Session not found");
        }
        if (INACTIVE_BOOKING_STATUSES.contains(booking.getStatus())) {
            throw new VacademyException("That session was " + booking.getStatus().toLowerCase()
                    + ", so there is nothing to record");
        }
        if (booking.getScheduledStartUtc() == null
                || booking.getScheduledStartUtc().toInstant().isAfter(Instant.now())) {
            throw new VacademyException("You can record a session once it has taken place");
        }

        MentorSessionRecord record = recordRepository.findByBookingInstanceId(booking.getId())
                .orElseGet(() -> MentorSessionRecord.builder()
                        .instituteId(instituteId)
                        .bookingInstanceId(booking.getId())
                        .studentUserId(booking.getInviteeUserId())
                        .build());
        record.setMentorId(mentor.getId());
        record.setMentorUserId(mentor.getUserId());
        // A booking made by someone without an account has no invitee user id; keep
        // whatever the booking carries so the row stays consistent either way.
        if (record.getStudentUserId() == null) record.setStudentUserId(booking.getInviteeUserId());
        record.setOutcome(outcome.name());
        record.setTopic(trimTo(req.getTopic(), 500));
        record.setNotes(trimTo(req.getNotes(), MAX_NOTES_LENGTH));
        record.setMarkedByUserId(user.getUserId());
        record.setMarkedAt(Timestamp.from(Instant.now()));
        MentorSessionRecord saved = recordRepository.save(record);

        return toDTO(booking, mentor, saved, null,
                hydrate(List.of(mentor.getUserId(), safe(saved.getStudentUserId()))),
                new HashMap<>());
    }

    // ============================== admin: session visibility ==============================

    /**
     * Every mentorship session in a window, newest first, optionally narrowed to one
     * mentor or one learner. Reuses the booking module's institute-window query and
     * keeps only sessions hosted by a mentor, so ordinary meetings never leak in.
     *
     * @param lifecycle optional filter: COMPLETED | NO_SHOW | CANCELLED | UPCOMING | AWAITING_REVIEW
     */
    public List<MentorSessionDTO> sessions(String instituteId, String mentorId, String studentUserId,
                                           String lifecycle, Integer historyDays) {
        Instant now = Instant.now();
        int days = historyDays == null || historyDays <= 0 ? DEFAULT_HISTORY_DAYS : Math.min(historyDays, 730);
        Timestamp from = Timestamp.from(now.minus(Duration.ofDays(days)));
        // Look ahead far enough to include everything already on the books.
        Timestamp to = Timestamp.from(now.plus(Duration.ofDays(365)));

        List<BookingInstance> bookings = bookingInstanceRepository
                .findForInstituteInWindow(instituteId, from, to);
        if (bookings.isEmpty()) return List.of();

        // Host -> mentor. A booking whose host isn't a mentor is not a mentorship session.
        List<String> hostIds = bookings.stream().map(BookingInstance::getHostUserId)
                .filter(id -> id != null && !id.isBlank()).distinct().toList();
        if (hostIds.isEmpty()) return List.of();
        Map<String, Mentor> mentorByUser = mentorRepository
                .findByInstituteIdAndUserIdInAndStatusNot(instituteId, hostIds, MentorStatus.DELETED.name())
                .stream().collect(Collectors.toMap(Mentor::getUserId, m -> m, (a, b) -> a));
        if (mentorByUser.isEmpty()) return List.of();

        List<BookingInstance> mentorship = bookings.stream()
                .filter(b -> mentorByUser.containsKey(b.getHostUserId()))
                .filter(b -> mentorId == null || mentorId.isBlank()
                        || mentorId.equals(mentorByUser.get(b.getHostUserId()).getId()))
                .filter(b -> studentUserId == null || studentUserId.isBlank()
                        || studentUserId.equals(b.getInviteeUserId()))
                .collect(Collectors.toList());
        if (mentorship.isEmpty()) return List.of();

        List<String> bookingIds = mentorship.stream().map(BookingInstance::getId).toList();
        Map<String, MentorSessionRecord> records = recordRepository.findByBookingInstanceIdIn(bookingIds)
                .stream().collect(Collectors.toMap(MentorSessionRecord::getBookingInstanceId, r -> r, (a, b) -> a));
        // One rating per (session, learner); these are 1:1 sessions, so keying by
        // session is safe — and the first wins if a group session ever has several.
        Map<String, MentorSessionFeedback> feedback = feedbackRepository
                .findByBookingInstanceIdIn(bookingIds).stream()
                .collect(Collectors.toMap(MentorSessionFeedback::getBookingInstanceId, f -> f, (a1, b1) -> a1));

        List<String> userIds = new ArrayList<>();
        mentorship.forEach(b -> {
            userIds.add(b.getHostUserId());
            if (b.getInviteeUserId() != null) userIds.add(b.getInviteeUserId());
        });
        Map<String, UserDTO> users = hydrate(userIds);
        Map<String, String> pageTitles = new HashMap<>();

        return mentorship.stream()
                .map(b -> toDTO(b, mentorByUser.get(b.getHostUserId()), records.get(b.getId()),
                        feedback.get(b.getId()), users, pageTitles))
                .filter(dto -> lifecycle == null || lifecycle.isBlank()
                        || lifecycle.trim().equalsIgnoreCase(dto.getLifecycle()))
                .sorted(Comparator.comparing(
                        (MentorSessionDTO d) -> d.getScheduledStartUtc() == null ? 0L : d.getScheduledStartUtc())
                        .reversed())
                .collect(Collectors.toList());
    }

    /** Session counts for the admin dashboard, over the same window as the list. */
    public SessionStatsDTO stats(String instituteId) {
        List<MentorSessionDTO> all = sessions(instituteId, null, null, null, DEFAULT_HISTORY_DAYS);
        Instant now = Instant.now();
        LocalDate todayUtc = LocalDate.now(ZoneOffset.UTC);
        long todayStart = todayUtc.atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli();
        long todayEnd = todayUtc.plusDays(1).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli();
        long weekAhead = now.plus(Duration.ofDays(7)).toEpochMilli();

        int today = 0, upcoming = 0, completed = 0, cancelled = 0, noShow = 0, awaiting = 0;
        for (MentorSessionDTO s : all) {
            long start = s.getScheduledStartUtc() == null ? 0L : s.getScheduledStartUtc();
            boolean live = !INACTIVE_BOOKING_STATUSES.contains(s.getBookingStatus());
            if (live && start >= todayStart && start < todayEnd) today++;
            if (live && start >= now.toEpochMilli() && start <= weekAhead) upcoming++;
            switch (String.valueOf(s.getLifecycle())) {
                case "COMPLETED" -> completed++;
                case "NO_SHOW" -> noShow++;
                case "CANCELLED", "RESCHEDULED" -> cancelled++;
                case "AWAITING_REVIEW" -> awaiting++;
                default -> { }
            }
        }
        return SessionStatsDTO.builder()
                .today(today).upcoming(upcoming).completed(completed)
                .cancelled(cancelled).noShow(noShow).awaitingReview(awaiting)
                .build();
    }

    /** Sessions the calling mentor still has to record an outcome for. */
    public List<MentorSessionDTO> myAwaitingReview(String instituteId, CustomUserDetails user) {
        Mentor mentor = mentorRepository
                .findByInstituteIdAndUserIdAndStatusNot(instituteId, user.getUserId(), MentorStatus.DELETED.name())
                .orElseThrow(() -> new VacademyException("You are not a mentor in this institute"));
        return sessions(instituteId, mentor.getId(), null, "AWAITING_REVIEW", DEFAULT_HISTORY_DAYS);
    }

    // ============================== learner: my own sessions ==============================

    /**
     * The sessions a learner is the invitee of. Same assembly as the admin list, then
     * stripped of the mentor's private notes — a learner sees when, with whom, whether it
     * happened and their own rating, never what the mentor wrote about them.
     */
    public List<MentorSessionDTO> sessionsForStudent(String instituteId, String studentUserId, String lifecycle) {
        return sessions(instituteId, null, studentUserId, lifecycle, DEFAULT_HISTORY_DAYS).stream()
                .map(MentorSessionService::withoutMentorNotes)
                .collect(Collectors.toList());
    }

    /** Same DTO minus the mentor-only fields. */
    private static MentorSessionDTO withoutMentorNotes(MentorSessionDTO dto) {
        dto.setNotes(null);
        return dto;
    }

    // ============================== schedule a 1:1 ==============================

    /**
     * Book a 1:1 for a learner without the learner filling anything in.
     *
     * <p>Deliberately routed through the same {@link PublicBookingService#book} the learner's
     * own booking page uses, so a scheduled session is the same kind of object as a
     * self-booked one: it respects the mentor's availability and notice rules, gets the same
     * Meet link, reminders, calendar event and confirmation email, and shows up in every
     * session view without a special case. The only thing this method adds is deciding who
     * may schedule for whom, and filling the learner's contact details in on their behalf.
     */
    // Deliberately NOT @Transactional. PublicBookingService.book is not transactional either:
    // it creates the live session, allocates a Meet link and dispatches notifications, all of
    // which are external HTTP calls. Holding a pool connection open across those is the
    // pattern MentorAssignmentService.afterCommit exists to avoid. Nothing here needs
    // atomicity of its own — it reads, delegates, then re-reads.
    public MentorSessionDTO scheduleSession(String instituteId, CustomUserDetails user,
                                            ScheduleSessionRequest req, SessionActor actor) {
        if (req == null || req.getStudentUserId() == null || req.getStudentUserId().isBlank()) {
            throw new VacademyException("studentUserId is required");
        }
        if (req.getStartTime() == null || req.getStartTime().isBlank()) {
            throw new VacademyException("A start time is required");
        }

        Mentor mentor = resolveSchedulingMentor(instituteId, user, req, actor);
        String slug = bookingSlugOf(mentor);

        UserDTO student = hydrate(List.of(req.getStudentUserId())).get(req.getStudentUserId());
        if (student == null) {
            throw new VacademyException("That learner could not be found");
        }
        boolean hasEmail = student.getEmail() != null && !student.getEmail().isBlank();
        boolean hasPhone = student.getMobileNumber() != null && !student.getMobileNumber().isBlank();
        if (!hasEmail && !hasPhone) {
            // The booking flow needs somewhere to send the confirmation; without either
            // the learner would be scheduled into a session they are never told about.
            throw new VacademyException("That learner has no email or phone number on file, "
                    + "so we can't send them the session details");
        }

        String studentName = firstNonBlank(student.getFullName(), student.getUsername());

        PublicBookingDTOs.PublicBookRequestDTO booking = new PublicBookingDTOs.PublicBookRequestDTO();
        booking.setName(studentName == null ? "Learner" : studentName);
        booking.setEmail(hasEmail ? student.getEmail() : null);
        booking.setPhone(hasPhone ? student.getMobileNumber() : null);
        booking.setStartTime(req.getStartTime());
        booking.setInviteeTimezone(req.getInviteeTimezone());
        booking.setDurationMinutes(req.getDurationMinutes());

        // trusted=true: the caller is an authenticated admin or the hosting mentor, so the
        // public link's anti-abuse caps (which exist for anonymous strangers) don't apply.
        PublicBookingDTOs.PublicBookingViewDTO created =
                publicBookingService.book(instituteId, slug, booking, req.getStudentUserId(), true);
        if (created == null) throw new VacademyException("Could not schedule that session");

        // The booking view is token-keyed; the session views are id-keyed, so re-read the
        // instance and return it through the same path every other session view uses.
        BookingInstance instance = bookingInstanceRepository.findByManageToken(created.getManageToken())
                .orElseThrow(() -> new VacademyException("Session was booked but could not be read back"));
        return reload(instituteId, instance.getId());
    }

    /**
     * Which mentor's calendar is being booked. An admin names one; a mentor is always
     * themselves — accepting a mentor_id from a mentor would let them fill a colleague's
     * calendar.
     */
    private Mentor resolveSchedulingMentor(String instituteId, CustomUserDetails user,
                                           ScheduleSessionRequest req, SessionActor actor) {
        if (actor == SessionActor.ADMIN) {
            if (req.getMentorId() == null || req.getMentorId().isBlank()) {
                throw new VacademyException("mentorId is required");
            }
            return mentorRepository.findById(req.getMentorId())
                    .filter(m -> instituteId.equals(m.getInstituteId()))
                    .filter(m -> !MentorStatus.DELETED.name().equals(m.getStatus()))
                    .orElseThrow(() -> new VacademyException("Mentor not found"));
        }
        Mentor mentor = mentorRepository
                .findByInstituteIdAndUserIdAndStatusNot(instituteId, user.getUserId(), MentorStatus.DELETED.name())
                .orElseThrow(() -> new VacademyException("You are not a mentor in this institute"));
        // A mentor schedules with their own mentees only. Admins are not restricted:
        // scheduling an intro session is exactly how a pairing often starts.
        assignmentRepository
                .findByInstituteIdAndMentorIdAndStudentUserIdAndStatus(
                        instituteId, mentor.getId(), req.getStudentUserId(), MentorStatus.ACTIVE.name())
                .orElseThrow(() -> new VacademyException("That learner is not one of your mentees"));
        return mentor;
    }

    /** The mentor's bookable slug, or a message that names the fix. */
    private String bookingSlugOf(Mentor mentor) {
        if (mentor.getBookingPageId() == null || mentor.getBookingPageId().isBlank()) {
            throw new VacademyException("This mentor has no booking page yet — enable booking for them first");
        }
        return bookingPageRepository.findById(mentor.getBookingPageId())
                .map(BookingPage::getSlug)
                .filter(slug -> slug != null && !slug.isBlank())
                .orElseThrow(() -> new VacademyException(
                        "This mentor has no booking page yet — enable booking for them first"));
    }

    // ============================== cancel / reschedule ==============================

    /**
     * Cancel a mentorship session as an authenticated actor.
     *
     * <p>Delegates the actual work to {@link PublicBookingService#cancelInstance} — the same
     * code the emailed manage-token link runs — so the live session, reminders, calendar event
     * and cancellation notice are all handled once, in one place. This method's only job is to
     * decide whether the caller may act, and to refuse anything that isn't a mentorship session.
     *
     * @param asAdmin true when the caller passed institute-admin validation; a mentor may only
     *                touch sessions they host. Prefer the {@link SessionActor} overload.
     */
    @Transactional
    public MentorSessionDTO cancelSession(String instituteId, CustomUserDetails user,
                                          String bookingInstanceId, String reason, boolean asAdmin) {
        return cancelSession(instituteId, user, bookingInstanceId, reason,
                asAdmin ? SessionActor.ADMIN : SessionActor.MENTOR);
    }

    /** Cancel as a named actor — see {@link SessionActor} for what each may touch. */
    @Transactional
    public MentorSessionDTO cancelSession(String instituteId, CustomUserDetails user,
                                          String bookingInstanceId, String reason, SessionActor actor) {
        BookingInstance booking = authorizeSession(instituteId, user, bookingInstanceId, actor);
        publicBookingService.cancelInstance(booking, trimTo(reason, 1000));
        return reload(instituteId, booking.getId());
    }

    /**
     * Move a mentorship session to a new time as an authenticated actor.
     *
     * <p>Delegates to {@link PublicBookingService#rescheduleInstance}, which claims the old row
     * under its optimistic version before creating the replacement — so this cannot produce a
     * duplicate booking, and a concurrent reschedule loses rather than double-books.
     */
    @Transactional
    public MentorSessionDTO rescheduleSession(String instituteId, CustomUserDetails user,
                                              String bookingInstanceId, String newStartTime,
                                              String inviteeTimezone, boolean asAdmin) {
        return rescheduleSession(instituteId, user, bookingInstanceId, newStartTime, inviteeTimezone,
                asAdmin ? SessionActor.ADMIN : SessionActor.MENTOR);
    }

    /** Reschedule as a named actor — see {@link SessionActor} for what each may touch. */
    @Transactional
    public MentorSessionDTO rescheduleSession(String instituteId, CustomUserDetails user,
                                              String bookingInstanceId, String newStartTime,
                                              String inviteeTimezone, SessionActor actor) {
        if (newStartTime == null || newStartTime.isBlank()) {
            throw new VacademyException("A new start time is required");
        }
        BookingInstance booking = authorizeSession(instituteId, user, bookingInstanceId, actor);

        PublicBookingDTOs.PublicRescheduleRequestDTO request = new PublicBookingDTOs.PublicRescheduleRequestDTO();
        request.setStartTime(newStartTime);
        request.setInviteeTimezone(inviteeTimezone);
        // Rescheduling retires the old row and creates a replacement, so the caller must
        // get the NEW id back — acting on the retired one would hit "already rescheduled".
        BookingInstance replacement = publicBookingService.rescheduleInstance(booking, request);
        return reload(instituteId, replacement != null ? replacement.getId() : booking.getId());
    }

    /**
     * Resolve a session the caller may act on, or refuse.
     *
     * <p>Admins may act on any mentorship session in their institute; a mentor only on sessions
     * they host; a learner only on sessions booked for them. Whoever asks, the booking must be a
     * mentorship session — an admin must not be able to cancel a sales call through this API.
     */
    private BookingInstance authorizeSession(String instituteId, CustomUserDetails user,
                                             String bookingInstanceId, SessionActor actor) {
        if (bookingInstanceId == null || bookingInstanceId.isBlank()) {
            throw new VacademyException("bookingInstanceId is required");
        }
        BookingInstance booking = bookingInstanceRepository.findById(bookingInstanceId)
                .filter(b -> instituteId.equals(b.getInstituteId()))
                .orElseThrow(() -> new VacademyException("Session not found"));

        // Only a session hosted by one of this institute's mentors is ours to manage.
        mentorRepository
                .findByInstituteIdAndUserIdAndStatusNot(instituteId, booking.getHostUserId(), MentorStatus.DELETED.name())
                .orElseThrow(() -> new VacademyException("That booking isn't a mentorship session"));

        // A failed ownership check is reported as "not found" on purpose — otherwise the id
        // space becomes a probe for other people's bookings.
        boolean permitted = switch (actor) {
            case ADMIN -> true;
            case MENTOR -> user.getUserId().equals(booking.getHostUserId());
            case STUDENT -> user.getUserId() != null && user.getUserId().equals(booking.getInviteeUserId());
        };
        if (!permitted) throw new VacademyException("Session not found");
        return booking;
    }

    /** Re-read one session through the normal list path so the response shape is identical. */
    private MentorSessionDTO reload(String instituteId, String bookingInstanceId) {
        return sessions(instituteId, null, null, null, null).stream()
                .filter(s -> bookingInstanceId.equals(s.getBookingInstanceId()))
                .findFirst()
                .orElseGet(() -> MentorSessionDTO.builder().bookingInstanceId(bookingInstanceId).build());
    }

    // ---------------------------------------------------------------- helpers

    private MentorSessionDTO toDTO(BookingInstance b, Mentor mentor, MentorSessionRecord record,
                                   MentorSessionFeedback feedback, Map<String, UserDTO> users,
                                   Map<String, String> pageTitles) {
        UserDTO mentorUser = mentor == null ? null : users.get(mentor.getUserId());
        UserDTO student = b.getInviteeUserId() == null ? null : users.get(b.getInviteeUserId());
        Long start = b.getScheduledStartUtc() == null ? null : b.getScheduledStartUtc().getTime();
        Long end = b.getScheduledEndUtc() == null ? null : b.getScheduledEndUtc().getTime();

        return MentorSessionDTO.builder()
                .bookingInstanceId(b.getId())
                .title(titleFor(b, pageTitles))
                .scheduledStartUtc(start)
                .scheduledEndUtc(end)
                .durationMinutes(start != null && end != null ? (int) ((end - start) / 60000) : null)
                .bookingStatus(b.getStatus())
                .meetLink(b.getMeetLink())
                .mentorId(mentor == null ? null : mentor.getId())
                .mentorName(mentor == null ? null
                        : firstNonBlank(mentor.getDisplayName(), mentorUser == null ? null : mentorUser.getFullName()))
                .mentorEmail(mentorUser == null ? null : mentorUser.getEmail())
                .studentUserId(b.getInviteeUserId())
                .studentName(firstNonBlank(b.getInviteeName(), student == null ? null : student.getFullName()))
                .studentEmail(firstNonBlank(b.getInviteeEmail(), student == null ? null : student.getEmail()))
                .outcome(record == null ? null : record.getOutcome())
                .topic(record == null ? null : record.getTopic())
                .notes(record == null ? null : record.getNotes())
                .markedAt(record == null || record.getMarkedAt() == null ? null : record.getMarkedAt().getTime())
                .rating(feedback == null ? null : feedback.getRating())
                .feedbackComment(feedback == null ? null : feedback.getComment())
                .lifecycle(lifecycleOf(b, record))
                .build();
    }

    /**
     * One derived status for display. Appointment state wins (a cancelled session is
     * cancelled regardless), then the mentor's recorded outcome, then time.
     */
    private static String lifecycleOf(BookingInstance b, MentorSessionRecord record) {
        if (INACTIVE_BOOKING_STATUSES.contains(b.getStatus())) return b.getStatus();
        if (record != null && record.getOutcome() != null) return record.getOutcome();
        if (b.getScheduledStartUtc() == null) return "UPCOMING";
        return b.getScheduledStartUtc().toInstant().isAfter(Instant.now()) ? "UPCOMING" : "AWAITING_REVIEW";
    }

    private String titleFor(BookingInstance b, Map<String, String> cache) {
        if (b.getBookingPageId() == null || b.getBookingPageId().isBlank()) return "Mentor session";
        return cache.computeIfAbsent(b.getBookingPageId(), id -> bookingPageRepository.findById(id)
                .map(BookingPage::getTitle)
                .filter(t -> t != null && !t.isBlank())
                .orElse("Mentor session"));
    }

    private static String trimTo(String raw, int max) {
        if (raw == null || raw.isBlank()) return null;
        String t = raw.trim();
        return t.length() > max ? t.substring(0, max) : t;
    }

    private static String safe(String v) {
        return v == null ? "" : v;
    }

    private static String firstNonBlank(String a, String b) {
        if (a != null && !a.isBlank()) return a;
        return b == null || b.isBlank() ? null : b;
    }

    private Map<String, UserDTO> hydrate(List<String> userIds) {
        List<String> distinct = userIds.stream().filter(id -> id != null && !id.isBlank()).distinct().toList();
        if (distinct.isEmpty()) return Map.of();
        try {
            Map<String, UserDTO> map = new HashMap<>();
            for (UserDTO u : authService.getUsersFromAuthServiceByUserIds(new ArrayList<>(distinct))) {
                if (u != null && u.getId() != null) map.put(u.getId(), u);
            }
            return map;
        } catch (Exception e) {
            MentorshipErrorReporter.report(e, "hydrate-users", null);
            return Map.of();
        }
    }
}
