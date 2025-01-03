package vacademy.io.assessment_service.features.assessment.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentRegistrationsDto;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentSaveResponseDto;
import vacademy.io.assessment_service.features.assessment.manager.AssessmentBasicDetailsManager;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/assessment-service/assessment/add-participants/create/v1")
public class AdminAssessmentGetController {

    @Autowired
    AssessmentBasicDetailsManager assessmentBasicDetailsManager;

    @PostMapping("/submit")
    public ResponseEntity<AssessmentSaveResponseDto> saveParticipantsToAssessment(@RequestAttribute("user") CustomUserDetails user,
                                                                                @RequestBody AssessmentRegistrationsDto basicAssessmentDetailsDTO,
                                                                                @RequestParam(name = "assessmentId", required = false) String assessmentId,
                                                                                @RequestParam(name = "instituteId", required = false) String instituteId,
                                                                                @RequestParam String type) {
        return assessmentBasicDetailsManager.saveParticipantsToAssessment(user, basicAssessmentDetailsDTO, assessmentId, instituteId, type);
    }
}
