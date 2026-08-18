package vacademy.io.admin_core_service.features.mentorship.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.Page;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.admin_activity_logs.annotation.Auditable;
import vacademy.io.admin_core_service.features.mentorship.dto.AssignMentorRequest;
import vacademy.io.admin_core_service.features.mentorship.dto.AssignmentResultDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.BulkRoundRobinRequest;
import vacademy.io.admin_core_service.features.mentorship.dto.CreateMentorRequest;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorDashboardDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorFeedbackDTOs;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorRequestDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.MentorRequestDecisionDTO;
import vacademy.io.admin_core_service.features.mentorship.dto.UpdateMentorRequest;
import vacademy.io.admin_core_service.features.mentorship.service.MentorAssignmentService;
import vacademy.io.admin_core_service.features.mentorship.service.MentorDiscoveryService;
import vacademy.io.admin_core_service.features.mentorship.service.MentorFeedbackService;
import vacademy.io.admin_core_service.features.mentorship.service.MentorService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

/**
 * Admin-only mentorship management: promote users to mentors, edit profiles,
 * assign students (manual + bulk round-robin), and the mentor dashboard.
 * Every endpoint requires institute ADMIN access.
 */
@RestController
@RequestMapping("/admin-core-service/mentorship/v1")
@RequiredArgsConstructor
public class MentorController {

    private final MentorService mentorService;
    private final MentorAssignmentService assignmentService;
    private final MentorDiscoveryService discoveryService;
    private final MentorFeedbackService feedbackService;
    private final InstituteAccessValidator instituteAccessValidator;

    // ==================== MENTOR CRUD ====================

    @PostMapping("/mentors")
    @Auditable(entityType = "MENTOR", action = "CREATE",
            entityIdExpr = "#result?.body?.id",
            descriptionExpr = "'promoted user to mentor ' + (#req?.displayName ?: '')")
    public ResponseEntity<MentorDTO> createMentor(
            @RequestBody CreateMentorRequest req,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireAdminAccess(user, req.getInstituteId());
        return ResponseEntity.ok(mentorService.create(req, user));
    }

    @PutMapping("/mentors/{id}")
    @Auditable(entityType = "MENTOR", action = "UPDATE",
            entityIdExpr = "#id", descriptionExpr = "'updated mentor'")
    public ResponseEntity<MentorDTO> updateMentor(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestBody UpdateMentorRequest req,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireAdminAccess(user, instituteId);
        return ResponseEntity.ok(mentorService.update(id, instituteId, req));
    }

