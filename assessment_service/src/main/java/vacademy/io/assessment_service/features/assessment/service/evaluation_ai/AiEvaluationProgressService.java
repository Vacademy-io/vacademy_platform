package vacademy.io.assessment_service.features.assessment.service.evaluation_ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import vacademy.io.assessment_service.features.assessment.dto.evaluation_ai.EvaluationProgressDto;
import vacademy.io.assessment_service.features.assessment.dto.evaluation_ai.ParticipantDetailsDto;
import vacademy.io.assessment_service.features.assessment.dto.evaluation_ai.QuestionEvaluationResultDto;
import vacademy.io.assessment_service.features.assessment.entity.AiEvaluationProcess;
import vacademy.io.assessment_service.features.assessment.entity.AiQuestionEvaluation;
import vacademy.io.assessment_service.features.assessment.repository.AiEvaluationProcessRepository;
import vacademy.io.assessment_service.features.assessment.repository.AiQuestionEvaluationRepository;

import java.math.BigDecimal;
import java.util.List;
import java.util.stream.Collectors;

@Service
@Slf4j
@RequiredArgsConstructor
public class AiEvaluationProgressService {

        private final AiEvaluationProcessRepository processRepository;
        private final AiQuestionEvaluationRepository questionEvaluationRepository;
        private final ObjectMapper objectMapper;
        private final AiEvaluationCancellationService cancellationService;

        /**
         * Get real-time progress for an evaluation
         */
        public EvaluationProgressDto getEvaluationProgress(String processId) {
                // Find evaluation process by ID with all related entities eagerly loaded
                AiEvaluationProcess process = processRepository.findByIdWithCompleteDetails(processId)
                                .orElseThrow(() -> new RuntimeException("Evaluation process not found: " + processId));

                // Get all question evaluations
                List<AiQuestionEvaluation> questionEvals = questionEvaluationRepository
                                .findByEvaluationProcessIdOrderByQuestionNumberAsc(process.getId());

                // Separate completed and pending
                List<QuestionEvaluationResultDto> completed = questionEvals.stream()
                                .filter(q -> "COMPLETED".equals(q.getStatus()))
                                .map(this::mapToResultDto)
                                .collect(Collectors.toList());

                List<EvaluationProgressDto.PendingQuestionDto> pending = questionEvals.stream()
                                .filter(q -> !"COMPLETED".equals(q.getStatus()))
                                .map(q -> EvaluationProgressDto.PendingQuestionDto.builder()
                                                .questionId(q.getQuestion().getId())
                                                .questionNumber(q.getQuestionNumber())
                                                .status(q.getStatus())
                                                .build())
                                .collect(Collectors.toList());

                // Build progress info
                int total = process.getQuestionsTotal() != null ? process.getQuestionsTotal() : questionEvals.size();
                int completedCount = process.getQuestionsCompleted() != null ? process.getQuestionsCompleted()
                                : completed.size();
                double percentage = total > 0 ? (double) completedCount / total * 100 : 0;

                EvaluationProgressDto.ProgressInfo progressInfo = EvaluationProgressDto.ProgressInfo.builder()
                                .completed(completedCount)
                                .total(total)
                                .percentage(Math.round(percentage * 100.0) / 100.0)
                                .build();

                // Extract participant details and other context from registration
                ParticipantDetailsDto participantDetails = null;
                String assessmentId = null;
                String fileId = null;

                if (process.getStudentAttempt() != null) {
                        var studentAttempt = process.getStudentAttempt();

                        // Get file ID from student attempt
                        fileId = studentAttempt.getEvaluatedFileId();

                        // Get participant details from registration
                        if (studentAttempt.getRegistration() != null) {
                                var registration = studentAttempt.getRegistration();

                                participantDetails = ParticipantDetailsDto.builder()
                                                .name(registration.getParticipantName())
                                                .username(registration.getUsername())
                                                .email(registration.getUserEmail())
                                                .instituteId(registration.getInstituteId())
                                                .userId(registration.getUserId())
                                                .build();

                                // Get assessment ID from registration
                                if (registration.getAssessment() != null) {
                                        assessmentId = registration.getAssessment().getId();
                                }
                        }
                }

                return EvaluationProgressDto.builder()
                                .attemptId(process.getStudentAttempt().getId())
                                .evaluationProcessId(process.getId())
                                .overallStatus(process.getStatus())
                                .currentStep(process.getCurrentStep())
                                .progress(progressInfo)
                                .completedQuestions(completed)
                                .pendingQuestions(pending)
                                .participantDetails(participantDetails)
                                .assessmentId(assessmentId)
                                .fileId(fileId)
                                .build();
        }

