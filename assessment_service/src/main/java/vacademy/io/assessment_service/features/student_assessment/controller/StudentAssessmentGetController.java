package vacademy.io.assessment_service.features.student_assessment.controller;

import org.checkerframework.checker.units.qual.A;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.AdminAssessmentFilter;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.AllAdminAssessmentResponse;
import vacademy.io.assessment_service.features.student_assessment.dto.AllStudentAssessmentResponse;
import vacademy.io.assessment_service.features.student_assessment.dto.StudentAssessmentFilter;
import vacademy.io.assessment_service.features.student_assessment.manager.LearnerAssessmentGetManager;
import vacademy.io.common.auth.model.CustomUserDetails;

import static vacademy.io.common.core.constants.PageConstants.DEFAULT_PAGE_NUMBER;
import static vacademy.io.common.core.constants.PageConstants.DEFAULT_PAGE_SIZE;

@RestController
@RequestMapping("/assessment-service/assessment/learner")
public class StudentAssessmentGetController {

    @Autowired
    LearnerAssessmentGetManager learnerAssessmentGetManager;

    @PostMapping("/assessment-list-filter")
    public ResponseEntity<AllStudentAssessmentResponse> assessmentListFilter(@RequestAttribute("user") CustomUserDetails user,
                                                                             @RequestBody StudentAssessmentFilter adminAssessmentFilter,
                                                                             @RequestParam(value = "pageNo", defaultValue = DEFAULT_PAGE_NUMBER, required = false) int pageNo,
                                                                             @RequestParam(value = "pageSize", defaultValue = DEFAULT_PAGE_SIZE, required = false) int pageSize,
                                                                             @RequestParam(name = "instituteId", required = false) String instituteId) {
        return learnerAssessmentGetManager.assessmentListFilter(user, adminAssessmentFilter, instituteId, pageNo, pageSize);
    }

}
