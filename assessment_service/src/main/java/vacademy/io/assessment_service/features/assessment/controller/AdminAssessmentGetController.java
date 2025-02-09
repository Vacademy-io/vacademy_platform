package vacademy.io.assessment_service.features.assessment.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.*;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.AssessmentOverviewDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.AssessmentOverviewResponse;
import vacademy.io.assessment_service.features.assessment.manager.AdminAssessmentGetManager;
import vacademy.io.common.auth.model.CustomUserDetails;

import static vacademy.io.common.core.constants.PageConstants.DEFAULT_PAGE_NUMBER;
import static vacademy.io.common.core.constants.PageConstants.DEFAULT_PAGE_SIZE;

@RestController
@RequestMapping("/assessment-service/assessment/admin")
public class AdminAssessmentGetController {

    @Autowired
    AdminAssessmentGetManager adminAssessmentGetManager;

    @GetMapping("/assessment-admin-list-init")
    public ResponseEntity<AssessmentAdminListInitDto> assessmentAdminListInit(@RequestAttribute("user") CustomUserDetails user,
                                                                              @RequestParam(name = "instituteId", required = false) String instituteId) {
        return adminAssessmentGetManager.assessmentAdminListInit(user, instituteId);
    }

    @PostMapping("/assessment-admin-list-filter")
    public ResponseEntity<AllAdminAssessmentResponse> assessmentAdminListFilter(@RequestAttribute("user") CustomUserDetails user,
                                                                                @RequestBody AdminAssessmentFilter adminAssessmentFilter,
                                                                                @RequestParam(value = "pageNo", defaultValue = DEFAULT_PAGE_NUMBER, required = false) int pageNo,
                                                                                @RequestParam(value = "pageSize", defaultValue = DEFAULT_PAGE_SIZE, required = false) int pageSize,
                                                                                @RequestParam(name = "instituteId", required = false) String instituteId) {
        return adminAssessmentGetManager.assessmentAdminListFilter(user, adminAssessmentFilter, instituteId, pageNo, pageSize);
    }

    @PostMapping("/get-leaderboard")
    public ResponseEntity<LeaderBoardResponse> assessmentLeaderBoard(@RequestAttribute("user") CustomUserDetails user,
                                                                     @RequestParam("assessmentId") String assessmentId,
                                                                     @RequestBody LeaderboardFilter filter,
                                                                     @RequestParam("instituteId") String instituteId,
                                                                     @RequestParam(value = "pageNo", defaultValue = DEFAULT_PAGE_NUMBER, required = false) int pageNo,
                                                                     @RequestParam(value = "pageSize", defaultValue = DEFAULT_PAGE_SIZE, required = false) int pageSize){
        return adminAssessmentGetManager.getLeaderBoard(user, assessmentId, filter, instituteId,pageNo,pageSize);
    }


    @GetMapping("/get-overview")
    public ResponseEntity<AssessmentOverviewResponse> overviewDetails(@RequestAttribute("user") CustomUserDetails user,
                                                                      @RequestParam("assessmentId") String assessmentId,
                                                                      @RequestParam("instituteId") String instituteId){
        return adminAssessmentGetManager.getOverViewDetails(user, assessmentId, instituteId);
    }
}
