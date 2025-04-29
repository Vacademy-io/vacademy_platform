package vacademy.io.assessment_service.features.assessment.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.request.ReleaseRequestDto;
import vacademy.io.assessment_service.features.assessment.dto.admin_get_dto.response.StudentReportOverallDetailDto;
import vacademy.io.assessment_service.features.assessment.manager.AssessmentParticipantsManager;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/assessment-service/admin/participants")
public class AdminParticipantsController {

    @Autowired
    AssessmentParticipantsManager assessmentParticipantsManager;


    @GetMapping("/get-report-detail")
    public ResponseEntity<StudentReportOverallDetailDto> studentReportDetails(@RequestAttribute("user") CustomUserDetails userDetails,
                                                                              @RequestParam("assessmentId") String assessmentId,
                                                                              @RequestParam("attemptId") String attemptId,
                                                                              @RequestParam("instituteId") String instituteId) {
        return assessmentParticipantsManager.getStudentReportDetails(userDetails, assessmentId, attemptId, instituteId);
    }

    @PostMapping("/release-result")
    public ResponseEntity<String> releaseResult(@RequestAttribute("user") CustomUserDetails userDetails,
                                                @RequestParam("assessmentId") String assessmentId,
                                                @RequestParam("instituteId") String instituteId,
                                                @RequestBody ReleaseRequestDto request,
                                                @RequestParam("methodType") String type) {

        return assessmentParticipantsManager.releaseParticipantsResult(userDetails, assessmentId, instituteId, request, type);
    }


}
