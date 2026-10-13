package vacademy.io.admin_core_service.features.assignment_ai_evaluation.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import vacademy.io.admin_core_service.core.security.InstituteAccessValidator;
import vacademy.io.admin_core_service.features.assignment_ai_evaluation.client.AssignmentCopyCheckClient;
import vacademy.io.admin_core_service.features.assignment_ai_evaluation.dto.AssignmentAiEvaluationDTO;
import vacademy.io.admin_core_service.features.assignment_ai_evaluation.entity.AssignmentAiEvaluation;
import vacademy.io.admin_core_service.features.assignment_ai_evaluation.repository.AssignmentAiEvaluationRepository;
import vacademy.io.admin_core_service.features.credits.client.CreditClient;
import vacademy.io.admin_core_service.features.learner_tracking.dto.AssignmentSlideActivityLogDTO;
import vacademy.io.admin_core_service.features.learner_tracking.entity.ActivityLog;
import vacademy.io.admin_core_service.features.learner_tracking.entity.AssignmentSlideTracked;
import vacademy.io.admin_core_service.features.learner_tracking.repository.AssignmentSlideTrackedRepository;
import vacademy.io.admin_core_service.features.learner_tracking.util.RichTextForAI;
import vacademy.io.common.media.dto.FileDetailsDTO;
import vacademy.io.admin_core_service.features.media_service.service.MediaService;
import vacademy.io.admin_core_service.features.slide.entity.AssignmentSlide;
import vacademy.io.admin_core_service.features.slide.entity.AssignmentSlideQuestion;
import vacademy.io.admin_core_service.features.slide.entity.Slide;
import vacademy.io.admin_core_service.features.slide.repository.AssignmentSlideRepository;
import vacademy.io.admin_core_service.features.slide.repository.SlideRepository;
import vacademy.io.admin_core_service.features.live_session.provider.support.ByteArrayMultipartFile;
import vacademy.io.common.auth.model.CustomUserDetails;
import vacademy.io.common.exceptions.ForbiddenException;
import vacademy.io.common.exceptions.ResourceNotFoundException;
import vacademy.io.common.exceptions.VacademyException;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.time.Instant;
import java.util.*;

