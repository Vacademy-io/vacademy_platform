package vacademy.io.assessment_service.features.assessment.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.data.repository.query.Param;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentUserFilter;
import vacademy.io.assessment_service.features.assessment.dto.ClosedAssessmentParticipantsResponse;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.AdminAssessmentFilter;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.AllAdminAssessmentResponse;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.AssessmentAdminListInitDto;
import vacademy.io.assessment_service.features.assessment.entity.AssessmentUserRegistration;
import vacademy.io.assessment_service.features.assessment.manager.AdminAssessmentGetManager;
import vacademy.io.assessment_service.features.assessment.manager.AssessmentParticipantsManager;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.core.constants.PageConstants;

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

    @PostMapping("/all/registered-participants")
    public ResponseEntity<ClosedAssessmentParticipantsResponse> closedAssessmentParticipants(@RequestAttribute("user") CustomUserDetails user,
                                                                                             @RequestParam(name = "instituteId") String instituteId,
                                                                                             @RequestParam(name = "assessmentId") String assessmentId,
                                                                                             @RequestBody AssessmentUserFilter filter,
                                                                                             @RequestParam(name = "pageNo", required = false, defaultValue = DEFAULT_PAGE_NUMBER) Integer pageNo,
                                                                                             @RequestParam(name = "pageSize", required = false, defaultValue = DEFAULT_PAGE_SIZE) Integer pageSize){
        return assessmentParticipantsManager.getAllParticipantsForAssessment(user, instituteId, assessmentId, filter, pageNo, pageSize);
    }

}