    /**
     * Mentor list. With {@code pageNo}/{@code pageSize} present the response is a
     * Spring {@code Page} (content/total_pages/...); without them the legacy full
     * array is returned so older clients keep working.
     */
    @GetMapping("/mentors")
    public ResponseEntity<?> listMentors(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "pageNo", required = false) Integer pageNo,
            @RequestParam(value = "pageSize", required = false) Integer pageSize,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireAdminAccess(user, instituteId);
        if (pageNo != null || pageSize != null) {
            return ResponseEntity.ok(mentorService.listPaged(instituteId,
                    pageNo == null ? 0 : pageNo, pageSize == null ? 20 : pageSize));
        }
        return ResponseEntity.ok(mentorService.list(instituteId));
    }

    @GetMapping("/mentors/{id}")
    public ResponseEntity<MentorDTO> getMentor(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireAdminAccess(user, instituteId);
        return ResponseEntity.ok(mentorService.getById(id, instituteId));
    }

    @DeleteMapping("/mentors/{id}")
    @Auditable(entityType = "MENTOR", action = "DELETE",
            entityIdExpr = "#id", descriptionExpr = "'removed mentor'")
    public ResponseEntity<String> deleteMentor(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireAdminAccess(user, instituteId);
        mentorService.delete(id, instituteId);
        return ResponseEntity.ok("Mentor removed");
    }

    /** Provision (or return the existing) booking page for a mentor so learners can book. */
    @PostMapping("/mentors/{id}/booking-page")
    @Auditable(entityType = "MENTOR", action = "PROVISION_BOOKING_PAGE",
            entityIdExpr = "#id", descriptionExpr = "'set up mentor booking page'")
    public ResponseEntity<MentorDTO> provisionBookingPage(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireAdminAccess(user, instituteId);
        return ResponseEntity.ok(mentorService.provisionBookingPage(id, instituteId, user));
    }

    // ==================== ASSIGNMENT ====================

    @PostMapping("/assignments")
    @Auditable(entityType = "MENTOR_ASSIGNMENT", action = "CREATE",
            descriptionExpr = "'assigned students to mentor'")
    public ResponseEntity<AssignmentResultDTO> assign(
            @RequestBody AssignMentorRequest req,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireAdminAccess(user, req.getInstituteId());
        return ResponseEntity.ok(assignmentService.assignManual(req, user));
    }

    @PostMapping("/assignments/bulk-round-robin")
    @Auditable(entityType = "MENTOR_ASSIGNMENT", action = "BULK_ROUND_ROBIN",
            descriptionExpr = "'bulk round-robin mentor assignment'")
    public ResponseEntity<AssignmentResultDTO> bulkRoundRobin(
            @RequestBody BulkRoundRobinRequest req,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireAdminAccess(user, req.getInstituteId());
        return ResponseEntity.ok(assignmentService.bulkRoundRobin(req, user));
    }

    @DeleteMapping("/assignments/{id}")
    @Auditable(entityType = "MENTOR_ASSIGNMENT", action = "DELETE",
            entityIdExpr = "#id", descriptionExpr = "'unassigned mentee'")
    public ResponseEntity<String> unassign(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireAdminAccess(user, instituteId);
        assignmentService.unassign(id, instituteId);
        return ResponseEntity.ok("Unassigned");
    }

    // ==================== LEARNER REQUESTS (review queue) ====================

    /**
     * Mentor requests raised by learners, newest first. Defaults to the PENDING
     * queue; pass {@code status} for the decided history.
     */
    @GetMapping("/requests")
    public ResponseEntity<Page<MentorRequestDTO>> listRequests(
            @RequestParam("instituteId") String instituteId,
            @RequestParam(value = "status", required = false) String status,
            @RequestParam(value = "pageNo", required = false) Integer pageNo,
            @RequestParam(value = "pageSize", required = false) Integer pageSize,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireAdminAccess(user, instituteId);
        return ResponseEntity.ok(discoveryService.listRequests(instituteId, status,
                pageNo == null ? 0 : pageNo, pageSize == null ? 20 : pageSize));
    }

    /** Approve a request — creates the mentor↔student assignment. */
    @PostMapping("/requests/{id}/approve")
    @Auditable(entityType = "MENTOR_REQUEST", action = "APPROVE",
            entityIdExpr = "#id", descriptionExpr = "'approved mentor request'")
    public ResponseEntity<MentorRequestDTO> approveRequest(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestBody(required = false) MentorRequestDecisionDTO decision,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireAdminAccess(user, instituteId);
        return ResponseEntity.ok(discoveryService.approve(id, instituteId, decision, user));
    }

    /** Decline a request, optionally with a reason shown to the learner. */
    @PostMapping("/requests/{id}/decline")
    @Auditable(entityType = "MENTOR_REQUEST", action = "DECLINE",
            entityIdExpr = "#id", descriptionExpr = "'declined mentor request'")
    public ResponseEntity<MentorRequestDTO> declineRequest(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestBody(required = false) MentorRequestDecisionDTO decision,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireAdminAccess(user, instituteId);
        return ResponseEntity.ok(discoveryService.decline(id, instituteId, decision, user));
    }

    // ==================== SESSION FEEDBACK ====================

    /** One mentor's session ratings, newest first. The average itself rides on the mentor DTO. */
    @GetMapping("/mentors/{id}/feedback")
    public ResponseEntity<List<MentorFeedbackDTOs.FeedbackDTO>> mentorFeedback(
            @PathVariable("id") String id,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireAdminAccess(user, instituteId);
        return ResponseEntity.ok(feedbackService.forMentor(instituteId, id));
    }

    // ==================== DASHBOARD ====================

    @GetMapping("/dashboard")
    public ResponseEntity<MentorDashboardDTO> dashboard(
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        instituteAccessValidator.requireAdminAccess(user, instituteId);
        return ResponseEntity.ok(mentorService.dashboard(instituteId));
    }
}
