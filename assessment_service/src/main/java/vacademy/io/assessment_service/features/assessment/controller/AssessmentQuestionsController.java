package vacademy.io.assessment_service.features.assessment.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentQuestionPreviewDto;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentSaveResponseDto;
import vacademy.io.assessment_service.features.assessment.dto.create_assessment.AddQuestionsAssessmentDetailsDTO;
import vacademy.io.assessment_service.features.assessment.manager.AssessmentLinkQuestionsManager;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/assessment-service/assessment/add-questions/create/v1")
public class AssessmentQuestionsController {

    @Autowired
    AssessmentLinkQuestionsManager assessmentLinkQuestionsManager;

    @PostMapping("/submit")
    public ResponseEntity<AssessmentSaveResponseDto> saveQuestionsToAssessment(@RequestAttribute("user") CustomUserDetails user,
                                                                               @RequestBody AddQuestionsAssessmentDetailsDTO basicAssessmentDetailsDTO,
                                                                               @RequestParam(name = "assessmentId", required = false) String assessmentId,
                                                                               @RequestParam(name = "instituteId", required = false) String instituteId,
                                                                               @RequestParam String type) {
        return assessmentLinkQuestionsManager.saveQuestionsToAssessment(user, basicAssessmentDetailsDTO, assessmentId, instituteId, type);
    }

    @GetMapping("/questions-of-sections")
    public Map<String, List<AssessmentQuestionPreviewDto>> getQuestionsOfSection(@RequestAttribute("user") CustomUserDetails user,
                                                                                 @RequestParam(name = "assessmentId", required = false) String assessmentId,
                                                                                 @RequestParam(name = "sectionIds", required = false) String sectionIds) {
        return assessmentLinkQuestionsManager.getQuestionsOfSection(user, assessmentId, sectionIds);
    }


}
