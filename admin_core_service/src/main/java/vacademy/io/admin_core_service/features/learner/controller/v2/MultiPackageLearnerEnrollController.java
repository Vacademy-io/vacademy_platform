package vacademy.io.admin_core_service.features.learner.controller.v2;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.learner.dto.v2.MultiPackageLearnerEnrollRequestDTO;
import vacademy.io.admin_core_service.features.learner.service.MultiPackageLearnerEnrollService;
import vacademy.io.common.auth.dto.learner.LearnerEnrollResponseDTO;

@RestController
@RequestMapping("/admin-core-service/v2/learner/enroll")
public class MultiPackageLearnerEnrollController {

    @Autowired
    private MultiPackageLearnerEnrollService multiPackageLearnerEnrollService;

    @PostMapping
    public ResponseEntity<LearnerEnrollResponseDTO> enrollMultiPackage(
            @RequestBody MultiPackageLearnerEnrollRequestDTO request) {
        return ResponseEntity.ok(multiPackageLearnerEnrollService.enrollMultiPackage(request));
    }
}
