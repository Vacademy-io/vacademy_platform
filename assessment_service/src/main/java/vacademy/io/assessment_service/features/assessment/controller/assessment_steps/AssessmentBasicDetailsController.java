package vacademy.io.assessment_service.features.assessment.controller.assessment_steps;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentSaveResponseDto;
import vacademy.io.assessment_service.features.assessment.dto.create_assessment.BasicAssessmentDetailsDTO;
import vacademy.io.assessment_service.features.assessment.manager.AssessmentBasicDetailsManager;
import vacademy.io.common.auth.model.CustomUserDetails;

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
