package vacademy.io.media_service.evaluation_ai.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.media_service.evaluation_ai.dto.EvaluationUserResponse;
import vacademy.io.media_service.evaluation_ai.service.AiEvaluationService;

import java.util.List;

@RestController
@RequiredArgsConstructor
@RequestMapping("/media-service/ai/evaluation-tool/details")
public class AiEvaluationServiceController {

    private final AiEvaluationService evaluationUserService;

    @GetMapping("/assessment/{assessmentId}")
    public ResponseEntity<List<EvaluationUserResponse>> getEvaluationUsersByAssessmentId(@PathVariable String assessmentId) {
        return ResponseEntity.ok(evaluationUserService.getEvaluationUsersByAssessmentId(assessmentId));
    }

}
