package vacademy.io.assessment_service.features.learner_assessment.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.learner_assessment.dto.AllStudentAssessmentResponse;
import vacademy.io.assessment_service.features.learner_assessment.dto.StudentAssessmentFilter;
import vacademy.io.assessment_service.features.learner_assessment.manager.LearnerAssessmentAttemptStartManager;
import vacademy.io.assessment_service.features.learner_assessment.manager.LearnerAssessmentGetManager;
import vacademy.io.common.auth.model.CustomUserDetails;

import static vacademy.io.common.core.constants.PageConstants.DEFAULT_PAGE_NUMBER;
import static vacademy.io.common.core.constants.PageConstants.DEFAULT_PAGE_SIZE;

@RestController
@RequestMapping("/assessment-service/assessment/learner")
public class StudentAssessmentAttemptStartController {

    @Autowired
    LearnerAssessmentAttemptStartManager learnerAssessmentAttemptStartManager;

    @PostMapping("/assessment-start-preview")
    public ResponseEntity<AllStudentAssessmentResponse> startAssessmentPreview(@RequestAttribute("user") CustomUserDetails user,
                                                                             @RequestBody StudentAssessmentFilter adminAssessmentFilter,
                                                                             @RequestParam(value = "pageNo", defaultValue = DEFAULT_PAGE_NUMBER, required = false) int pageNo,
                                                                             @RequestParam(value = "pageSize", defaultValue = DEFAULT_PAGE_SIZE, required = false) int pageSize,
                                                                             @RequestParam(name = "instituteId", required = false) String instituteId) {
        return learnerAssessmentAttemptStartManager.assessmentListFilter(user, adminAssessmentFilter, instituteId, pageNo, pageSize);
    }

}
