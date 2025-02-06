package vacademy.io.assessment_service.features.learner_assessment.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.manager.AssessmentParticipantsManager;

@RestController
@RequestMapping("/assessment-service/internal/assessment/learner-assessment/v1")
public class LearnerAssessmentInternalController {

    @Autowired
    private AssessmentParticipantsManager assessmentParticipantsManager;

    @GetMapping("/assessment-count-for-user-id")
    public ResponseEntity<Integer> getAssessmentCountForUserId(@RequestParam String userId,@RequestParam String instituteId) {
        return ResponseEntity.ok(assessmentParticipantsManager.getAssessmentCountForUserId(userId, instituteId));
    }
}
