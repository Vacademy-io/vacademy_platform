package vacademy.io.media_service.evaluation_ai.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.media_service.evaluation_ai.dto.EvaluationRequestResponse;
import vacademy.io.media_service.evaluation_ai.dto.EvaluationUserDTO;
import vacademy.io.media_service.evaluation_ai.service.AiAnswerEvaluationService;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/media-service/ai/evaluation-tool")
public class AiEvaluationController {

    private final AiAnswerEvaluationService aiAnswerEvaluationService;

    @PostMapping("/evaluate-assessment")
    public ResponseEntity<EvaluationRequestResponse> evaluateAssessment(
            @RequestParam String assessmentId,
            @RequestBody List<EvaluationUserDTO> userDTO
    ) {
        return ResponseEntity.ok(aiAnswerEvaluationService.evaluateAnswers(assessmentId, userDTO));
    }

    @GetMapping("/status/{taskId}")
    public ResponseEntity<EvaluationRequestResponse> evaluateAssessment(
            @PathVariable String taskId
    ) {
        EvaluationRequestResponse response = aiAnswerEvaluationService.getTaskUpdate(taskId);
        return ResponseEntity.ok(response);
    }
}
