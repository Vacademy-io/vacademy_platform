package vacademy.io.admin_core_service.features.parent_link.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.admin_activity_logs.annotation.Auditable;
import vacademy.io.admin_core_service.features.parent_link.dto.BackfillSummaryDTO;
import vacademy.io.admin_core_service.features.parent_link.dto.NewGuardianLinkRequestDTO;
import vacademy.io.admin_core_service.features.parent_link.dto.ParentLinkActionRequestDTO;
import vacademy.io.admin_core_service.features.parent_link.dto.ParentLinkActionResponseDTO;
import vacademy.io.admin_core_service.features.parent_link.dto.PendingGuardianStudentDTO;
import vacademy.io.admin_core_service.features.parent_link.service.ParentLinkService;
import vacademy.io.common.auth.dto.UserDTO;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

/**
 * Guardian (parent-student) linking — surfaced to users as "Guardian".
 * Deliberately separate from {@code AdmissionService}'s existing
 * parent/child creation (which powers the enquiry/application admission
 * form) so that flow is left untouched.
 */
@RestController
@RequestMapping("/admin-core-service/parent-link/v1")
public class ParentLinkController {

    @Autowired
    private ParentLinkService parentLinkService;

    @GetMapping("/parent")
    public ResponseEntity<UserDTO> getParent(@RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("studentUserId") String studentUserId) {
        return ResponseEntity.ok(parentLinkService.getParentOfStudent(studentUserId));
    }

    @GetMapping("/children")
    public ResponseEntity<List<UserDTO>> getChildren(@RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("parentUserId") String parentUserId) {
        return ResponseEntity.ok(parentLinkService.getChildrenOfParent(parentUserId));
    }

    @PostMapping("/link")
    @Auditable(
            entityType = "GUARDIAN_LINK",
            action = "CREATE",
            entityIdExpr = "#request.anchorUserId",
            descriptionExpr = "'linked guardian and student (' + #request.direction + ', ' + #request.mode + ')'")
    public ResponseEntity<ParentLinkActionResponseDTO> link(@RequestAttribute("user") CustomUserDetails userDetails,
            @RequestBody ParentLinkActionRequestDTO request) {
        return ResponseEntity.ok(parentLinkService.link(request));
    }

    @PostMapping("/link-new-guardian")
    @Auditable(
            entityType = "GUARDIAN_LINK",
            action = "CREATE",
            entityIdExpr = "#request.instituteId",
            descriptionExpr = "'created a new guardian (' + #request.mode + ')'")
    public ResponseEntity<ParentLinkActionResponseDTO> linkNewGuardian(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestBody NewGuardianLinkRequestDTO request) {
        return ResponseEntity.ok(parentLinkService.linkNewGuardian(request));
    }

    @GetMapping("/backfill/pending")
    public ResponseEntity<List<PendingGuardianStudentDTO>> getPendingGuardianStudents(
            @RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(parentLinkService.previewPendingGuardians(instituteId));
    }

    @PostMapping("/backfill")
    @Auditable(
            entityType = "GUARDIAN_LINK",
            action = "CREATE",
            entityIdExpr = "#instituteId",
            descriptionExpr = "'ran guardian backfill for institute'")
    public ResponseEntity<BackfillSummaryDTO> backfill(@RequestAttribute("user") CustomUserDetails userDetails,
            @RequestParam("instituteId") String instituteId) {
        return ResponseEntity.ok(parentLinkService.backfillGuardians(instituteId));
    }
}
