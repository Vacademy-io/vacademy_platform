package vacademy.io.admin_core_service.features.institute_learner.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute_learner.dto.LearnerBatchProjection;
import vacademy.io.admin_core_service.features.institute_learner.service.LearnerBatchService;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/institute/learner-batch/v1")
@RequiredArgsConstructor
public class LearnerBatchController {

    private final LearnerBatchService learnerBatchService;

    @GetMapping("/{instituteId}")
    public ResponseEntity<List<LearnerBatchProjection>> getLearnerBatches(
            @PathVariable String instituteId,
            @RequestAttribute("user") CustomUserDetails userDetails) {

        List<LearnerBatchProjection> batches = learnerBatchService.getBatchesWithLearnerCountByInstituteId(instituteId, userDetails);
        return ResponseEntity.ok(batches);
    }
}