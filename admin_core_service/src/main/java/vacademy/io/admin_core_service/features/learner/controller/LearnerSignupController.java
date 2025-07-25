package vacademy.io.admin_core_service.features.learner.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Repository;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.admin_core_service.features.learner.service.LearnerSignupService;
import vacademy.io.common.auth.dto.learner.LearnerEnrollResponseDTO;
import vacademy.io.common.auth.dto.learner.LearnerSignupDTO;

@RestController
@RequestMapping("/admin-core-service/v1/learner/enroll")
public class LearnerSignupController {
    @Autowired
    private LearnerSignupService learnerSignupService;

    @PostMapping
    public ResponseEntity<LearnerEnrollResponseDTO> enrollLearner(@RequestBody LearnerSignupDTO learnerSignupDTO){
        return ResponseEntity.ok(learnerSignupService.signupLearner(learnerSignupDTO));
    }
}
