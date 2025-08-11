package vacademy.io.admin_core_service.features.learner.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.learner.service.LearnerEnrollRequestService;
import vacademy.io.common.auth.dto.learner.LearnerEnrollResponseDTO;
import vacademy.io.common.auth.dto.learner.LearnerEnrollRequestDTO;

@RestController
@RequestMapping("/admin-core-service/v1/learner/enroll")
public class LearnerEnrollRequestController {
    @Autowired
    private LearnerEnrollRequestService learnerEnrollRequestService;

    @PostMapping
    public ResponseEntity<LearnerEnrollResponseDTO> enrollLearner(@RequestBody LearnerEnrollRequestDTO learnerEnrollRequestDTO){
        return ResponseEntity.ok(learnerEnrollRequestService.recordLearnerRequest(learnerEnrollRequestDTO));
    }
}
