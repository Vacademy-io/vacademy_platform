package vacademy.io.assessment_service.features.assessment.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.AdminAssessmentFilter;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.AllAdminAssessmentResponse;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.AssessmentAdminListInitDto;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentUserRegistration;
import vacademy.io.assessment_service.features.assessment.manager.AdminAssessmentGetManager;
import vacademy.io.assessment_service.features.assessment.manager.AssessmentParticipantsManager;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

import static vacademy.io.common.core.constants.PageConstants.DEFAULT_PAGE_NUMBER;
import static vacademy.io.common.core.constants.PageConstants.DEFAULT_PAGE_SIZE;

@RestController
@RequestMapping("/assessment-service/assessment/admin-participants")
public class AdminAssessmentGetParticipantsController {

    @Autowired
    AssessmentParticipantsManager assessmentParticipantsManager;

    @GetMapping("/registered-participants")
    public ResponseEntity<List<AssessmentUserRegistration>> assessmentAdminParticipants(@RequestAttribute("user") CustomUserDetails user,
                                                                                        @RequestParam(name = "instituteId", required = false) String instituteId, @RequestParam(name = "assessmentId", required = false) String assessmentId) {
        return assessmentParticipantsManager.assessmentAdminParticipants(user, instituteId, assessmentId);
    }

    public ResponseEntity<String> closedAssessmentParticipants(@RequestAttribute("user") CustomUserDetails user,
                                                               @RequestParam(name = "instituteId", required = false) String instituteId, @RequestParam(name = "assessmentId", required = false) String assessmentId){
        return assessmentParticipantsManager.getAllParticipantsForClosedAssessment(user, instituteId, assessmentId);
    }

}
