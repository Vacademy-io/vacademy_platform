package vacademy.io.assessment_service.features.assessment.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentSaveResponseDto;
import vacademy.io.assessment_service.features.assessment.dto.BasicAssessmentDetailsDTO;
import vacademy.io.assessment_service.features.assessment.dto.StepResponseDto;
import vacademy.io.assessment_service.features.assessment.manager.AssessmentBasicDetailsManager;
import vacademy.io.assessment_service.features.assessment.service.IStep;
import vacademy.io.assessment_service.features.assessment.service.creation.AssessmentAccessDetail;
import vacademy.io.assessment_service.features.assessment.service.creation.AssessmentAddParticipantsDetail;
import vacademy.io.assessment_service.features.assessment.service.creation.AssessmentAddQuestionDetail;
import vacademy.io.assessment_service.features.assessment.service.creation.AssessmentBasicDetail;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.ArrayList;
import java.util.List;

@RestController
@RequestMapping("/assessment-service/assessment/basic/create/v1")
public class AssessmentBasicDetailsController {

    @Autowired
    AssessmentBasicDetailsManager assessmentBasicDetailsManager;

    @PostMapping("/submit")
    public ResponseEntity<AssessmentSaveResponseDto> saveBasicAssessmentDetails(@RequestAttribute("user") CustomUserDetails user,
                                                                                @RequestBody BasicAssessmentDetailsDTO basicAssessmentDetailsDTO,
                                                                                @RequestParam(name = "assessmentId", required = false) String assessmentId,
                                                                                @RequestParam(name = "instituteId", required = false) String instituteId,
                                                                                @RequestParam String type) {
        return assessmentBasicDetailsManager.saveBasicAssessmentDetails(user, basicAssessmentDetailsDTO, assessmentId, instituteId, type);
    }
}