        /**
         * Get only completed questions
         */
        public List<QuestionEvaluationResultDto> getCompletedQuestions(String processId) {
                // Verify process exists
                processRepository.findById(processId)
                                .orElseThrow(() -> new RuntimeException("Evaluation process not found: " + processId));

                return questionEvaluationRepository
                                .findByEvaluationProcessIdAndStatus(processId, "COMPLETED")
                                .stream()
                                .map(this::mapToResultDto)
                                .collect(Collectors.toList());
        }

        /**
         * Stop an ongoing evaluation process
         */
        public void stopEvaluationProcess(String processId) {
                log.info("Stopping evaluation process: {}", processId);

                // STEP 1: Set in-memory cancellation flag IMMEDIATELY
                // This enables instant detection by the async task without database latency
                cancellationService.cancelProcess(processId);

                // STEP 2: Find the process and validate
                AiEvaluationProcess process = processRepository.findById(processId)
                                .orElseThrow(() -> new RuntimeException("Evaluation process not found: " + processId));

                // Check if process is already completed or failed
                if ("COMPLETED".equals(process.getStatus()) || "FAILED".equals(process.getStatus())) {
                        log.warn("Cannot stop process {} - already in terminal state: {}", processId,
                                        process.getStatus());
                        cancellationService.clearFlag(processId); // Clear flag since we're not cancelling
                        throw new RuntimeException("Evaluation process is already " + process.getStatus());
                }

                // STEP 3: Update process status to CANCELLED in database
                process.setStatus("CANCELLED");
                process.setCurrentStep("STOPPED");
                process.setCompletedAt(new java.util.Date());
                processRepository.save(process);

                // STEP 4: Update all pending question evaluations to CANCELLED
                List<AiQuestionEvaluation> pendingQuestions = questionEvaluationRepository
                                .findByEvaluationProcessIdOrderByQuestionNumberAsc(processId)
                                .stream()
                                .filter(q -> !"COMPLETED".equals(q.getStatus()))
                                .collect(Collectors.toList());

                for (AiQuestionEvaluation question : pendingQuestions) {
                        question.setStatus("CANCELLED");
                        question.setCompletedAt(new java.util.Date());
                }
                questionEvaluationRepository.saveAll(pendingQuestions);

                log.info("Successfully stopped evaluation process: {} - {} questions were cancelled",
                                processId, pendingQuestions.size());
        }

        private QuestionEvaluationResultDto mapToResultDto(AiQuestionEvaluation questionEval) {
                JsonNode evaluationDetailsJson = null;
                if (questionEval.getEvaluationResultJson() != null) {
                        try {
                                // Parse the full evaluation result JSON
                                JsonNode fullResultJson = objectMapper.readTree(questionEval.getEvaluationResultJson());

                                // Extract only the evaluation_details_json field
                                if (fullResultJson.has("evaluation_details_json")) {
                                        String evaluationDetailsStr = fullResultJson.get("evaluation_details_json")
                                                        .asText();
                                        // Parse the nested JSON string into a JsonNode
                                        evaluationDetailsJson = objectMapper.readTree(evaluationDetailsStr);
                                }
                        } catch (Exception e) {
                                log.warn("Failed to parse evaluation details JSON for question {}",
                                                questionEval.getQuestionNumber(), e);
                        }
                }

                return QuestionEvaluationResultDto.builder()
                                .questionId(questionEval.getQuestion().getId())
                                .questionNumber(questionEval.getQuestionNumber())
                                .status(questionEval.getStatus())
                                .marksAwarded(questionEval.getMarksAwarded())
                                .maxMarks(questionEval.getMaxMarks())
                                .feedback(questionEval.getFeedback())
                                .extractedAnswer(questionEval.getExtractedAnswer())
                                .evaluationDetailsJson(evaluationDetailsJson)
                                .startedAt(questionEval.getStartedAt())
                                .completedAt(questionEval.getCompletedAt())
                                .build();
        }
}
