package vacademy.io.admin_core_service.features.assignment_ai_evaluation.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.admin_core_service.features.assignment_ai_evaluation.dto.AssignmentAiEvaluationDTO;
import vacademy.io.admin_core_service.features.assignment_ai_evaluation.dto.AssignmentAiEvaluationTriggerRequest;
import vacademy.io.admin_core_service.features.assignment_ai_evaluation.service.AssignmentAiEvaluationService;
import vacademy.io.common.auth.model.CustomUserDetails;

/** Teacher side of the assignment AI Evaluator: start a run, read the latest result. */
@RestController
@RequestMapping("/admin-core-service/assignment-ai-evaluation/v1")
@RequiredArgsConstructor
public class AssignmentAiEvaluationController {

    private final AssignmentAiEvaluationService evaluationService;

    @PostMapping("/trigger")
    public ResponseEntity<AssignmentAiEvaluationDTO> trigger(
            @RequestBody AssignmentAiEvaluationTriggerRequest request,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(evaluationService.trigger(
                request.getTrackedId(), request.getPreferredModel(), instituteId, user));
    }

    @GetMapping("/latest")
    public ResponseEntity<AssignmentAiEvaluationDTO> latest(
            @RequestParam("trackedId") String trackedId,
            @RequestParam("instituteId") String instituteId,
            @RequestAttribute("user") CustomUserDetails user) {
        return ResponseEntity.ok(evaluationService.latest(trackedId, instituteId, user));
    }
}
