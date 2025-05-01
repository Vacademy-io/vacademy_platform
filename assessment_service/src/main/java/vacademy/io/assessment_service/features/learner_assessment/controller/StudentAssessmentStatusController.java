package vacademy.io.assessment_service.features.learner_assessment.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.learner_assessment.dto.AssessmentAttemptUpdateRequest;
import vacademy.io.assessment_service.features.learner_assessment.dto.response.AssessmentRestartResponse;
import vacademy.io.assessment_service.features.learner_assessment.dto.response.LearnerUpdateStatusResponse;
import vacademy.io.assessment_service.features.learner_assessment.manager.LearnerAssessmentAttemptStatusManager;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/assessment-service/assessment/learner/status")
public class StudentAssessmentStatusController {

    @Autowired
    LearnerAssessmentAttemptStatusManager learnerAssessmentAttemptStatusManager;


    @PostMapping("/update")
    public ResponseEntity<LearnerUpdateStatusResponse> updateStatus(@RequestAttribute("user") CustomUserDetails user,
                                                                    @RequestParam(name = "assessmentId") String assessmentId,
                                                                    @RequestParam(name = "attemptId") String attemptId,
                                                                    @RequestBody AssessmentAttemptUpdateRequest request) {
        return learnerAssessmentAttemptStatusManager.updateLearnerStatus(user, assessmentId, attemptId, request);

    }

    @PostMapping("/submit")
    public ResponseEntity<String> submitStatus(@RequestAttribute("user") CustomUserDetails user,
                                               @RequestParam(name = "assessmentId") String assessmentId,
                                               @RequestParam(name = "attemptId") String attemptId,
                                               @RequestBody AssessmentAttemptUpdateRequest request) {
        return learnerAssessmentAttemptStatusManager.submitAssessment(user, assessmentId, attemptId, request);

    }

    @PostMapping("/restart")
    public ResponseEntity<AssessmentRestartResponse> restartStatus(@RequestAttribute("user") CustomUserDetails user,
                                                                   @RequestParam(name = "assessmentId") String assessmentId,
                                                                   @RequestParam(name = "attemptId") String attemptId,
                                                                   @RequestBody AssessmentAttemptUpdateRequest request) {
        return learnerAssessmentAttemptStatusManager.restartAssessment(user, assessmentId, attemptId, request);
    }
}
