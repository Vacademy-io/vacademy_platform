package vacademy.io.assessment_service.features.assessment.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentSaveResponseDto;
import vacademy.io.assessment_service.features.assessment.dto.StepResponseDto;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.manager.AssessmentBasicDetailsManager;
import vacademy.io.assessment_service.features.assessment.service.IStep;
import vacademy.io.assessment_service.features.assessment.service.assessment_get.AssessmentService;
import vacademy.io.assessment_service.features.assessment.service.creation.AssessmentAccessDetail;
import vacademy.io.assessment_service.features.assessment.service.creation.AssessmentAddParticipantsDetail;
import vacademy.io.assessment_service.features.assessment.service.creation.AssessmentAddQuestionDetail;
import vacademy.io.assessment_service.features.assessment.service.creation.AssessmentBasicDetail;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Optional;

@RestController
@RequestMapping("/assessment-service/assessment/publish/v1")
public class AssessmentPublishController {


    @Autowired
    AssessmentBasicDetailsManager assessmentBasicDetailsManager;


    @PostMapping("/")
    public ResponseEntity<AssessmentSaveResponseDto> publishAssessment(@RequestAttribute("user") CustomUserDetails user,
                                                                       @RequestBody Map<String, String> data,
                                                                       @RequestParam(name = "assessmentId", required = false) String assessmentId,
                                                                       @RequestParam(name = "instituteId", required = false) String instituteId,
                                                                       @RequestParam String type) {
        return assessmentBasicDetailsManager.publishAssessment(user, data, assessmentId, instituteId, type);
    }
}
