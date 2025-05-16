package vacademy.io.assessment_service.features.assessment.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.AssessmentAllSetResponse;
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.SetCreateRequest;
import vacademy.io.assessment_service.features.assessment.manager.AdminSetManager;
import vacademy.io.common.auth.model.CustomUserDetails;

@RestController
@RequestMapping("/assessment-service/assessment/set")
public class AdminAssessmentSetController {

    @Autowired
    AdminSetManager adminSetManager;

    @PostMapping("/submit")
    public ResponseEntity<String> submitAssessmentSet(@RequestAttribute("user") CustomUserDetails userDetails,
                                                      @RequestParam(name = "assessmentId") String assessmentId,
                                                      @RequestBody SetCreateRequest request) {
        return adminSetManager.createAssessmentSet(userDetails, assessmentId, request);
    }

    @PostMapping("/get-all")
    public ResponseEntity<AssessmentAllSetResponse> getAssessmentSets(@RequestAttribute("user") CustomUserDetails userDetails,
                                                                      @RequestParam(name = "assessmentId") String assessmentId) {
        return adminSetManager.getAllSetsForAssessment(userDetails, assessmentId);
    }
}
