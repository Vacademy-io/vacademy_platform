package vacademy.io.assessment_service.features.open_registration.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.open_registration.dto.GetAssessmentPublicResponseDto;
import vacademy.io.assessment_service.features.open_registration.dto.ParticipantPublicResponseDto;
import vacademy.io.assessment_service.features.open_registration.manager.AssessmentPublicPageManager;

@RestController
@RequestMapping("/assessment-service/open-registrations/register/v1")
public class RegisterPageDetailsController {

    @Autowired
    AssessmentPublicPageManager assessmentPublicPageManager;


    @PostMapping("/")
    public ResponseEntity<GetAssessmentPublicResponseDto> getAssessmentPage(@RequestParam("code") String code) {
        return assessmentPublicPageManager.getAssessmentPage(code);
    }

    @GetMapping("/participant-status")
    public ResponseEntity<ParticipantPublicResponseDto> getParticipantStatus(@RequestParam("assessmentId") String assessmentId, @RequestParam("instituteId") String instituteId, @RequestParam("userId") String userId) {
        return assessmentPublicPageManager.getParticipantStatus(assessmentId, instituteId, userId);
    }
}
