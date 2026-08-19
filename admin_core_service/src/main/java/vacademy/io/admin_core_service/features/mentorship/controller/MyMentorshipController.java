package vacademy.io.admin_core_service.features.mentorship.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.booking.dto.BookingPageDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.MenteeDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorDirectoryDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorFeedbackDTOs;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorRequestCreateDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorRequestDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorSessionDTOs;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorAvailabilityRequest;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorDTO;
import vacademy.io.admin_core_service.features.mentorship.service.MentorAssignmentService;
import vacademy.io.admin_core_service.features.mentorship.service.MentorDiscoveryService;
import vacademy.io.admin_core_service.features.mentorship.service.MentorFeedbackService;
import vacademy.io.admin_core_service.features.mentorship.service.MentorSessionService;
import vacademy.io.admin_core_service.features.mentorship.service.MentorService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;
import java.util.Map;

/**
 * Self-service mentorship reads for the two non-admin audiences:
 *   - a mentor's assigned students ("My Mentorship" → /my-mentees)
 *   - a student's assigned mentors ("My Mentors" → /my-mentors)
 * Only institute membership is required (any member); the caller's own user id
 * scopes the result, so there is no cross-user exposure.
 */
@RestController
@RequestMapping("/admin-core-service/mentorship/v1")
@RequiredArgsConstructor
public class MyMentorshipController {

    private final MentorAssignmentService assignmentService;
    private final MentorService mentorService;
    private final MentorDiscoveryService discoveryService;
    private final MentorFeedbackService feedbackService;
    private final MentorSessionService sessionService;
    private final InstituteAccessValidator instituteAccessValidator;

