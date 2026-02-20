package vacademy.io.admin_core_service.features.learner_management.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.learner_management.dto.BulkAssignRequestDTO;
import vacademy.io.admin_core_service.features.learner_management.dto.BulkAssignResponseDTO;
import vacademy.io.admin_core_service.features.learner_management.dto.BulkDeassignRequestDTO;
import vacademy.io.admin_core_service.features.learner_management.dto.BulkDeassignResponseDTO;
import vacademy.io.admin_core_service.features.learner_management.service.BulkAssignmentService;
import vacademy.io.admin_core_service.features.learner_management.service.BulkDeassignmentService;

/**
 * v3 Bulk Learner Management API.
 * <p>
 * - POST /assign — Assign N users to M package sessions
 * - POST /deassign — De-assign N users from M package sessions
 * <p>
 * Both endpoints support dry-run mode for preview.
 */
@Slf4j
@RestController
@RequestMapping("/admin-core-service/v3/learner-management")
@RequiredArgsConstructor
public class BulkLearnerManagementController {

    private final BulkAssignmentService bulkAssignmentService;
    private final BulkDeassignmentService bulkDeassignmentService;

    /**
     * Bulk assign users to multiple package sessions.
     * <p>
     * Supports:
     * - Explicit user_ids or filter-based selection
     * - Per-assignment invite/plan/access config with auto-resolution
     * - Duplicate handling: SKIP / ERROR / RE_ENROLL
     * - dry_run mode for preview
     */
    @PostMapping("/assign")
    public ResponseEntity<BulkAssignResponseDTO> bulkAssign(
            @RequestBody BulkAssignRequestDTO request) {

        log.info("Bulk assign request: instituteId={}, users={}, assignments={}, dryRun={}",
                request.getInstituteId(),
                request.getUserIds() != null ? request.getUserIds().size() : 0,
                request.getAssignments() != null ? request.getAssignments().size() : 0,
                request.getOptions() != null && request.getOptions().isDryRun());

        BulkAssignResponseDTO response = bulkAssignmentService.bulkAssign(request);

        log.info("Bulk assign complete: total={}, success={}, failed={}, skipped={}, reEnrolled={}, dryRun={}",
                response.getSummary().getTotalRequested(),
                response.getSummary().getSuccessful(),
                response.getSummary().getFailed(),
                response.getSummary().getSkipped(),
                response.getSummary().getReEnrolled(),
                response.isDryRun());

        return ResponseEntity.ok(response);
    }

    /**
     * Bulk de-assign users from multiple package sessions.
     * <p>
     * Supports:
     * - Explicit user_ids or filter-based selection
     * - SOFT cancel (access until expiry) or HARD terminate (immediate revocation)
     * - Shared UserPlan warnings
     * - dry_run mode for preview
     */
    @PostMapping("/deassign")
    public ResponseEntity<BulkDeassignResponseDTO> bulkDeassign(
            @RequestBody BulkDeassignRequestDTO request) {

        log.info("Bulk deassign request: instituteId={}, users={}, packageSessions={}, dryRun={}",
                request.getInstituteId(),
                request.getUserIds() != null ? request.getUserIds().size() : 0,
                request.getPackageSessionIds() != null ? request.getPackageSessionIds().size() : 0,
                request.getOptions() != null && request.getOptions().isDryRun());

        BulkDeassignResponseDTO response = bulkDeassignmentService.bulkDeassign(request);

        log.info("Bulk deassign complete: total={}, success={}, failed={}, skipped={}, dryRun={}",
                response.getSummary().getTotalRequested(),
                response.getSummary().getSuccessful(),
                response.getSummary().getFailed(),
                response.getSummary().getSkipped(),
                response.isDryRun());

        return ResponseEntity.ok(response);
    }
}
