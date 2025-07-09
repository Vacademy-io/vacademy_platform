package vacademy.io.assessment_service.features.learner_assessment.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.manager.AssessmentParticipantsManager;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/assessment-service/assessment/learner-assessment/v1")
public class LearnerAssessmentController {

    @Autowired
    private AssessmentParticipantsManager assessmentParticipantsManager;

    @PostMapping("/assessment-count-for-user-id")
    public ResponseEntity<Integer> getAssessmentCountForUserId(@RequestAttribute("user") CustomUserDetails user, @RequestParam String instituteId,@RequestBody List<String> batchId) {
        return ResponseEntity.ok(assessmentParticipantsManager.getAssessmentCountForUserId(user, instituteId, batchId));
    }
}