/**
 * The AI Evaluator for assignment copies: the same ai_service grader assessments use
 * ({@code /copy-check/grade}), driven from here because the submission lives in this
 * service. The whole assignment is graded as ONE answer out of the assignment's total
 * marks. The outcome is only a suggestion - it pre-fills the teacher's grade form and
 * reaches the learner when the teacher saves the grade.
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class AssignmentAiEvaluationService {

    /** A run with no callback for this long is reported failed (heartbeats come every 60 s). */
    static final Duration STALE_AFTER = Duration.ofMinutes(20);

    private final AssignmentAiEvaluationRepository evaluationRepository;
    private final AssignmentSlideTrackedRepository trackedRepository;
    private final SlideRepository slideRepository;
    private final AssignmentSlideRepository assignmentSlideRepository;
    private final MediaService mediaService;
    private final CreditClient creditClient;
    private final InstituteAccessValidator instituteAccessValidator;
    private final AssignmentCopyPdfBuilder pdfBuilder;
    private final AssignmentCopyCheckClient copyCheckClient;
    private final ObjectMapper objectMapper;
    private final AssignmentAiEvaluationNotifier notifier;

    @Value("${assignment.ai-evaluation.callback-base-url:http://admin-core-service:8072/admin-core-service/assignment-ai-evaluation/hook}")
    private String callbackBaseUrl;

    // ------------------------------------------------------------------ teacher API

    public AssignmentAiEvaluationDTO trigger(String trackedId, String preferredModel, String instituteId,
                                             CustomUserDetails user) {
        // Spends the institute's credits: staff only, no root bypass (learners are root users).
        instituteAccessValidator.requireInstituteStaff(user, instituteId);
        AssignmentSlideTracked tracked = loadTrackedInInstitute(trackedId, instituteId);
        ActivityLog activityLog = tracked.getActivityLog();

        Optional<AssignmentAiEvaluation> running = evaluationRepository
                .findFirstByTrackedIdOrderByCreatedAtDesc(trackedId)
                .map(this::expireIfStale)
                .filter(e -> !e.isTerminal());
        if (running.isPresent()) {
            return AssignmentAiEvaluationDTO.from(running.get());
        }

        Slide slide = slideRepository.findById(activityLog.getSlideId())
                .orElseThrow(() -> new ResourceNotFoundException("Slide not found"));
        AssignmentSlide assignment = assignmentSlideRepository.findById(slide.getSourceId())
                .orElseThrow(() -> new ResourceNotFoundException("Assignment not found for this slide"));
        Double totalMarks = assignment.getTotalMarks();
        if (totalMarks == null || totalMarks <= 0) {
            throw new VacademyException("Set Total Marks on this assignment before using the AI Evaluator");
        }

        Optional<Double> balance = creditClient.readBalance(instituteId);
        if (balance.isPresent() && balance.get() <= 0) {
            throw new VacademyException("Not enough AI credits to run the AI Evaluator");
        }

        AssignmentSlideActivityLogDTO submission = tracked.toAssignmentSlideActivityLog();
        List<String> fileIds = splitIds(submission.getCommaSeparatedFileIds());
        List<AssignmentCopyPdfBuilder.SourceFile> files = resolveFiles(fileIds);
        String sourceFileId;
        String pdfUrl;
        if (AssignmentCopyPdfBuilder.isSinglePdf(files)) {
            sourceFileId = fileIds.get(0);
            pdfUrl = files.get(0).url();
        } else {
            byte[] pdf = pdfBuilder.build(files);
            sourceFileId = uploadMergedCopy(pdf, trackedId);
            pdfUrl = mediaService.getFilePublicUrlById(sourceFileId);
        }

        AssignmentAiEvaluation evaluation = new AssignmentAiEvaluation();
        evaluation.setId(UUID.randomUUID().toString());
        evaluation.setTrackedId(trackedId);
        evaluation.setSlideId(slide.getId());
        evaluation.setInstituteId(instituteId);
        evaluation.setUserId(activityLog.getUserId());
        evaluation.setTriggeredBy(user.getUserId());
        evaluation.setStatus(AssignmentAiEvaluation.STATUS_PROCESSING);
        evaluation.setCurrentStep("QUEUED");
        evaluation.setPreferredModel(preferredModel);
        evaluation.setSourceFileId(sourceFileId);
        evaluation.setMaxMarks(totalMarks);
        // Saved before the call: ai_service may call back before submitGrade returns.
        evaluation = evaluationRepository.save(evaluation);

        Map<String, Object> request = buildGradeRequest(evaluation, slide, assignment, pdfUrl);
        String jobId;
        try {
            jobId = copyCheckClient.submitGrade(request);
        } catch (AssignmentCopyCheckClient.AiServiceBusyException e) {
            fail(evaluation, "The AI Evaluator is busy right now. Try again in a minute.");
            return AssignmentAiEvaluationDTO.from(evaluation);
        } catch (Exception e) {
            log.error("[assignment-ai-eval] could not start run {} for tracked {}: {}",
                    evaluation.getId(), trackedId, e.getMessage());
            fail(evaluation, "Could not start the AI Evaluator: " + e.getMessage());
            return AssignmentAiEvaluationDTO.from(evaluation);
        }
        // One column only: a fast callback may already have moved the row on.
        evaluationRepository.setAiJobId(evaluation.getId(), jobId);
        return AssignmentAiEvaluationDTO.from(evaluationRepository.findById(evaluation.getId()).orElse(evaluation));
    }

    /** The latest run for the submission, or null when it was never evaluated. */
    public AssignmentAiEvaluationDTO latest(String trackedId, String instituteId, CustomUserDetails user) {
        instituteAccessValidator.requireStaffAccess(user, instituteId);
        loadTrackedInInstitute(trackedId, instituteId);
        return evaluationRepository.findFirstByTrackedIdOrderByCreatedAtDesc(trackedId)
                .map(this::expireIfStale)
                .map(AssignmentAiEvaluationDTO::from)
                .orElse(null);
    }

    // ------------------------------------------------------------- ai_service callbacks

    public void onProgress(Map<String, Object> payload) {
        Object processId = payload == null ? null : payload.get("process_id");
        if (processId == null) {
            return;
        }
        Object step = payload.get("step");
        // A targeted update, not load-and-save: heartbeats run alongside the question
        // callback and a full-row save could put back the marks it just wrote. It also
        // touches updated_at, so a long run with the same step does not look stale.
        evaluationRepository.recordProgress(String.valueOf(processId),
                step == null ? null : String.valueOf(step), Instant.now());
    }

    public void onQuestion(Map<String, Object> payload) {
        findForCallback(payload).ifPresent(e -> {
            if (e.isTerminal()) {
                return;
            }
            if ("FAILED".equalsIgnoreCase(String.valueOf(payload.get("status")))) {
                Object detail = payload.get("error_detail");
                e.setErrorMessage(detail == null ? "The AI could not grade this copy" : String.valueOf(detail));
            } else {
                e.setMarksAwarded(toDouble(payload.get("marks_awarded")));
                Object feedback = payload.get("feedback");
                e.setFeedback(feedback == null ? null : String.valueOf(feedback));
            }
            e.setResultJson(toJson(payload));
            e.setCurrentStep("GRADING");
            evaluationRepository.save(e);
        });
    }

    public void onComplete(Map<String, Object> payload) {
        findForCallback(payload).ifPresent(e -> {
            if (e.isTerminal()) {
                return;
            }
            if (e.getMarksAwarded() == null && e.getErrorMessage() != null) {
                // The only question failed to grade: there is nothing to suggest.
                e.setStatus(AssignmentAiEvaluation.STATUS_FAILED);
                evaluationRepository.save(e);
                notifier.notifyFinished(e.getId());
                return;
            }
            if (e.getMarksAwarded() == null) {
                e.setMarksAwarded(toDouble(payload.get("total_marks_awarded")));
            }
            Object evaluatedFileId = payload.get("evaluated_file_id");
            if (evaluatedFileId != null && !String.valueOf(evaluatedFileId).isBlank()) {
                e.setEvaluatedFileId(String.valueOf(evaluatedFileId));
            }
            e.setStatus(AssignmentAiEvaluation.STATUS_COMPLETED);
            e.setCurrentStep("COMPLETED");
            e.setErrorMessage(null);
            evaluationRepository.save(e);
            // The teacher who started it reviews it; the learner sees nothing until they save the grade.
            notifier.notifyFinished(e.getId());
        });
    }

    public void onFailed(Map<String, Object> payload) {
        findForCallback(payload).ifPresent(e -> {
            if (e.isTerminal()) {
                return;
            }
            Object message = payload.get("error_message");
            fail(e, message == null ? "The AI Evaluator failed" : String.valueOf(message));
            notifier.notifyFinished(e.getId());
        });
    }

    // ---------------------------------------------------------------------- helpers

    /** The submission, if its slide belongs to the institute; also guards the manual /grade endpoint. */
    public AssignmentSlideTracked loadTrackedInInstitute(String trackedId, String instituteId) {
        AssignmentSlideTracked tracked = trackedRepository.findById(trackedId)
                .orElseThrow(() -> new ResourceNotFoundException("Assignment submission not found"));
        String slideId = tracked.getActivityLog().getSlideId();
        if (slideId == null || !evaluationRepository.isSlideInInstitute(slideId, instituteId)) {
            throw new ForbiddenException("Access denied: submission does not belong to institute " + instituteId);
        }
        return tracked;
    }

    Map<String, Object> buildGradeRequest(AssignmentAiEvaluation evaluation, Slide slide,
                                          AssignmentSlide assignment, String pdfUrl) {
        String questionText = assignmentAsOneQuestion(slide, assignment);

        Map<String, Object> question = new LinkedHashMap<>();
        // The rubric ai_service generates is stored per (assessment_id, question_id) and
        // reused for every learner. Keying the question on its text and marks means an
        // edited assignment gets a fresh rubric instead of the stale one.
        question.put("question_id", "asg-" + shortHash(questionText + "|" + evaluation.getMaxMarks()));
        question.put("question_text", questionText);
        question.put("question_type", "LONG_ANSWER");
        question.put("max_marks", evaluation.getMaxMarks());
        question.put("question_number", 1);

        Map<String, Object> examContext = new LinkedHashMap<>();
        examContext.put("instructions", "This is a homework assignment, not an exam paper. Grade the whole "
                + "submission as ONE answer to the assignment: the learner may answer its parts in any "
                + "order across the pages, typed or handwritten.");

        Map<String, Object> request = new LinkedHashMap<>();
        request.put("process_id", evaluation.getId());
        request.put("attempt_id", evaluation.getTrackedId());
        request.put("assessment_id", assignment.getId());
        request.put("institute_id", evaluation.getInstituteId());
        request.put("answer_mode", "COPY");
        request.put("pdf_url", pdfUrl);
        request.put("questions", List.of(question));
        request.put("preferred_model", evaluation.getPreferredModel());
        request.put("callback_base_url", callbackBaseUrl);
        request.put("exam_context", examContext);
        // The whole copy is the answer: locating it per question could only hide pages.
        request.put("skip_answer_location", true);
        return request;
    }

    static String assignmentAsOneQuestion(Slide slide, AssignmentSlide assignment) {
        StringBuilder text = new StringBuilder();
        if (slide.getTitle() != null && !slide.getTitle().isBlank()) {
            text.append("Assignment: ").append(slide.getTitle().trim()).append("\n\n");
        }
        if (assignment.getParentRichText() != null) {
            appendBlock(text, RichTextForAI.toPlainText(assignment.getParentRichText().getContent()));
        }
        if (assignment.getTextData() != null) {
            appendBlock(text, RichTextForAI.toPlainText(assignment.getTextData().getContent()));
        }
        List<AssignmentSlideQuestion> questions = assignment.getAssignmentSlideQuestions() == null
                ? List.of()
                : assignment.getAssignmentSlideQuestions().stream()
                        .sorted(Comparator.comparing(AssignmentSlideQuestion::getQuestionOrder,
                                Comparator.nullsLast(Comparator.naturalOrder())))
                        .toList();
        int number = 1;
        StringBuilder tasks = new StringBuilder();
        for (AssignmentSlideQuestion q : questions) {
            if (q.getTextData() == null) {
                continue;
            }
            String task = RichTextForAI.toPlainText(q.getTextData().getContent());
            if (task != null && !task.isBlank()) {
                tasks.append(number++).append(". ").append(task.trim()).append("\n");
            }
        }
        if (!tasks.isEmpty()) {
            text.append("Questions:\n").append(tasks);
        }
        String result = text.toString().trim();
        if (result.isEmpty()) {
            throw new VacademyException("This assignment has no instructions or questions for the AI to grade against");
        }
        return result;
    }

    private static void appendBlock(StringBuilder text, String block) {
        if (block != null && !block.isBlank()) {
            text.append(block.trim()).append("\n\n");
        }
    }

    private List<AssignmentCopyPdfBuilder.SourceFile> resolveFiles(List<String> fileIds) {
        if (fileIds.isEmpty()) {
            throw new VacademyException("This submission has no uploaded files to evaluate");
        }
        Map<String, FileDetailsDTO> byId = new HashMap<>();
        for (FileDetailsDTO details : mediaService.getFilesByIds(fileIds)) {
            if (details != null && details.getId() != null) {
                byId.put(details.getId(), details);
            }
        }
        List<AssignmentCopyPdfBuilder.SourceFile> files = new ArrayList<>();
        for (String id : fileIds) {
            FileDetailsDTO details = byId.get(id);
            String url = details != null && details.getUrl() != null ? details.getUrl()
                    : mediaService.getFilePublicUrlById(id);
            String name = details != null && details.getFileName() != null ? details.getFileName() : id;
            String type = details != null ? details.getFileType() : null;
            files.add(new AssignmentCopyPdfBuilder.SourceFile(name, type, url));
        }
        return files;
    }

    private String uploadMergedCopy(byte[] pdf, String trackedId) {
        try {
            FileDetailsDTO uploaded = mediaService.uploadFileV2(new ByteArrayMultipartFile(
                    pdf, "assignment-copy-" + trackedId + ".pdf", "application/pdf"));
            if (uploaded == null || uploaded.getId() == null) {
                throw new VacademyException("Could not upload the combined copy for the AI Evaluator");
            }
            return uploaded.getId();
        } catch (java.io.IOException e) {
            throw new VacademyException("Could not upload the combined copy for the AI Evaluator: " + e.getMessage());
        }
    }

    private Optional<AssignmentAiEvaluation> findForCallback(Map<String, Object> payload) {
        Object processId = payload == null ? null : payload.get("process_id");
        if (processId == null) {
            return Optional.empty();
        }
        Optional<AssignmentAiEvaluation> found = evaluationRepository.findById(String.valueOf(processId));
        if (found.isEmpty()) {
            log.warn("[assignment-ai-eval] callback for unknown process {}", processId);
        }
        return found;
    }

    private AssignmentAiEvaluation expireIfStale(AssignmentAiEvaluation e) {
        if (!e.isTerminal() && e.getUpdatedAt() != null
                && e.getUpdatedAt().isBefore(Instant.now().minus(STALE_AFTER))) {
            fail(e, "No response from the AI Evaluator. Try again.");
        }
        return e;
    }

    private void fail(AssignmentAiEvaluation e, String message) {
        e.setStatus(AssignmentAiEvaluation.STATUS_FAILED);
        e.setErrorMessage(message);
        evaluationRepository.save(e);
    }

    static List<String> splitIds(String commaSeparated) {
        if (commaSeparated == null || commaSeparated.isBlank()) {
            return List.of();
        }
        return Arrays.stream(commaSeparated.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .toList();
    }

    private static Double toDouble(Object value) {
        if (value instanceof Number n) {
            return n.doubleValue();
        }
        if (value != null) {
            try {
                return Double.parseDouble(String.valueOf(value));
            } catch (NumberFormatException ignored) {
                // fall through
            }
        }
        return null;
    }

    private String toJson(Object value) {
        try {
            return objectMapper.writeValueAsString(value);
        } catch (Exception e) {
            return null;
        }
    }

    private static String shortHash(String text) {
        try {
            byte[] digest = MessageDigest.getInstance("SHA-256").digest(text.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(digest, 0, 8);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
