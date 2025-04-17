package vacademy.io.media_service.evaluation_ai.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;
import vacademy.io.common.ai.dto.*;
import vacademy.io.media_service.evaluation_ai.dto.EvaluationRequestResponse;
import vacademy.io.media_service.evaluation_ai.dto.EvaluationUserDTO;
import vacademy.io.media_service.evaluation_ai.service.AiAnswerEvaluationService;

import java.util.*;

@RestController
@RequiredArgsConstructor
@RequestMapping("/media-service/ai/evaluation-tool")
public class AiEvaluationController {

    private final AiAnswerEvaluationService aiAnswerEvaluationService;

    @PostMapping("/evaluate-assessment")
    public ResponseEntity<EvaluationRequestResponse> evaluateAssessment(
            @RequestBody List<EvaluationUserDTO> userDTO
            ) {
        AiEvaluationMetadata metadata = getTestingData(); // use real metadata in prod
        return ResponseEntity.ok(aiAnswerEvaluationService.evaluateAnswers(metadata, userDTO));
    }

    @GetMapping("/status/{taskId}")
    public ResponseEntity<EvaluationRequestResponse> evaluateAssessment(
            @PathVariable String taskId
    ) {
        EvaluationRequestResponse response = aiAnswerEvaluationService.getTaskUpdate(taskId);
        return ResponseEntity.ok(response);
    }


    private AiEvaluationMetadata getTestingData() {
        AiEvaluationMetadata metadata = new AiEvaluationMetadata();
        metadata.setAssessmentId("assess-001");
        metadata.setAssessmentName("Sample Assessment");

        RichTextDataDTO instruction = new RichTextDataDTO("1", "text", "Attempt all questions.");
        metadata.setInstruction(instruction);

        AiEvaluationQuestionDTO question = new AiEvaluationQuestionDTO();
        question.setReachText(new RichTextDataDTO("q1", "text", "What is the capital of France?"));
        question.setExplanationText(new RichTextDataDTO("e1", "text", "Explain your reasoning."));
        question.setQuestionOrder(1);
        question.setMarkingJson("{\"totalMarks\": 5}");

        AiEvaluationSectionDTO section = new AiEvaluationSectionDTO();
        section.setName("Geography");
        section.setCutoffMarks(2.0);
        section.setQuestions(List.of(question));

        metadata.setSections(List.of(section));

        return metadata;
    }
}
