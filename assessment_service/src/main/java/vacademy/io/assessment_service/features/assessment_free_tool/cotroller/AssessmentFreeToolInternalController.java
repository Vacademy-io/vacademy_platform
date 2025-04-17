package vacademy.io.assessment_service.features.assessment_free_tool.cotroller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.assessment_service.features.assessment_free_tool.service.AssessmentFreeToolGetService;
import vacademy.io.common.ai.dto.AiEvaluationMetadata;

@RestController
@RequestMapping("/assessment-service/internal/evaluation-tool")
@RequiredArgsConstructor
public class AssessmentFreeToolInternalController {

    private final AssessmentFreeToolGetService evaluationMetadataService;

    @GetMapping("/metadata/{assessmentId}")
    public ResponseEntity<AiEvaluationMetadata> getEvaluationMetadata(@PathVariable String assessmentId) {
        AiEvaluationMetadata metadata = evaluationMetadataService.getEvaluationMetadata(assessmentId);
        return ResponseEntity.ok(metadata);
    }

}
