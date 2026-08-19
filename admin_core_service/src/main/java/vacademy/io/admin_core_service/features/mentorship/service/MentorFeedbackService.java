package vacademy.io.admin_core_service.features.mentorship.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.admin_core_service.features.booking.entity.BookingInstance;
import vacademy.io.admin_core_service.features.booking.entity.BookingPage;
import vacademy.io.admin_core_service.features.booking.repository.BookingInstanceRepository;
import vacademy.io.admin_core_service.features.booking.repository.BookingPageRepository;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorFeedbackDTOs.FeedbackDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorFeedbackDTOs.PendingFeedbackDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorFeedbackDTOs.SubmitFeedbackRequest;
import vacademy.io.admin_core_service.features.mentorship.entity.Mentor;
import vacademy.io.admin_core_service.features.mentorship.entity.MentorSessionFeedback;
import vacademy.io.admin_core_service.features.mentorship.enums.MentorStatus;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorRepository;
import vacademy.io.admin_core_service.features.mentorship.repository.MentorSessionFeedbackRepository;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.VacademyException;

import java.time.Instant;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

/**
 * Post-session mentor feedback: the learner rates a session that has already
 * happened, and those ratings roll up into a per-mentor average for admins.
 *
 * <p>This is the quality loop mentorship was missing — sessions were counted but
 * never assessed. Ratings hang off {@code booking_instance}, so a session only
 * becomes ratable once it has actually started and wasn't cancelled, and only for
 * the learner who was the invitee on it.
 *
 * <p>The average is always derived from live rows, never cached on the mentor, so
 * deleting a rating genuinely removes its effect.
 */
@Service
@RequiredArgsConstructor
@Slf4j
public class MentorFeedbackService {

    /** Sessions in these states never happened, so they're not ratable. */
    private static final Set<String> NON_RATABLE_STATUSES = Set.of("CANCELLED", "RESCHEDULED");
    /** How far back the learner is still prompted to rate — older sessions drop off the list. */
    private static final int PENDING_WINDOW_DAYS = 30;
    private static final int MAX_COMMENT_LENGTH = 2000;

    private final MentorSessionFeedbackRepository feedbackRepository;
    private final BookingInstanceRepository bookingInstanceRepository;
    private final BookingPageRepository bookingPageRepository;
    private final MentorRepository mentorRepository;
    private final vacademy.io.admin_core_service.features.auth_service.service.AuthService authService;

    // ============================== learner ==============================

    /**
     * Finished mentor sessions the caller hasn't rated yet, newest first. Only
     * sessions hosted by an actual mentor of this institute count — ordinary
     * meetings are not mentorship and never ask for a rating.
     */
    public List<PendingFeedbackDTO> pendingForStudent(String instituteId, String studentUserId) {
        List<BookingInstance> bookings = bookingInstanceRepository
                .findByInstituteIdAndInviteeUserIdOrderByScheduledStartUtcDesc(instituteId, studentUserId);
        if (bookings.isEmpty()) return List.of();

        Instant now = Instant.now();
        Instant windowStart = now.minus(java.time.Duration.ofDays(PENDING_WINDOW_DAYS));
        List<BookingInstance> candidates = bookings.stream()
                .filter(b -> b.getScheduledStartUtc() != null)
                .filter(b -> !NON_RATABLE_STATUSES.contains(b.getStatus()))
                // Already started (so it happened) but recent enough to still be worth asking about.
                .filter(b -> b.getScheduledStartUtc().toInstant().isBefore(now))
                .filter(b -> b.getScheduledStartUtc().toInstant().isAfter(windowStart))
                .collect(Collectors.toList());
        if (candidates.isEmpty()) return List.of();

        Set<String> alreadyRated = feedbackRepository
                .findByInstituteIdAndStudentUserId(instituteId, studentUserId).stream()
                .map(MentorSessionFeedback::getBookingInstanceId)
                .collect(Collectors.toSet());

        // Resolve hosts to mentors once, not per booking.
        List<String> hostUserIds = candidates.stream()
                .map(BookingInstance::getHostUserId)
                .filter(id -> id != null && !id.isBlank())
                .distinct().toList();
        if (hostUserIds.isEmpty()) return List.of();
        Map<String, Mentor> mentorByUserId = mentorRepository
                .findByInstituteIdAndUserIdInAndStatusNot(instituteId, hostUserIds, MentorStatus.DELETED.name())
                .stream().collect(Collectors.toMap(Mentor::getUserId, m -> m, (a, b) -> a));
        if (mentorByUserId.isEmpty()) return List.of();

        Map<String, String> titleByPageId = new HashMap<>();
        List<PendingFeedbackDTO> pending = new ArrayList<>();
        for (BookingInstance b : candidates) {
            if (alreadyRated.contains(b.getId())) continue;
            Mentor mentor = mentorByUserId.get(b.getHostUserId());
            if (mentor == null) continue; // not a mentorship session
            pending.add(PendingFeedbackDTO.builder()
                    .bookingInstanceId(b.getId())
                    .mentorId(mentor.getId())
                    .mentorName(orDefault(mentor.getDisplayName(), "Your mentor"))
                    .mentorProfileImageFileId(mentor.getProfileImageFileId())
                    .sessionTitle(titleFor(b, titleByPageId))
                    .sessionStartUtc(b.getScheduledStartUtc().getTime())
                    .build());
        }
        return pending;
    }

