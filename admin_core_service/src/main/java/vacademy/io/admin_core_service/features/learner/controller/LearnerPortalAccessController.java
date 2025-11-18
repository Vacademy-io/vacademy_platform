package vacademy.io.admin_core_service.features.learner.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestAttribute;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.learner.dto.LearnerPortalAccessResponse;
import vacademy.io.admin_core_service.features.learner.service.LearnerPortalAccessService;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/admin-core-service/admin/learner-portal/v1")
@RequiredArgsConstructor
public class LearnerPortalAccessController {

    private final LearnerPortalAccessService learnerPortalAccessService;

    @GetMapping("/access")
    public ResponseEntity<LearnerPortalAccessResponse> getLearnerPortalAccess(
        @RequestAttribute("user") CustomUserDetails userDetails,
        @RequestParam("instituteId") String instituteId,
        @RequestParam("userId") String userId) {
        LearnerPortalAccessResponse response = learnerPortalAccessService.generateLearnerPortalAccessUrl(instituteId,
            userId);
        return ResponseEntity.ok(response);
    }
}
