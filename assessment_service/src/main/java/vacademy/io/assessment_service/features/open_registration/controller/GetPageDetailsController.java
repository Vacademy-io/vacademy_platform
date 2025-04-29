package vacademy.io.assessment_service.features.open_registration.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.assessment_service.features.open_registration.dto.GetAssessmentPublicResponseDto;
import vacademy.io.assessment_service.features.open_registration.dto.ParticipantPublicResponseDto;
import vacademy.io.assessment_service.features.open_registration.manager.AssessmentPublicPageManager;

@RestController
@RequestMapping("/assessment-service/open-registrations/v1")
public class GetPageDetailsController {

    @Autowired
    AssessmentPublicPageManager assessmentPublicPageManager;


    @GetMapping("/assessment-page")
    public ResponseEntity<GetAssessmentPublicResponseDto> getAssessmentPage(@RequestParam("code") String code) {
        return assessmentPublicPageManager.getAssessmentPage(code);
    }

    @GetMapping("/participant-status")
    public ResponseEntity<ParticipantPublicResponseDto> getParticipantStatus(@RequestParam("assessmentId") String assessmentId, @RequestParam("instituteId") String instituteId, @RequestParam("userId") String userId, @RequestParam(value = "psIds", required = false) String psIds) {
        return assessmentPublicPageManager.getParticipantStatus(assessmentId, instituteId, userId, psIds);
    }
}
