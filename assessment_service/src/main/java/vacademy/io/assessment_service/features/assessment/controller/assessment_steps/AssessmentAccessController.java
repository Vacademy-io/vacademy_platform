package vacademy.io.assessment_service.features.assessment.controller.assessment_steps;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.AssessmentSaveResponseDto;
import vacademy.io.assessment_service.features.assessment.dto.create_assessment.AddAccessAssessmentDetailsDTO;
import vacademy.io.assessment_service.features.assessment.manager.AssessmentAccessManager;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/assessment-service/assessment/add-access/create/v1")
public class AssessmentAccessController {

    @Autowired
    AssessmentAccessManager assessmentAccessManager;

    @PostMapping("/submit")
    public ResponseEntity<AssessmentSaveResponseDto> saveAccessToAssessment(@RequestAttribute("user") CustomUserDetails user,
                                                                            @RequestBody AddAccessAssessmentDetailsDTO addAccessAssessmentDetailsDTO,
                                                                            @RequestParam(name = "assessmentId", required = false) String assessmentId,
                                                                            @RequestParam(name = "instituteId", required = false) String instituteId,
                                                                            @RequestParam String type) {
        return assessmentAccessManager.saveAccessToAssessment(user, addAccessAssessmentDetailsDTO, assessmentId, instituteId, type);
    }
}
