package vacademy.io.assessment_service.features.assessment.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.AdminAssessmentFilter;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.AllAdminAssessmentResponse;
import vacademy.io.assessment_service.features.assessment.manager.AdminAssessmentAccessManager;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

import static vacademy.io.common.core.constants.PageConstants.DEFAULT_PAGE_NUMBER;
import static vacademy.io.common.core.constants.PageConstants.DEFAULT_PAGE_SIZE;

@RestController
@RequestMapping("/assessment-service/assessment/access")
public class AdminAssessmentAccessController {

    @Autowired
    AdminAssessmentAccessManager adminAssessmentAccessManager;

    @PostMapping("/assessment-list")
    public ResponseEntity<AllAdminAssessmentResponse> getAllAssessment(@RequestAttribute("user") CustomUserDetails user,
                                                                       @RequestBody AdminAssessmentFilter filter,
                                                                       @RequestParam(name = "userRole") String userRole,
                                                                       @RequestParam(value = "pageNo", defaultValue = DEFAULT_PAGE_NUMBER, required = false) int pageNo,
                                                                       @RequestParam(value = "pageSize", defaultValue = DEFAULT_PAGE_SIZE, required = false) int pageSize,
                                                                       @RequestParam(name = "instituteId", required = false) String instituteId){

        return adminAssessmentAccessManager.getAllManualAssessment(user,filter,pageNo,pageSize,instituteId, userRole);

    }
}
