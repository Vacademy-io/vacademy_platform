package vacademy.io.admin_core_service.features.learner.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.institute_learner.dto.StudentDTO;
import vacademy.io.admin_core_service.features.learner.dto.LearnerBatchDetail;
import vacademy.io.admin_core_service.features.learner.dto.LearnerDetailsDTO;
import vacademy.io.admin_core_service.features.learner.dto.LearnerDetailsEditDTO;
import vacademy.io.admin_core_service.features.learner.dto.LearnerPaymentPlanStatusDTO;
import vacademy.io.admin_core_service.features.learner.manager.LearnerProfileManager;
import vacademy.io.admin_core_service.features.learner.service.LearnerService;
import vacademy.io.admin_core_service.features.learner.service.LearnerUserPlanService;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.admin_core_service.config.cache.ClientCacheable;
import vacademy.io.admin_core_service.config.cache.CacheScope;

import java.util.List;

@RestController
@RequestMapping("/admin-core-service/learner/info/v1")
public class LearnerUserInfoController {

    @Autowired
    LearnerProfileManager learnerProfileManager;

    @Autowired
    private LearnerService learnerService;

    @Autowired
    private LearnerUserPlanService learnerUserPlanService;

    @GetMapping("/details")
    @ClientCacheable(maxAgeSeconds = 60, scope = CacheScope.PRIVATE, varyHeaders = {"X-Institute-Id", "X-User-Id"})
    public ResponseEntity<List<StudentDTO>> getLearnerInfo(@RequestAttribute("user") CustomUserDetails user, @RequestParam("instituteId") String instituteId) {

        return learnerProfileManager.getLearnerInfo(user, instituteId);
    }

    @PutMapping("/edit")
    public ResponseEntity<String> editLearnerDetails(@RequestBody LearnerDetailsEditDTO learnerDetailsEditDTO,
                                                     @RequestAttribute("user") CustomUserDetails user) {

        return ResponseEntity.ok(learnerService.editLearnerDetails(learnerDetailsEditDTO, user));

    }

    @PutMapping("/edit-face-file")
    public ResponseEntity<String> editFaceFile(@RequestParam String faceFileId,
                                               @RequestAttribute("user") CustomUserDetails user) {

        return ResponseEntity.ok(learnerService.updateFaceFileId(faceFileId, user));

    }

    @GetMapping("/learner-details")
    public ResponseEntity<List<LearnerDetailsDTO>> getLearnerDetails(@RequestParam("packageSessionId") String packageSessionId, @RequestParam("instituteId") String instituteId, @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(learnerService.getStudentsByPackageSessionId(packageSessionId, instituteId, user));
    }

    @GetMapping("/batch-details")
    public ResponseEntity<LearnerBatchDetail> getBatchDetails(@RequestParam("packageSessionId") String packageSessionId, @RequestParam("instituteId") String instituteId, @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(learnerProfileManager.getLearnerBatchDetail(user, packageSessionId, instituteId));
    }

    @GetMapping("user-plan-status")
    public ResponseEntity<LearnerPaymentPlanStatusDTO> getUserPlanStatus(@RequestParam("packageSessionId") String packageSessionId, @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(learnerUserPlanService.getUserPaymentPlanStatus(packageSessionId, user));
    }

}
