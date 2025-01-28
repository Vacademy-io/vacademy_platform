package vacademy.io.assessment_service.features.learner_assessment.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.learner_assessment.dto.*;
import vacademy.io.assessment_service.features.learner_assessment.manager.LearnerAssessmentAttemptStartManager;
import vacademy.io.assessment_service.features.learner_assessment.manager.LearnerAssessmentGetManager;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.student.dto.BasicParticipantDTO;

import static vacademy.io.common.core.constants.PageConstants.DEFAULT_PAGE_NUMBER;
import static vacademy.io.common.core.constants.PageConstants.DEFAULT_PAGE_SIZE;

@RestController
@RequestMapping("/assessment-service/assessment/learner")
public class StudentAssessmentAttemptStartController {

    @Autowired
    LearnerAssessmentAttemptStartManager learnerAssessmentAttemptStartManager;

    @PostMapping("/assessment-start-preview")
    public ResponseEntity<LearnerAssessmentStartPreviewResponse> startAssessmentPreview(@RequestAttribute("user") CustomUserDetails user,
                                                                                        @RequestBody BasicParticipantDTO basicParticipantDTO,
                                                                                        @RequestParam(value = "assessment_id") String assessmentId,
                                                                                        @RequestParam(value = "batch_ids", required = false) String batchIds,
                                                                                        @RequestParam(name = "instituteId") String instituteId) {
        return learnerAssessmentAttemptStartManager.startAssessmentPreview(user, assessmentId, instituteId, batchIds, basicParticipantDTO);
    }

    @PostMapping("/assessment-start-assessment")
    public ResponseEntity<LearnerAssessmentStartAssessmentResponse> startAssessment(@RequestAttribute("user") CustomUserDetails user,
                                                                                    @RequestBody StartAssessmentRequest startAssessmentRequest) {
        return learnerAssessmentAttemptStartManager.startAssessment(user, startAssessmentRequest);
    }

}
