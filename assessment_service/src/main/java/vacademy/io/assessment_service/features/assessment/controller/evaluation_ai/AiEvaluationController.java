package vacademy.io.assessment_service.features.assessment.controller.evaluation_ai;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.assessment_service.features.assessment.dto.evaluation_ai.AiEvaluationTriggerRequest;
import vacademy.io.assessment_service.features.assessment.dto.evaluation_ai.EvaluationProgressDto;
import vacademy.io.assessment_service.features.assessment.dto.evaluation_ai.QuestionEvaluationResultDto;
import vacademy.io.assessment_service.features.assessment.service.evaluation_ai.AiEvaluationProgressService;
import vacademy.io.assessment_service.features.assessment.service.evaluation_ai.AiEvaluationService;

import java.util.List;

@RestController
@RequestMapping("/assessment-service/assessment/evaluation-ai")
@RequiredArgsConstructor
public class AiEvaluationController {

        private final AiEvaluationService aiEvaluationService;
        private final AiEvaluationProgressService progressService;

        @PostMapping("/trigger-evaluation")
        public ResponseEntity<List<String>> triggerEvaluation(@RequestBody AiEvaluationTriggerRequest request) {
                return ResponseEntity.ok(aiEvaluationService.triggerEvaluation(request));
        }

        /**
         * Get real-time progress for an evaluation
         */
        @GetMapping("/progress/{processId}")
        public ResponseEntity<EvaluationProgressDto> getProgress(@PathVariable String processId) {
                return ResponseEntity.ok(progressService.getEvaluationProgress(processId));
        }

        /**
         * Get only completed questions (for viewing partial results)
         */
        @GetMapping("/completed-questions/{processId}")
        public ResponseEntity<List<QuestionEvaluationResultDto>> getCompletedQuestions(@PathVariable String processId) {
                return ResponseEntity.ok(progressService.getCompletedQuestions(processId));
        }

        /**
         * Stop an ongoing evaluation process
         */
        @PostMapping("/stop/{processId}")
        public ResponseEntity<String> stopEvaluation(@PathVariable String processId) {
                progressService.stopEvaluationProcess(processId);
                return ResponseEntity.ok("Evaluation process stopped successfully");
        }
}
