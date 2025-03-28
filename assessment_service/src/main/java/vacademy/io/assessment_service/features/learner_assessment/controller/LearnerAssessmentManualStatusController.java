package vacademy.io.assessment_service.features.learner_assessment.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.learner_assessment.dto.AssessmentAttemptUpdateRequest;
import vacademy.io.assessment_service.features.learner_assessment.manager.LearnerAssessmentManualStatusManager;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/assessment-service/assessment/learner/manual-status")
public class LearnerAssessmentManualStatusController {

    @Autowired
    LearnerAssessmentManualStatusManager learnerAssessmentManualStatusManager;


    @PostMapping("/submit")
    public ResponseEntity<String> submitAssessment(@RequestAttribute("user")CustomUserDetails userDetails,
                                                   @RequestParam("assessmentId") String assessmentId,
                                                   @RequestParam("instituteId") String instituteId,
                                                   @RequestParam("attemptId") String attemptId,
                                                   @RequestBody AssessmentAttemptUpdateRequest request){
        return learnerAssessmentManualStatusManager.submitManualAssessment(userDetails,assessmentId,attemptId,request, instituteId);
    }
}
