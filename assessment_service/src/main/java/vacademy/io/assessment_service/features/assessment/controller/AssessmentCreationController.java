package vacademy.io.assessment_service.features.assessment.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.StepResponseDto;
import vacademy.io.assessment_service.features.assessment.service.IStep;
import vacademy.io.assessment_service.features.assessment.service.creation.AssessmentAccessDetail;
import vacademy.io.assessment_service.features.assessment.service.creation.AssessmentAddParticipantsDetail;
import vacademy.io.assessment_service.features.assessment.service.creation.AssessmentAddQuestionDetail;
import vacademy.io.assessment_service.features.assessment.service.creation.AssessmentBasicDetail;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/assessment-service/assessment/create/v1")
public class AssessmentCreationController {

    @Autowired
    AssessmentAccessDetail assessmentAccessDetail;

    @Autowired
    AssessmentBasicDetail assessmentBasicDetail;

    @Autowired
    AssessmentAddQuestionDetail assessmentAddQuestionDetail;

    @Autowired
    AssessmentAddParticipantsDetail assessmentAddParticipantsDetail;


    @GetMapping("/status")
    public List<StepResponseDto> createAssessment(@RequestAttribute("user") CustomUserDetails user, @RequestParam(name = "assessmentId", required = false) String assessmentId, @RequestParam(name = "instituteId", required = false) String instituteId, @RequestParam String type) {
        List<IStep> steps = List.of(assessmentAccessDetail, assessmentBasicDetail, assessmentAddQuestionDetail, assessmentAddParticipantsDetail);
        List<StepResponseDto> stepResponses = new ArrayList<>();
        for (IStep step : steps) {
            step.fillStepKeysBasedOnAssessmentType(type, instituteId);
            stepResponses.add(step.toResponseDto());
        }
        return stepResponses;
    }
}
