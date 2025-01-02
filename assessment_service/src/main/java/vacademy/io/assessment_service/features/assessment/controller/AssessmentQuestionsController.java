package vacademy.io.assessment_service.features.assessment.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.AddQuestionsAssessmentDetailsDTO;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentSaveResponseDto;
import vacademy.io.assessment_service.features.assessment.dto.BasicAssessmentDetailsDTO;
import vacademy.io.assessment_service.features.assessment.manager.AssessmentBasicDetailsManager;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/assessment-service/assessment/add-questions/create/v1")
public class AssessmentQuestionsController {

    @Autowired
    AssessmentBasicDetailsManager assessmentBasicDetailsManager;

    @PostMapping("/submit")
    public ResponseEntity<AssessmentSaveResponseDto> saveQuestionsToAssessment(@RequestAttribute("user") CustomUserDetails user,
                                                                                @RequestBody AddQuestionsAssessmentDetailsDTO basicAssessmentDetailsDTO,
                                                                                @RequestParam(name = "assessmentId", required = false) String assessmentId,
                                                                                @RequestParam(name = "instituteId", required = false) String instituteId,
                                                                                @RequestParam String type) {
        return assessmentBasicDetailsManager.saveQuestionsToAssessment(user, basicAssessmentDetailsDTO, assessmentId, instituteId, type);
    }
}