    /**
     * Record the caller's rating of a session. Re-submitting updates their existing
     * rating rather than adding a second one, so "edit my rating" needs no extra API.
     */
    @Transactional
    public FeedbackDTO submit(String instituteId, CustomUserDetails user, SubmitFeedbackRequest req) {
        if (req == null || req.getBookingInstanceId() == null || req.getBookingInstanceId().isBlank()) {
            throw new VacademyException("bookingInstanceId is required");
        }
        int rating = req.getRating() == null ? 0 : req.getRating();
        if (rating < 1 || rating > 5) {
            throw new VacademyException("Rating must be between 1 and 5");
        }
        String studentUserId = user.getUserId();

        BookingInstance booking = bookingInstanceRepository.findById(req.getBookingInstanceId())
                .filter(b -> instituteId.equals(b.getInstituteId()))
                .orElseThrow(() -> new VacademyException("Session not found"));
        // Only the learner who was on the session may rate it.
        if (!studentUserId.equals(booking.getInviteeUserId())) {
            throw new VacademyException("Session not found");
        }
        if (NON_RATABLE_STATUSES.contains(booking.getStatus())) {
            throw new VacademyException("That session didn't take place");
        }
        if (booking.getScheduledStartUtc() == null
                || booking.getScheduledStartUtc().toInstant().isAfter(Instant.now())) {
            throw new VacademyException("You can rate a session once it has taken place");
        }
        Mentor mentor = mentorRepository
                .findByInstituteIdAndUserIdAndStatusNot(instituteId, booking.getHostUserId(), MentorStatus.DELETED.name())
                .orElseThrow(() -> new VacademyException("That session wasn't a mentorship session"));

        String comment = trimComment(req.getComment());
        MentorSessionFeedback feedback = feedbackRepository
                .findByBookingInstanceIdAndStudentUserId(booking.getId(), studentUserId)
                .orElseGet(() -> MentorSessionFeedback.builder()
                        .instituteId(instituteId)
                        .bookingInstanceId(booking.getId())
                        .studentUserId(studentUserId)
                        .build());
        feedback.setMentorId(mentor.getId());
        feedback.setMentorUserId(mentor.getUserId());
        feedback.setRating(rating);
        feedback.setComment(comment);
        MentorSessionFeedback saved = feedbackRepository.save(feedback);

        return toDTO(saved, mentor.getDisplayName(), null);
    }

    // ============================== admin ==============================

    /** One mentor's ratings, newest first, with the learner's name for context. */
    public List<FeedbackDTO> forMentor(String instituteId, String mentorId) {
        List<MentorSessionFeedback> rows =
                feedbackRepository.findByInstituteIdAndMentorIdOrderByCreatedAtDesc(instituteId, mentorId);
        if (rows.isEmpty()) return List.of();
        Mentor mentor = mentorRepository
                .findByIdAndInstituteIdAndStatusNot(mentorId, instituteId, MentorStatus.DELETED.name())
                .orElse(null);
        Map<String, UserDTO> students = hydrate(rows.stream()
                .map(MentorSessionFeedback::getStudentUserId).toList());
        return rows.stream()
                .map(f -> toDTO(f, mentor == null ? null : mentor.getDisplayName(),
                        students.get(f.getStudentUserId())))
                .collect(Collectors.toList());
    }

    /** Rating average + count per mentor for the whole institute, in one query. */
    public Map<String, RatingSummary> summaryByMentor(String instituteId) {
        Map<String, RatingSummary> out = new HashMap<>();
        for (Object[] row : feedbackRepository.aggregateByMentor(instituteId)) {
            String mentorId = (String) row[0];
            Double avg = row[1] == null ? null : ((Number) row[1]).doubleValue();
            long count = row[2] == null ? 0L : ((Number) row[2]).longValue();
            // One decimal is all the UI shows; keeping it here means every caller agrees.
            Double rounded = avg == null ? null : Math.round(avg * 10.0) / 10.0;
            out.put(mentorId, new RatingSummary(rounded, (int) count));
        }
        return out;
    }

    /** A mentor's derived rating. {@code average} is null when nobody has rated them. */
    public record RatingSummary(Double average, Integer count) {}

    // ---------------------------------------------------------------- helpers

    private String titleFor(BookingInstance b, Map<String, String> cache) {
        if (b.getBookingPageId() == null || b.getBookingPageId().isBlank()) return "Mentor session";
        return cache.computeIfAbsent(b.getBookingPageId(), id -> bookingPageRepository.findById(id)
                .map(BookingPage::getTitle)
                .filter(t -> t != null && !t.isBlank())
                .orElse("Mentor session"));
    }

    private static String trimComment(String raw) {
        if (raw == null || raw.isBlank()) return null;
        String trimmed = raw.trim();
        return trimmed.length() > MAX_COMMENT_LENGTH ? trimmed.substring(0, MAX_COMMENT_LENGTH) : trimmed;
    }

    private static FeedbackDTO toDTO(MentorSessionFeedback f, String mentorName, UserDTO student) {
        return FeedbackDTO.builder()
                .id(f.getId())
                .bookingInstanceId(f.getBookingInstanceId())
                .mentorId(f.getMentorId())
                .mentorName(mentorName)
                .studentUserId(f.getStudentUserId())
                .studentName(student == null ? null : student.getFullName())
                .rating(f.getRating())
                .comment(f.getComment())
                .createdAt(f.getCreatedAt() == null ? null : f.getCreatedAt().getTime())
                .build();
    }

    private static String orDefault(String v, String def) {
        return v == null || v.isBlank() ? def : v;
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
            // Names/emails simply go missing rather than the screen failing, so this
            // is invisible without reporting it.
            MentorshipErrorReporter.report(e, "hydrate-users", null);
            return Map.of();
        }
    }
}
