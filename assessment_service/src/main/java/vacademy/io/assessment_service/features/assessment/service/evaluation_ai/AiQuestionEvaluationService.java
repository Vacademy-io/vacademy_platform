package vacademy.io.assessment_service.features.assessment.service.evaluation_ai;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.assessment.dto.evaluation_ai.QuestionEvaluationDto;
import vacademy.io.assessment_service.features.assessment.entity.AiEvaluationProcess;
import vacademy.io.assessment_service.features.assessment.entity.AiQuestionEvaluation;
import vacademy.io.assessment_service.features.assessment.enums.QuestionEvaluationStatusEnum;
import vacademy.io.assessment_service.features.assessment.repository.AiQuestionEvaluationRepository;
import vacademy.io.assessment_service.features.question_core.entity.Question;

import java.math.BigDecimal;
import java.util.Date;

@Service
@Slf4j
@RequiredArgsConstructor
public class AiQuestionEvaluationService {

        private final AiQuestionEvaluationRepository aiQuestionEvaluationRepository;
        private final ObjectMapper objectMapper;

        /**
         * Create a new question evaluation entry when starting to evaluate a question
         */
        @Transactional
        public AiQuestionEvaluation createQuestionEvaluation(
                        AiEvaluationProcess evaluationProcess,
                        Question question,
                        int questionNumber) {

                AiQuestionEvaluation questionEval = AiQuestionEvaluation.builder()
                                .evaluationProcess(evaluationProcess)
                                .question(question)
                                .questionNumber(questionNumber)
                                .status(QuestionEvaluationStatusEnum.PENDING.name())
                                .startedAt(new Date())
                                .build();

                return aiQuestionEvaluationRepository.save(questionEval);
        }

        /**
         * Update question evaluation status
         */
        @Transactional
        public void updateQuestionStatus(String questionEvalId, String status) {
                aiQuestionEvaluationRepository.findById(questionEvalId).ifPresent(questionEval -> {
                        questionEval.setStatus(status);
                        aiQuestionEvaluationRepository.save(questionEval);
                        log.info("Updated question {} status to: {}", questionEval.getQuestionNumber(), status);
                });
        }

        /**
         * Save question evaluation result immediately after grading
         */
        @Transactional
        public void saveQuestionResult(
                        String questionEvalId,
                        QuestionEvaluationDto result,
                        String extractedAnswer) {

                aiQuestionEvaluationRepository.findById(questionEvalId).ifPresent(questionEval -> {
                        try {
                                // Convert result to JSON
                                String resultJson = objectMapper.writeValueAsString(result);

                                // Update all fields
                                questionEval.setEvaluationResultJson(resultJson);
                                questionEval.setMarksAwarded(BigDecimal.valueOf(result.getMarksAwarded()));
                                questionEval.setFeedback(result.getFeedback());
                                questionEval.setExtractedAnswer(extractedAnswer);
                                questionEval.setStatus(QuestionEvaluationStatusEnum.COMPLETED.name());
                                questionEval.setCompletedAt(new Date());

                                aiQuestionEvaluationRepository.save(questionEval);
                                log.info("✅ Saved result for question {} ({}M awarded)",
                                                questionEval.getQuestionNumber(), result.getMarksAwarded());

                        } catch (Exception e) {
                                log.error("Failed to save question result: {}", e.getMessage(), e);
                        }
                });
        }

        /**
         * Mark question as failed with error
         */
        @Transactional
        public void markQuestionFailed(String questionEvalId, String errorMessage) {
                aiQuestionEvaluationRepository.findById(questionEvalId).ifPresent(questionEval -> {
                        questionEval.setStatus(QuestionEvaluationStatusEnum.FAILED.name());
                        questionEval.setCompletedAt(new Date());
                        aiQuestionEvaluationRepository.save(questionEval);
                        log.warn("Marked question {} as FAILED", questionEval.getQuestionNumber());
                });
        }
}
