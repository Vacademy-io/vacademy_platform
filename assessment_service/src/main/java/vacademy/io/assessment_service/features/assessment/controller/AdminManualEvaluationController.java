package vacademy.io.assessment_service.features.assessment.controller;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.ManualAttemptFilter;
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.ManualAttemptResponse;
import vacademy.io.assessment_service.features.assessment.dto.manual_evaluation.ManualSubmitMarksRequest;
import vacademy.io.assessment_service.features.assessment.manager.AdminManualEvaluationManager;
import vacademy.io.common.auth.model.CustomUserDetails;

import static vacademy.io.common.core.constants.PageConstants.DEFAULT_PAGE_NUMBER;
import static vacademy.io.common.core.constants.PageConstants.DEFAULT_PAGE_SIZE;

@RestController
@RequestMapping("/assessment-service/assessment/manual-evaluation")
public class AdminManualEvaluationController {

    @Autowired
    AdminManualEvaluationManager adminManualEvaluationManager;

    @PostMapping("/submit/marks")
    public ResponseEntity<String> submitManualMarks(@RequestAttribute("user")CustomUserDetails userDetails,
                                                    @RequestParam("assessmentId") String assessmentId,
                                                    @RequestParam("instituteId") String instituteId,
                                                    @RequestParam("attemptId") String attemptId,
                                                    @RequestBody ManualSubmitMarksRequest request){
        return adminManualEvaluationManager.submitManualEvaluatedMarks(userDetails, assessmentId, instituteId, attemptId, request);
    }

    @PostMapping("/update/set")
    public ResponseEntity<String> updateAttemptSet(@RequestAttribute("user") CustomUserDetails userDetails,
                                                   @RequestParam("attemptId") String attemptId,
                                                   @RequestParam("setId") String setId){
        return adminManualEvaluationManager.updateAttemptSet(userDetails, attemptId, setId);
    }

    @PostMapping("/update/attempt")
    public ResponseEntity<String> updateAttemptResponse(@RequestAttribute("user") CustomUserDetails userDetails,
                                                   @RequestParam("attemptId") String attemptId,
                                                   @RequestParam("fileId") String fileId){
        return adminManualEvaluationManager.updateAttemptResponse(userDetails, attemptId, fileId);
    }

    @GetMapping("/get/attempt-data")
    public ResponseEntity<String> getAttemptData(@RequestAttribute("user") CustomUserDetails userDetails,
                                                 @RequestParam("attemptId") String attemptId){
        return adminManualEvaluationManager.getAttemptData(userDetails, attemptId);
    }

    @PostMapping("all/attempts")
    public ResponseEntity<ManualAttemptResponse> getAttempt(@RequestAttribute("user") CustomUserDetails userDetails,
                                                            @RequestBody ManualAttemptFilter filter,
                                                            @RequestParam("assessmentId") String assessmentId,
                                                            @RequestParam("instituteId") String instituteId,
                                                            @RequestParam(value = "pageNo", defaultValue = DEFAULT_PAGE_NUMBER, required = false) int pageNo,
                                                            @RequestParam(value = "pageSize", defaultValue = DEFAULT_PAGE_SIZE, required = false) int pageSize
                                                            ){
        return adminManualEvaluationManager.getAssignedAttempt(userDetails, filter,assessmentId,instituteId,pageNo,pageSize);
    }
}
