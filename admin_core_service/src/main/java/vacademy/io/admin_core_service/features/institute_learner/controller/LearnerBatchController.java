package vacademy.io.admin_core_service.features.institute_learner.controller;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute_learner.dto.BulkLearnerApprovalRequestDTO;
import vacademy.io.admin_core_service.features.institute_learner.dto.LearnerBatchProjection;
import vacademy.io.admin_core_service.features.institute_learner.manager.StudentRegistrationManager;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerBatchEnrollService;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerBatchService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/institute/learner-batch/v1")
@RequiredArgsConstructor
@Slf4j
public class LearnerBatchController {

    private final LearnerBatchService learnerBatchService;

    private final LearnerBatchEnrollService learnerBatchEnrollService;
    @GetMapping("/{instituteId}")
    public ResponseEntity<List<LearnerBatchProjection>> getLearnerBatches(
            @PathVariable String instituteId,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        List<LearnerBatchProjection> batches = learnerBatchService.getBatchesWithLearnerCountByInstituteId(instituteId, userDetails);
        return ResponseEntity.ok(batches);
    }

    @PostMapping("/approve-learner-request")
    public ResponseEntity<String> approveLearnerRequest(@RequestBody List<String> packageSessionIds, @RequestParam String userId, @RequestParam String enrollInviteId) {
        learnerBatchEnrollService.shiftLearnerFromPendingForApprovalToActivePackageSessions(packageSessionIds, userId, enrollInviteId);
        return ResponseEntity.ok("Success");
    }

    @PostMapping("/approve-learner-request-bulk")
    public ResponseEntity<String> approveLearnerRequestBulk(@RequestBody BulkLearnerApprovalRequestDTO request) {
        log.info("Processing bulk learner approval request with {} items", request != null ? request.getItems().size() : 0);
        
        try {
            LearnerBatchEnrollService.BulkApprovalResult result = learnerBatchEnrollService.processBulkLearnerApproval(request);
            
            log.info("Bulk approval completed: {}/{} items processed successfully", result.getSuccessCount(), result.getTotalCount());
            
            if (result.isFailed()) {
                return ResponseEntity.badRequest().body(result.getMessage());
            } else if (result.isPartiallySuccessful()) {
                return ResponseEntity.ok(result.getMessage());
            } else {
                return ResponseEntity.ok(result.getMessage());
            }
        } catch (Exception e) {
            log.error("Error processing bulk approval request: {}", e.getMessage(), e);
            return ResponseEntity.internalServerError().body("Internal server error occurred while processing bulk approval");
        }
    }

}