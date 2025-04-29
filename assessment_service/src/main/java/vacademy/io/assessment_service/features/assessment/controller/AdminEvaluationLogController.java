package vacademy.io.assessment_service.features.assessment.controller;


import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.EvaluationLogDto;
import vacademy.io.assessment_service.features.assessment.manager.AdminEvaluationLogsManager;
import vacademy.io.common.auth.model.CustomUserDetails;

import java.util.List;

@RestController
@RequestMapping("/assessment-service/assessment/evaluation-logs")
public class AdminEvaluationLogController {

    @Autowired
    AdminEvaluationLogsManager adminEvaluationLogsManager;

    @GetMapping("/get-all")
    public ResponseEntity<List<EvaluationLogDto>> evaluationLogs(@RequestAttribute("user") CustomUserDetails userDetails,
                                                                 @RequestParam("attemptId") String attemptId) {
        return adminEvaluationLogsManager.getEvaluationLogs(userDetails, attemptId);
    }
}