    /**
     * The caller's mentees. With {@code pageNo}/{@code pageSize} present the response
     * is a Spring {@code Page}; without them the legacy full array is returned so
     * older clients keep working.
     */
    @GetMapping("/my-mentees")
    public ResponseEntity<?> myMentees(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "pageNo", required = false) Integer pageNo,
            @RequestParam(value = "pageSize", required = false) Integer pageSize,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        if (pageNo != null || pageSize != null) {
            return ResponseEntity.ok(assignmentService.menteesForMentorPaged(instituteId,
                    user.getUserId(), pageNo == null ? 0 : pageNo, pageSize == null ? 20 : pageSize));
        }
        return ResponseEntity.ok(assignmentService.menteesForMentor(instituteId, user.getUserId()));
    }

    @GetMapping("/my-mentors")
    public ResponseEntity<List<MentorDTO>> myMentors(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(assignmentService.mentorsForStudent(instituteId, user.getUserId()));
    }

    // ==================== FIND A MENTOR (learner-initiated) ====================

    /**
     * The Find-a-mentor directory: mentors this institute opted into discovery.
     * Deliberately returns a narrower DTO than the admin mentor list (no email,
     * phone or user id) — it is the one mentorship read a plain learner can make
     * about mentors who aren't theirs.
     */
    @GetMapping("/directory")
    public ResponseEntity<List<MentorDirectoryDTO>> directory(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "search", required = false) String search,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(discoveryService.directory(instituteId, user.getUserId(), search));
    }

    /** The learner asks for a mentor. Omitting {@code mentor_id} means "any available mentor". */
    @PostMapping("/my-requests")
    public ResponseEntity<MentorRequestDTO> createRequest(
            @RequestParam("instituteId") String instituteId,
            @RequestBody MentorRequestCreateDTO request,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(discoveryService.createRequest(instituteId, user, request));
    }

    /** The caller's own mentor requests, newest first. */
    @GetMapping("/my-requests")
    public ResponseEntity<List<MentorRequestDTO>> myRequests(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(discoveryService.myRequests(instituteId, user.getUserId()));
    }

    /** The learner withdraws their own pending request. */
    @DeleteMapping("/my-requests/{id}")
    public ResponseEntity<String> cancelRequest(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        discoveryService.cancelRequest(id, instituteId, user.getUserId());
        return ResponseEntity.ok("Request cancelled");
    }

    // ==================== SESSION FEEDBACK ====================

    /**
     * Mentor sessions the caller attended but hasn't rated yet. Drives the
     * "rate your session" prompt; empty for learners with nothing outstanding.
     */
    @GetMapping("/my-pending-feedback")
    public ResponseEntity<List<MentorFeedbackDTOs.PendingFeedbackDTO>> myPendingFeedback(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(feedbackService.pendingForStudent(instituteId, user.getUserId()));
    }

    /** Rate a session the caller attended. Re-submitting revises their existing rating. */
    @PostMapping("/my-feedback")
    public ResponseEntity<MentorFeedbackDTOs.FeedbackDTO> submitFeedback(
            @RequestParam("instituteId") String instituteId,
            @RequestBody MentorFeedbackDTOs.SubmitFeedbackRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(feedbackService.submit(instituteId, user, request));
    }

    // ==================== SESSION OUTCOMES ====================

    /** Sessions the calling mentor has held but not yet recorded an outcome for. */
    @GetMapping("/my-sessions/awaiting-review")
    public ResponseEntity<List<MentorSessionDTOs.MentorSessionDTO>> myAwaitingReview(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(sessionService.myAwaitingReview(instituteId, user));
    }

    /** The mentor records what happened: COMPLETED or NO_SHOW, plus topic and notes. */
    @PostMapping("/my-sessions/record")
    public ResponseEntity<MentorSessionDTOs.MentorSessionDTO> recordSession(
            @RequestParam("instituteId") String instituteId,
            @RequestBody MentorSessionDTOs.RecordSessionRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(sessionService.record(instituteId, user, request));
    }

    /** The mentor cancels one of their OWN sessions. */
    @PostMapping("/my-sessions/cancel")
    public ResponseEntity<MentorSessionDTOs.MentorSessionDTO> cancelMySession(
            @RequestParam("instituteId") String instituteId,
            @RequestBody MentorSessionDTOs.CancelSessionRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        // asAdmin=false: the service refuses any session this mentor doesn't host.
        return ResponseEntity.ok(sessionService.cancelSession(instituteId, user,
                request.getBookingInstanceId(), request.getReason(), false));
    }

    /** The mentor moves one of their OWN sessions to a new time. */
    @PostMapping("/my-sessions/reschedule")
    public ResponseEntity<MentorSessionDTOs.MentorSessionDTO> rescheduleMySession(
            @RequestParam("instituteId") String instituteId,
            @RequestBody MentorSessionDTOs.RescheduleSessionRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(sessionService.rescheduleSession(instituteId, user,
                request.getBookingInstanceId(), request.getStartTime(),
                request.getInviteeTimezone(), false));
    }

    /** The caller's own mentor profile (incl. Google-connected status) — for the Connect Google card. */
    @GetMapping("/my-mentor-profile")
    public ResponseEntity<MentorDTO> myMentorProfile(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(mentorService.getMyMentorProfile(instituteId, user));
    }

    /** Mentor self-connects their OWN Google account — returns the Google consent URL. */
    @PostMapping("/my-google/initiate")
    public ResponseEntity<Map<String, String>> initiateMyGoogle(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(mentorService.initiateGoogleConnect(instituteId, user));
    }

    /** The caller's own booking page (availability, duration, buffers) — auto-provisions if missing. */
    @GetMapping("/my-booking-page")
    public ResponseEntity<BookingPageDTO> myBookingPage(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(mentorService.getMyBookingPage(instituteId, user));
    }

    /** Mentor edits their OWN availability / duration / buffers (never host or slug). */
    @PutMapping("/my-booking-page")
    public ResponseEntity<BookingPageDTO> updateMyBookingPage(
            @RequestParam("instituteId") String instituteId,
            @RequestBody MentorAvailabilityRequest request,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(mentorService.updateMyBookingPage(instituteId, user, request));
    }
}
