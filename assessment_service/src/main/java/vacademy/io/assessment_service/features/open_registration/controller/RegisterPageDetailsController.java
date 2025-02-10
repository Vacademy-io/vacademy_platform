package vacademy.io.assessment_service.features.open_registration.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.open_registration.dto.GetAssessmentPublicResponseDto;
import vacademy.io.assessment_service.features.open_registration.dto.ParticipantPublicResponseDto;
import vacademy.io.assessment_service.features.open_registration.dto.RegisterOpenAssessmentRequestDto;
import vacademy.io.assessment_service.features.open_registration.manager.AssessmentPublicPageManager;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/assessment-service/open-registrations/register/v1")
public class RegisterPageDetailsController {

    @Autowired
    AssessmentPublicPageManager assessmentPublicPageManager;


    @PostMapping("/")
    public ResponseEntity<String> registerAssessment(@RequestBody RegisterOpenAssessmentRequestDto registerOpenAssessmentRequestDto, @RequestParam(value = "userId", required = false) String userId) {
        return assessmentPublicPageManager.registerAssessment(userId, registerOpenAssessmentRequestDto);
    }

}
