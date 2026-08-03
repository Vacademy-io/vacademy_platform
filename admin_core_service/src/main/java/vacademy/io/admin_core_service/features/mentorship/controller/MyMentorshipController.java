package vacademy.io.admin_core_service.features.mentorship.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.booking.dto.BookingPageDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.MenteeDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorAvailabilityRequest;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorDTO;
import vacademy.io.admin_core_service.features.mentorship.service.MentorAssignmentService;
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
    private final InstituteAccessValidator instituteAccessValidator;

    @GetMapping("/my-mentees")
    public ResponseEntity<List<MenteeDTO>> myMentees(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(assignmentService.menteesForMentor(instituteId, user.getUserId()));
    }

    @GetMapping("/my-mentors")
    public ResponseEntity<List<MentorDTO>> myMentors(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.validateUserAccess(user, instituteId);
        return ResponseEntity.ok(assignmentService.mentorsForStudent(instituteId, user.getUserId()));
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
