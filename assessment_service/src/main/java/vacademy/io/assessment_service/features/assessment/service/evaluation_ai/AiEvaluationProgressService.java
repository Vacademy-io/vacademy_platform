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
import vacademy.io.assessment_service.features.assessment.client.AiServiceCopyCheckClient;
import vacademy.io.assessment_service.features.assessment.repository.AiEvaluationProcessRepository;
import vacademy.io.assessment_service.features.assessment.repository.AiQuestionEvaluationRepository;
import vacademy.io.assessment_service.features.assessment.repository.CopyCheckLayoutRepository;

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
        private final AiServiceCopyCheckClient aiServiceCopyCheckClient;
        private final CopyCheckLayoutRepository copyCheckLayoutRepository;

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

                // "Resolved" questions (graded OR failed) carry the rich result DTO
                // so the review page can render — and let the teacher grade — a
                // FAILED question. Only genuinely still-processing questions stay in
                // the lightweight pending list (which shows a spinner).
                List<QuestionEvaluationResultDto> completed = questionEvals.stream()
                                .filter(q -> "COMPLETED".equals(q.getStatus()) || "FAILED".equals(q.getStatus()))
                                .map(this::mapToResultDto)
                                .collect(Collectors.toList());

                List<EvaluationProgressDto.PendingQuestionDto> pending = questionEvals.stream()
                                .filter(q -> !"COMPLETED".equals(q.getStatus()) && !"FAILED".equals(q.getStatus()))
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

                // Layout map URL for the FE annotation overlay. FE fetches the
                // JSON via this URL once and renders boxes against the rendered
                // pdf.js page dimensions.
                String layoutMapUrl = copyCheckLayoutRepository
                                .findByEvaluationProcessId(processId)
                                .map(layout -> "/assessment-service/copy-check/layout/" + layout.getId())
                                .orElse(null);

                // The currently-applied rubric_version for any of the completed
                // question evaluations. Used by the FE to decide whether to
                // show the "rubric changed since this evaluation" badge.
                Integer rubricVersion = questionEvals.stream()
                                .map(AiQuestionEvaluation::getRubricVersion)
                                .filter(java.util.Objects::nonNull)
                                .findFirst()
                                .orElse(null);

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
                                .layoutMapUrl(layoutMapUrl)
                                .rubricVersion(rubricVersion)
                                .aiServiceJobId(process.getAiServiceJobId())
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

                // Check terminal state BEFORE forwarding the cancel — don't post
                // cancels for already-finished jobs that ai_service has long
                // since reaped (#15).
                if ("COMPLETED".equals(process.getStatus()) || "FAILED".equals(process.getStatus())) {
                        log.warn("Cannot stop process {} - already in terminal state: {}", processId,
                                        process.getStatus());
                        cancellationService.clearFlag(processId); // Clear flag since we're not cancelling
                        throw new RuntimeException("Evaluation process is already " + process.getStatus());
                }

                // If this process is being run by the ai_service path, forward the
                // cancel so the Python orchestrator aborts at its next checkpoint.
                // Cancel forward is keyed by process_id so it works even before
                // ai_service has echoed back its job_id (#16).
                if (aiServiceCopyCheckClient != null) {
                        aiServiceCopyCheckClient.cancelByProcessId(processId);
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
                List<JsonNode> annotations = null;
                List<JsonNode> criteriaBreakdown = null;
                Double confidence = null;

                if (questionEval.getEvaluationResultJson() != null) {
                        try {
                                JsonNode fullResultJson = objectMapper.readTree(questionEval.getEvaluationResultJson());

                                // Legacy auto-evaluation path: nested evaluation_details_json string.
                                if (fullResultJson.has("evaluation_details_json")) {
                                        String evaluationDetailsStr = fullResultJson.get("evaluation_details_json")
                                                        .asText();
                                        evaluationDetailsJson = objectMapper.readTree(evaluationDetailsStr);
                                }

                                // Copy-check callback path: annotations + criteria_breakdown live at
                                // the top level of the QuestionDone payload. We surface them as
                                // first-class DTO fields and also synthesize evaluation_details_json
                                // so the existing FE QuestionCard (which reads from there) keeps
                                // working without changes.
                                if (fullResultJson.has("annotations") && fullResultJson.get("annotations").isArray()) {
                                        annotations = new java.util.ArrayList<>();
                                        for (JsonNode item : fullResultJson.get("annotations")) {
                                                annotations.add(item);
                                        }
                                }
                                if (fullResultJson.has("criteria_breakdown")
                                                && fullResultJson.get("criteria_breakdown").isArray()) {
                                        criteriaBreakdown = new java.util.ArrayList<>();
                                        for (JsonNode item : fullResultJson.get("criteria_breakdown")) {
                                                criteriaBreakdown.add(item);
                                        }
                                }
                                if (fullResultJson.has("confidence")) {
                                        confidence = fullResultJson.get("confidence").asDouble();
                                }
                                if (evaluationDetailsJson == null
                                                && (annotations != null || criteriaBreakdown != null)) {
                                        com.fasterxml.jackson.databind.node.ObjectNode synth = objectMapper
                                                        .createObjectNode();
                                        if (fullResultJson.has("marks_awarded")) {
                                                synth.set("marks_awarded", fullResultJson.get("marks_awarded"));
                                        }
                                        if (fullResultJson.has("feedback")) {
                                                synth.set("feedback", fullResultJson.get("feedback"));
                                        }
                                        if (fullResultJson.has("extracted_answer")) {
                                                synth.set("extracted_answer", fullResultJson.get("extracted_answer"));
                                        }
                                        if (criteriaBreakdown != null) {
                                                synth.set("criteria_breakdown",
                                                                fullResultJson.get("criteria_breakdown"));
                                        }
                                        if (annotations != null) {
                                                synth.set("annotations", fullResultJson.get("annotations"));
                                        }
                                        evaluationDetailsJson = synth;
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
                                .annotations(annotations)
                                .criteriaBreakdown(criteriaBreakdown)
                                .rubricVersion(questionEval.getRubricVersion())
                                .confidence(confidence)
                                .isEdited(questionEval.getIsEdited())
                                .startedAt(questionEval.getStartedAt())
                                .completedAt(questionEval.getCompletedAt())
                                .build();
        }
}
