package vacademy.io.assessment_service.features.open_registration.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.open_registration.dto.AssessmentPublicDto;
import vacademy.io.assessment_service.features.open_registration.dto.GetAssessmentPublicResponseDto;
import vacademy.io.assessment_service.features.open_registration.dto.ParticipantPublicResponseDto;
import vacademy.io.assessment_service.features.open_registration.manager.AssessmentPublicPageManager;
import vacademy.io.assessment_service.features.question_bank.dto.SingleQuestionPaperResponse;
import vacademy.io.assessment_service.features.question_core.dto.QuestionDTO;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.stream.Collectors;

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
