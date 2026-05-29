package vacademy.io.assessment_service.features.assessment.service.evaluation_ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.reactive.function.client.WebClient;
import vacademy.io.assessment_service.features.assessment.client.AiServiceCopyCheckClient;
import vacademy.io.assessment_service.features.assessment.dto.evaluation_ai.CopyCheckGradeRequestDto;
import vacademy.io.assessment_service.features.assessment.entity.AiEvaluationProcess;
import vacademy.io.assessment_service.features.assessment.entity.AiQuestionEvaluation;
import vacademy.io.assessment_service.features.assessment.enums.AiEvaluationStatusEnum;
import vacademy.io.assessment_service.features.assessment.repository.AiEvaluationProcessRepository;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;
import vacademy.io.assessment_service.features.learner_assessment.repository.QuestionWiseMarksRepository;
import vacademy.io.assessment_service.features.question_core.entity.Question;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * New copy-check pipeline: ai_service (Python) owns the AI work, this class
 * just dispatches the grade request and stores the resulting job_id. The
 * pipeline finishes via callbacks into CopyCheckCallbackController.
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CopyCheckOrchestratorService {

    private final AiEvaluationProcessRepository processRepository;
    private final QuestionWiseMarksRepository questionWiseMarksRepository;
    private final AiQuestionEvaluationService aiQuestionEvaluationService;
    private final EvaluationUtilityService evaluationUtilityService;
    private final AiServiceCopyCheckClient aiServiceClient;
    private final ObjectMapper objectMapper;

    @Value("${media.service.baseurl}")
    private String mediaServiceUrl;

    @Value("${assessment.copy-check.callback-base-url:http://assessment-service:8074/assessment-service}")
    private String callbackBaseUrl;

    @Transactional
    public void dispatch(String processId, String attemptId, String preferredModel) {
        AiEvaluationProcess process = processRepository.findById(processId).orElse(null);
        if (process == null) {
            log.error("[copy-check] process {} not found", processId);
            return;
        }
        process.setStatus(AiEvaluationStatusEnum.PROCESSING.name());
        process.setCurrentStep("DISPATCHED");
        process.setStartedAt(new Date());
        processRepository.save(process);

        String attemptData = process.getStudentAttempt() != null ? process.getStudentAttempt().getAttemptData() : null;
        if (attemptData == null) {
            failProcess(process, "attempt_data missing — no PDF to grade");
            return;
        }
        String fileId = evaluationUtilityService.extractFileId(attemptData);
        if (fileId == null || fileId.isEmpty()) {
            failProcess(process, "no file_id on attempt — nothing to grade");
            return;
        }
        String pdfUrl = getFileUrl(fileId);
        if (pdfUrl == null) {
            failProcess(process, "media-service did not return a URL for file_id=" + fileId);
            return;
        }

        List<QuestionWiseMarks> marksList = questionWiseMarksRepository
                .findByStudentAttemptIdWithQuestionDetails(attemptId);
        if (marksList.isEmpty()) {
            failProcess(process, "no questions found for attempt " + attemptId);
            return;
        }
        process.setQuestionsTotal(marksList.size());
        process.setQuestionsCompleted(0);
        processRepository.save(process);

        // Pre-create tracking rows so callbacks can update them by question_id.
        Map<String, AiQuestionEvaluation> trackingRows = new HashMap<>();
        int qNum = 1;
        for (QuestionWiseMarks marks : marksList) {
            AiQuestionEvaluation row = aiQuestionEvaluationService.createQuestionEvaluation(
                    process, marks.getQuestion(), qNum++);
            trackingRows.put(marks.getQuestion().getId(), row);
        }

        List<CopyCheckGradeRequestDto.QuestionInput> questionPayloads = new ArrayList<>(marksList.size());
        for (QuestionWiseMarks marks : marksList) {
            questionPayloads.add(buildQuestionInput(marks));
        }

        CopyCheckGradeRequestDto request = CopyCheckGradeRequestDto.builder()
                .processId(processId)
                .attemptId(attemptId)
                .assessmentId(process.getAssessment() != null ? process.getAssessment().getId() : null)
                .instituteId(extractInstituteId(process))
                .pdfUrl(pdfUrl)
                .preferredModel(preferredModel)
                .callbackBaseUrl(callbackBaseUrl)
                .questions(questionPayloads)
                .build();

        try {
            String jobId = aiServiceClient.submitGrade(request);
            process.setAiServiceJobId(jobId);
            process.setCurrentStep("AI_SERVICE_SUBMITTED");
            processRepository.save(process);
            log.info("[copy-check] dispatched process={} attempt={} → ai_service job_id={}",
                    processId, attemptId, jobId);
        } catch (Exception e) {
            log.error("[copy-check] failed to submit grade for process {}", processId, e);
            failProcess(process, "ai_service submit failed: " + e.getMessage());
        }
    }

    private CopyCheckGradeRequestDto.QuestionInput buildQuestionInput(QuestionWiseMarks marks) {
        Question q = marks.getQuestion();
        double maxMarks = evaluationUtilityService.extractMaxMarksFromSectionMapping(marks, q);
        String questionText = q.getTextData() != null ? q.getTextData().getContent() : "";
        List<Map<String, Object>> options = parseOptions(q);
        String correctAnswer = parseCorrectAnswer(q);
        return CopyCheckGradeRequestDto.QuestionInput.builder()
                .questionId(q.getId())
                .questionText(questionText)
                .questionType(q.getQuestionType())
                .maxMarks(maxMarks)
                .options(options)
                .correctAnswer(correctAnswer)
                .build();
    }

    @SuppressWarnings("unchecked")
    private List<Map<String, Object>> parseOptions(Question q) {
        try {
            String json = q.getAutoEvaluationJson();
            if (json == null || json.isEmpty()) return null;
            JsonNode node = objectMapper.readTree(json).path("options");
            if (node.isMissingNode() || !node.isArray()) return null;
            return objectMapper.convertValue(node, List.class);
        } catch (Exception e) {
            return null;
        }
    }

    private String parseCorrectAnswer(Question q) {
        try {
            String json = q.getAutoEvaluationJson();
            if (json == null || json.isEmpty()) return null;
            JsonNode node = objectMapper.readTree(json);
            JsonNode correct = node.path("correctAnswer");
            if (!correct.isMissingNode() && !correct.isNull()) return correct.asText();
            JsonNode preview = node.path("data").path("correctOption");
            if (!preview.isMissingNode() && !preview.isNull()) return preview.asText();
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    private String extractInstituteId(AiEvaluationProcess process) {
        if (process.getStudentAttempt() == null) return null;
        try {
            var registration = process.getStudentAttempt().getRegistration();
            return registration != null ? registration.getInstituteId() : null;
        } catch (Exception e) {
            return null;
        }
    }

    private String getFileUrl(String fileId) {
        try {
            return WebClient.builder()
                    .baseUrl(mediaServiceUrl)
                    .defaultHeader(HttpHeaders.CONTENT_TYPE, MediaType.APPLICATION_JSON_VALUE)
                    .build()
                    .get()
                    .uri(uriBuilder -> uriBuilder
                            .path("/media-service/public/get-public-url")
                            .queryParam("fileId", fileId)
                            .build())
                    .retrieve()
                    .bodyToMono(String.class)
                    .block();
        } catch (Exception e) {
            log.error("[copy-check] media-service failed for fileId={}", fileId, e);
            return null;
        }
    }

    private void failProcess(AiEvaluationProcess process, String message) {
        process.setStatus(AiEvaluationStatusEnum.FAILED.name());
        process.setErrorMessage(message);
        processRepository.save(process);
        log.error("[copy-check] process {} failed: {}", process.getId(), message);
    }
}
