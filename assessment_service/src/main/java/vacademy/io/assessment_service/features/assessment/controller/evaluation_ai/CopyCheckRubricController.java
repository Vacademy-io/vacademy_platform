package vacademy.io.assessment_service.features.assessment.controller.evaluation_ai;

import com.fasterxml.jackson.databind.JsonNode;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import vacademy.io.assessment_service.features.assessment.entity.CopyCheckLayout;
import vacademy.io.assessment_service.features.assessment.repository.CopyCheckLayoutRepository;
import vacademy.io.assessment_service.features.assessment.client.AiServiceCopyCheckClient;

/**
 * FE-facing rubric CRUD + layout fetch. The rubric mutations proxy to
 * ai_service which owns the persistence; the layout endpoint serves the
 * cached LayoutMap blob for the FE annotation overlay to read once and
 * render boxes against pdf.js dimensions.
 */
@RestController
@RequestMapping("/assessment-service/copy-check")
@RequiredArgsConstructor
public class CopyCheckRubricController {

    private final AiServiceCopyCheckClient aiServiceClient;
    private final CopyCheckLayoutRepository layoutRepository;

    @GetMapping("/rubric/{assessmentId}")
    public ResponseEntity<JsonNode> getRubric(@PathVariable String assessmentId) {
        JsonNode rubric = aiServiceClient.getRubric(assessmentId);
        if (rubric == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(rubric);
    }

    @PostMapping("/rubric")
    public ResponseEntity<JsonNode> upsertRubric(@RequestBody JsonNode body) {
        return ResponseEntity.ok(aiServiceClient.upsertRubric(body));
    }

    @DeleteMapping("/rubric/{assessmentId}")
    public ResponseEntity<Void> deleteRubric(@PathVariable String assessmentId) {
        aiServiceClient.deleteRubric(assessmentId);
        return ResponseEntity.noContent().build();
    }

    @PutMapping("/rubric/{assessmentId}/question/{questionId}")
    public ResponseEntity<JsonNode> upsertQuestionAnswer(
            @PathVariable String assessmentId,
            @PathVariable String questionId,
            @RequestBody JsonNode body) {
        return ResponseEntity.ok(aiServiceClient.upsertQuestionAnswer(assessmentId, questionId, body));
    }

    @DeleteMapping("/rubric/{assessmentId}/question/{questionId}")
    public ResponseEntity<Void> deleteQuestionAnswer(
            @PathVariable String assessmentId,
            @PathVariable String questionId) {
        aiServiceClient.deleteQuestionAnswer(assessmentId, questionId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/layout/{layoutId}")
    public ResponseEntity<String> getLayout(@PathVariable String layoutId) {
        CopyCheckLayout row = layoutRepository.findById(layoutId).orElse(null);
        if (row == null) return ResponseEntity.notFound().build();
        return ResponseEntity.ok(row.getLayoutJson());
    }
}
