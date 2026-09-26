package vacademy.io.assessment_service.features.assessment.service.evaluation_ai;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
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
import vacademy.io.assessment_service.features.question_core.entity.Option;
import vacademy.io.assessment_service.features.question_core.entity.Question;
import vacademy.io.assessment_service.features.question_core.repository.OptionRepository;

import java.util.ArrayList;
import java.util.Date;
import java.util.HashMap;
import java.util.Comparator;
import vacademy.io.assessment_service.features.assessment.repository.QuestionAssessmentSectionMappingRepository;
import vacademy.io.assessment_service.features.assessment.entity.Assessment;
import vacademy.io.assessment_service.features.assessment.entity.QuestionAssessmentSectionMapping;
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
    private final OptionRepository optionRepository;
    private final QuestionAssessmentSectionMappingRepository questionMappingRepository;
    private final TypedAnswerEvaluation typedAnswerEvaluation;

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
        if (awaitingSubmitMarks(process, attemptId)) {
            // An online attempt's question rows are written by the async marks job
            // that runs on submit; the poller can get here first. Hand the job back
            // unclaimed and the next tick picks it up once the rows exist.
            process.setClaimedBy(null);
            process.setClaimedAt(null);
            processRepository.save(process);
            log.info("[copy-check] attempt {} has no question rows yet; process {} requeued", attemptId, processId);
            return;
        }
        process.setStatus(AiEvaluationStatusEnum.PROCESSING.name());
        process.setCurrentStep("DISPATCHED");
        process.setStartedAt(new Date());
        processRepository.save(process);

        String attemptData = process.getStudentAttempt() != null ? process.getStudentAttempt().getAttemptData() : null;
        if (attemptData == null) {
            failProcess(process, "attempt_data missing — nothing to grade");
            return;
        }
        // No uploaded sheet = an online attempt: grade the typed written answers.
        boolean typed = typedAnswerEvaluation.isTypedAttempt(process.getStudentAttempt(), assessmentOf(process));
        String pdfUrl = null;
        if (!typed) {
            String fileId = evaluationUtilityService.extractFileId(attemptData);
            if (fileId == null || fileId.isEmpty()) {
                failProcess(process, "no file_id on attempt — nothing to grade");
                return;
            }
            pdfUrl = getFileUrl(fileId);
            if (pdfUrl == null) {
                failProcess(process, "media-service did not return a URL for file_id=" + fileId);
                return;
            }
        }

        List<QuestionWiseMarks> marksList = questionWiseMarksRepository
                .findByStudentAttemptIdWithQuestionDetails(attemptId);
        if (typed) {
            // Objective questions were scored exactly on submit; only the written
            // ones need reading, and only those are charged for.
            marksList = marksList.stream().filter(m -> TypedAnswerEvaluation.isAiGraded(m.getQuestion())).toList();
            if (marksList.isEmpty()) {
                failProcess(process, "no uploaded answer sheet and no written (long answer) question on attempt "
                        + attemptId + " — nothing for the AI to grade");
                return;
            }
        }
        if (marksList.isEmpty()) {
            failProcess(process, "no questions found for attempt " + attemptId);
            return;
        }
        marksList = inPaperOrder(marksList, process.getAssessment());
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
        int position = 0;
        for (QuestionWiseMarks marks : marksList) {
            CopyCheckGradeRequestDto.QuestionInput input = buildQuestionInput(marks, ++position);
            if (typed) {
                input.setStudentAnswer(typedAnswerEvaluation.typedAnswer(marks));
                input.setModelAnswer(referenceAnswerFor(marks.getQuestion()));
            }
            questionPayloads.add(input);
        }

        CopyCheckGradeRequestDto request = CopyCheckGradeRequestDto.builder()
                .processId(processId)
                .attemptId(attemptId)
                .assessmentId(process.getAssessment() != null ? process.getAssessment().getId() : null)
                .instituteId(extractInstituteId(process))
                .answerMode(typed ? "TYPED" : "COPY")
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

    /**
     * What the grader is told about one question. The options and the key come
     * from where the platform actually stores them — the option rows and
     * auto_evaluation_json ({correctOptionIds} / {answer} / {validAnswers}) —
     * so an MCQ, true/false, one-word or numerical answer on a handwritten sheet
     * is marked against the paper's key, not against the model's own opinion.
     * The older auto_evaluation_json.options / correctAnswer shapes stay as the
     * fallback for questions created by other tools.
     */
    private CopyCheckGradeRequestDto.QuestionInput buildQuestionInput(QuestionWiseMarks marks, int position) {
        Question q = marks.getQuestion();
        String[] printed = printedLabel(q);
        double maxMarks = evaluationUtilityService.extractMaxMarksFromSectionMapping(marks, q);
        String questionText = q.getTextData() != null ? q.getTextData().getContent() : "";
        List<Option> storedOptions = loadOptions(q);
        List<Map<String, Object>> options = storedOptions.isEmpty() ? parseOptions(q) : optionsPayload(storedOptions);
        String correctAnswer = correctAnswerFor(q, storedOptions);
        if (correctAnswer == null) {
            correctAnswer = parseCorrectAnswer(q);
        }
        return CopyCheckGradeRequestDto.QuestionInput.builder()
                .questionId(q.getId())
                .questionText(questionText)
                .questionType(q.getQuestionType())
                .maxMarks(maxMarks)
                .options(options)
                .correctAnswer(correctAnswer)
                .questionNumber(position)
                .paperLabel(printed[0] != null ? printed[0] : String.valueOf(position))
                .section(printed[1] != null ? printed[1]
                        : marks.getSection() != null ? marks.getSection().getName() : null)
                .build();
    }

    /**
     * {printed number, section} from a digitised paper's provenance
     * ({@code source_meta.question_number} / {@code section}); {null, null} for
     * questions that did not come off a paper.
     */
    String[] printedLabel(Question q) {
        try {
            String meta = q.getSourceMeta();
            if (meta == null || meta.isBlank()) return new String[]{null, null};
            JsonNode node = objectMapper.readTree(meta);
            String number = node.path("question_number").isMissingNode() || node.path("question_number").isNull()
                    ? null : node.path("question_number").asText().trim();
            String section = node.path("section").isMissingNode() || node.path("section").isNull()
                    ? null : node.path("section").asText().trim();
            return new String[]{number != null && !number.isEmpty() ? number : null,
                    section != null && !section.isEmpty() ? section : null};
        } catch (Exception e) {
            return new String[]{null, null};
        }
    }

    /**
     * The question's option rows, in the order the platform shows them (insertion
     * order). findByStudentAttemptIdWithQuestionDetails already JOIN FETCHes them;
     * the repository is the fallback for a question loaded any other way.
     */
    private List<Option> loadOptions(Question q) {
        try {
            List<Option> fetched = q.getOptions();
            if (fetched != null && !fetched.isEmpty()) {
                return fetched;
            }
            List<Option> options = optionRepository.findByQuestionId(q.getId());
            return options != null ? options : List.of();
        } catch (Exception e) {
            log.warn("[copy-check] could not load options for question {}: {}", q.getId(), e.getMessage());
            return List.of();
        }
    }

    private List<Map<String, Object>> optionsPayload(List<Option> options) {
        List<Map<String, Object>> out = new ArrayList<>(options.size());
        for (Option option : options) {
            Map<String, Object> row = new HashMap<>();
            row.put("id", option.getId());
            row.put("text", plainText(option.getText() != null ? option.getText().getContent() : null));
            out.add(row);
        }
        return out;
    }

    /**
     * The key as a sentence the grader can compare a handwritten answer to:
     *  - choice types → "Option 2: (b) Himalayas" (position AND printed text, since a
     *    student writes either "b" or the words), several joined with "; " for MCQM;
     *  - ONE_WORD → the answer; NUMERIC → every accepted value;
     *  - LONG_ANSWER → null, always. Written answers were never graded against a
     *    stored reference before 2026-09-20 (the rubric alone carries the scheme),
     *    and that behaviour is kept exactly: only objective types gained a key.
     */
    String correctAnswerFor(Question q, List<Option> options) {
        try {
            String json = q.getAutoEvaluationJson();
            if (json == null || json.isEmpty()) return null;
            JsonNode data = objectMapper.readTree(json).path("data");
            if (data.isMissingNode()) return null;

            JsonNode ids = data.path("correctOptionIds");
            if (ids.isMissingNode() || !ids.isArray()) ids = data.path("correct_option_ids");
            if (ids.isArray() && ids.size() > 0) {
                List<String> parts = new ArrayList<>();
                for (JsonNode idNode : ids) {
                    String id = idNode.asText();
                    for (int i = 0; i < options.size(); i++) {
                        if (id.equals(options.get(i).getId())) {
                            String text = plainText(options.get(i).getText() != null
                                    ? options.get(i).getText().getContent() : null);
                            parts.add("Option " + (i + 1) + (text.isEmpty() ? "" : ": " + text));
                        }
                    }
                }
                return parts.isEmpty() ? null : String.join("; ", parts);
            }

            JsonNode valid = data.path("validAnswers");
            if (valid.isMissingNode() || !valid.isArray()) valid = data.path("valid_answers");
            if (valid.isArray() && valid.size() > 0) {
                List<String> values = new ArrayList<>();
                valid.forEach(v -> values.add(v.asText()));
                return String.join(" or ", values);
            }

            JsonNode answer = data.path("answer");
            if (answer.isTextual()) {
                String text = answer.asText().trim();
                return text.isEmpty() ? null : text;
            }
            // An object-shaped answer is a LONG_ANSWER's reference text: not a key.
            return null;
        } catch (Exception e) {
            return null;
        }
    }

    /**
     * The "Answer" a teacher writes on a Long Answer question
     * ({data: {answer: {content}}}), for grading a typed answer. Copies still get
     * no reference from here (see correctAnswerFor); that behaviour is unchanged.
     */
    String referenceAnswerFor(Question q) {
        try {
            String json = q.getAutoEvaluationJson();
            if (json == null || json.isEmpty()) return null;
            JsonNode answer = objectMapper.readTree(json).path("data").path("answer");
            String html = answer.isTextual() ? answer.asText() : answer.path("content").asText(null);
            String text = plainText(html);
            return text.isEmpty() ? null : text;
        } catch (Exception e) {
            return null;
        }
    }

    private static String plainText(String html) {
        if (html == null) return "";
        return html.replaceAll("<[^>]+>", " ").replace("&nbsp;", " ").replaceAll("\\s+", " ").trim();
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

    /**
     * Mark a process FAILED after dispatch blew up. Runs in its own transaction:
     * the dispatch transaction is already rolled back (and, on a constraint
     * violation, poisoned — every further statement gets 25P02), so a write
     * through it would be discarded. Without this a dispatch crash leaves the
     * process stuck at PENDING forever with nothing to retry it.
     */
    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void markDispatchFailed(String processId, String message) {
        try {
            processRepository.findById(processId).ifPresent(process -> failProcess(process, truncate(message)));
        } catch (Exception e) {
            log.error("[copy-check] could not mark process {} as FAILED", processId, e);
        }
    }

    private String truncate(String message) {
        if (message == null) return "dispatch failed";
        return message.length() <= 2000 ? message : message.substring(0, 2000) + "…";
    }

    /**
     * The grader numbers questions in the order it receives them and the student
     * numbers answers as the paper does; when the two disagree (rows created from
     * an unordered mapping set — every staff-made attempt) the checker has to match
     * by content, mislabels callouts and loses answers. Section order, then
     * question order, is the paper's order. Rows without a mapping keep their
     * place at the end.
     */
    List<QuestionWiseMarks> inPaperOrder(List<QuestionWiseMarks> rows, Assessment assessment) {
        if (assessment == null || rows.size() < 2) {
            return rows;
        }
        Map<String, Long> rank = new HashMap<>();
        try {
            for (QuestionAssessmentSectionMapping m : questionMappingRepository
                    .getQuestionAssessmentSectionMappingByAssessmentId(assessment.getId())) {
                if (m.getQuestion() == null || "DELETED".equalsIgnoreCase(m.getStatus())) continue;
                long section = m.getSection() != null && m.getSection().getSectionOrder() != null
                        ? m.getSection().getSectionOrder() : Integer.MAX_VALUE;
                long question = m.getQuestionOrder() != null ? m.getQuestionOrder() : Integer.MAX_VALUE;
                rank.putIfAbsent(m.getQuestion().getId(), section * 1_000_000L + question);
            }
        } catch (Exception e) {
            log.warn("[copy-check] could not order questions for assessment {}: {}", assessment.getId(), e.getMessage());
            return rows;
        }
        List<QuestionWiseMarks> ordered = new ArrayList<>(rows);
        ordered.sort(Comparator.comparingLong(r -> r.getQuestion() == null ? Long.MAX_VALUE
                : rank.getOrDefault(r.getQuestion().getId(), Long.MAX_VALUE)));
        return ordered;
    }

    /** How long after submit a missing set of question rows means "not written yet". */
    static final long SUBMIT_MARKS_GRACE_MS = 10 * 60 * 1000L;

    boolean awaitingSubmitMarks(AiEvaluationProcess process, String attemptId) {
        var attempt = process.getStudentAttempt();
        if (attempt == null || !typedAnswerEvaluation.isTypedAttempt(attempt, assessmentOf(process))) return false;
        Date submitted = attempt.getSubmitTime();
        if (submitted == null || System.currentTimeMillis() - submitted.getTime() > SUBMIT_MARKS_GRACE_MS) return false;
        return questionWiseMarksRepository.findByStudentAttemptId(attemptId).isEmpty();
    }

    private static Assessment assessmentOf(AiEvaluationProcess process) {
        if (process.getAssessment() != null) return process.getAssessment();
        try {
            return process.getStudentAttempt().getRegistration().getAssessment();
        } catch (Exception e) {
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
