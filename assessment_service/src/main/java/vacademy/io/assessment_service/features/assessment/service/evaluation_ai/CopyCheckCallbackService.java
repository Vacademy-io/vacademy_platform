package vacademy.io.assessment_service.features.assessment.service.evaluation_ai;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.assessment.dto.evaluation_ai.CopyCheckCallbackDto;
import vacademy.io.assessment_service.features.assessment.entity.AiEvaluationProcess;
import vacademy.io.assessment_service.features.assessment.entity.AiQuestionEvaluation;
import vacademy.io.assessment_service.features.assessment.entity.CopyCheckLayout;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.enums.AiEvaluationStatusEnum;
import vacademy.io.assessment_service.features.assessment.repository.AiEvaluationProcessRepository;
import vacademy.io.assessment_service.features.assessment.repository.AiQuestionEvaluationRepository;
import vacademy.io.assessment_service.features.assessment.repository.CopyCheckLayoutRepository;
import vacademy.io.assessment_service.features.assessment.repository.StudentAttemptRepository;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;
import vacademy.io.assessment_service.features.learner_assessment.repository.QuestionWiseMarksRepository;

import java.util.Date;
import java.util.Optional;

/**
 * Persists callback events from ai_service. Each handler is idempotent:
 *   - progress: just updates step/progress on the process
 *   - question: upserts ai_question_evaluation + question_wise_marks for the
 *     given (process_id, question_id) pair, so a retried callback rewrites
 *     the same row instead of duplicating it
 *   - complete / failed: terminal — clears cancellation flag too
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class CopyCheckCallbackService {

    private final AiEvaluationProcessRepository processRepository;
    private final AiQuestionEvaluationRepository questionEvaluationRepository;
    private final CopyCheckLayoutRepository layoutRepository;
    private final QuestionWiseMarksRepository questionWiseMarksRepository;
    private final StudentAttemptRepository studentAttemptRepository;
    private final AiEvaluationCancellationService cancellationService;
    private final ObjectMapper objectMapper;

    @Transactional
    public void onProgress(CopyCheckCallbackDto.Progress payload) {
        AiEvaluationProcess process = processRepository.findById(payload.getProcessId()).orElse(null);
        if (process == null) {
            log.warn("[copy-check] progress callback for unknown process={}", payload.getProcessId());
            return;
        }
        process.setCurrentStep(payload.getStep());
        if ("LAYOUT_OCR_DONE".equals(payload.getStep())) {
            process.setStatus(AiEvaluationStatusEnum.EXTRACTING.name());
            persistLayoutIfPresent(process, payload.getLayoutMap());
        } else if ("GRADING".equals(payload.getStep())) {
            process.setStatus(AiEvaluationStatusEnum.EVALUATING.name());
        }
        processRepository.save(process);
    }

    private void persistLayoutIfPresent(AiEvaluationProcess process, JsonNode layoutMap) {
        if (layoutMap == null || layoutMap.isMissingNode() || layoutMap.isNull()) return;
        try {
            CopyCheckLayout row = layoutRepository
                    .findByEvaluationProcessId(process.getId())
                    .orElseGet(CopyCheckLayout::new);
            row.setEvaluationProcessId(process.getId());
            row.setAttemptId(process.getStudentAttempt() != null ? process.getStudentAttempt().getId() : null);
            row.setLayoutJson(objectMapper.writeValueAsString(layoutMap));
            layoutRepository.save(row);
        } catch (JsonProcessingException e) {
            log.error("[copy-check] failed to serialize layout for process {}", process.getId(), e);
        }
    }

    @Transactional
    public void onQuestionDone(CopyCheckCallbackDto.QuestionDone payload) {
        AiEvaluationProcess process = processRepository.findById(payload.getProcessId()).orElse(null);
        if (process == null) {
            log.warn("[copy-check] question callback for unknown process={}", payload.getProcessId());
            return;
        }
        // A process the stale-job sweeper marked FAILED, or the teacher CANCELLED,
        // is reaped: ignore straggler callbacks so a (possibly still-alive) old run
        // can't silently resurrect it and race a retry into the same marks rows.
        if (isReaped(process.getStatus())) {
            log.info("[copy-check] ignoring question callback for reaped process {} (status={})",
                    payload.getProcessId(), process.getStatus());
            return;
        }
        String qStatus = (payload.getStatus() != null && !payload.getStatus().isBlank())
                ? payload.getStatus().toUpperCase()
                : "COMPLETED";
        boolean failed = "FAILED".equals(qStatus);

        Optional<AiQuestionEvaluation> row = questionEvaluationRepository
                .findByEvaluationProcessIdAndQuestionId(process.getId(), payload.getQuestionId());

        // Never let a late or retried AI callback overwrite a mark a human has
        // already reviewed/edited on the review page.
        if (row.isPresent() && Boolean.TRUE.equals(row.get().getIsEdited())) {
            log.info("[copy-check] skipping AI callback for question {} — already edited by a reviewer",
                    payload.getQuestionId());
            return;
        }

        // Idempotency anchor: a retried callback hits the same row, and we must
        // not double-bump questions_completed below. A question counts as
        // processed once it reaches a terminal state (graded OR failed).
        boolean wasTerminal = row.isPresent()
                && ("COMPLETED".equals(row.get().getStatus()) || "FAILED".equals(row.get().getStatus()));
        AiQuestionEvaluation evalRow = row.orElseGet(() -> {
            AiQuestionEvaluation r = new AiQuestionEvaluation();
            r.setEvaluationProcess(process);
            return r;
        });
        evalRow.setMarksAwarded(payload.getMarksAwarded() != null
                ? java.math.BigDecimal.valueOf(payload.getMarksAwarded()) : null);
        evalRow.setMaxMarks(payload.getMaxMarks() != null
                ? java.math.BigDecimal.valueOf(payload.getMaxMarks()) : null);
        evalRow.setFeedback(payload.getFeedback());
        evalRow.setExtractedAnswer(payload.getExtractedAnswer());
        try {
            evalRow.setEvaluationResultJson(objectMapper.writeValueAsString(payload));
        } catch (JsonProcessingException e) {
            log.warn("[copy-check] could not serialize verdict for {}/{}", process.getId(), payload.getQuestionId());
        }
        evalRow.setStatus(qStatus);
        evalRow.setCompletedAt(new Date());
        evalRow.setRubricVersion(payload.getRubricVersion());
        questionEvaluationRepository.save(evalRow);

        // Mirror ONLY successfully-graded questions into question_wise_marks. A
        // FAILED question is left untouched (no silent 0) — it surfaces on the
        // review page for the teacher to grade by hand, which then mirrors it.
        if (!failed && payload.getMarksAwarded() != null) {
            QuestionWiseMarks marks = questionWiseMarksRepository
                    .findByStudentAttemptIdAndQuestionId(
                            process.getStudentAttempt() != null ? process.getStudentAttempt().getId() : null,
                            payload.getQuestionId())
                    .orElse(null);
            if (marks != null) {
                marks.setMarks(payload.getMarksAwarded());
                marks.setAiEvaluatedAt(new Date());
                marks.setMarksSource("AI");
                try {
                    marks.setAiEvaluationDetailsJson(objectMapper.writeValueAsString(payload));
                } catch (JsonProcessingException ignored) {
                    // Non-fatal — feedback is also on ai_question_evaluation row.
                }
                questionWiseMarksRepository.save(marks);
            }
        }

        if (!wasTerminal) {
            int completed = (process.getQuestionsCompleted() == null ? 0 : process.getQuestionsCompleted()) + 1;
            process.setQuestionsCompleted(completed);
            processRepository.save(process);
        }
    }

    @Transactional
    public void onComplete(CopyCheckCallbackDto.Complete payload) {
        AiEvaluationProcess process = processRepository.findById(payload.getProcessId()).orElse(null);
        if (process == null) {
            log.warn("[copy-check] complete callback for unknown process={}", payload.getProcessId());
            return;
        }
        // Don't let a straggler complete callback resurrect a reaped (swept-FAILED
        // or user-CANCELLED) run into COMPLETED after a retry may already exist.
        if (isReaped(process.getStatus())) {
            log.info("[copy-check] ignoring complete callback for reaped process {} (status={})",
                    payload.getProcessId(), process.getStatus());
            cancellationService.clearFlag(payload.getProcessId());
            return;
        }
        process.setStatus(AiEvaluationStatusEnum.COMPLETED.name());
        process.setCompletedAt(new Date());
        try {
            process.setEvaluationJson(objectMapper.writeValueAsString(payload));
        } catch (JsonProcessingException ignored) {
        }
        processRepository.save(process);

        if (process.getStudentAttempt() != null) {
            StudentAttempt attempt = studentAttemptRepository
                    .findById(process.getStudentAttempt().getId())
                    .orElse(null);
            if (attempt != null) {
                // Recompute from the successfully-graded questions rather than
                // trusting the AI's reported total: FAILED questions are excluded
                // (not counted as a silent 0) until a teacher grades them, which
                // recomputes this total via AiEvaluationReviewService.
                double total = questionEvaluationRepository
                        .findByEvaluationProcessIdOrderByQuestionNumberAsc(process.getId())
                        .stream()
                        .filter(q -> "COMPLETED".equals(q.getStatus()) && q.getMarksAwarded() != null)
                        .mapToDouble(q -> q.getMarksAwarded().doubleValue())
                        .sum();
                attempt.setTotalMarks(total);
                attempt.setResultMarks(total);
                attempt.setResultStatus("COMPLETED");
                studentAttemptRepository.save(attempt);
            }
        }
        cancellationService.clearFlag(payload.getProcessId());
        log.info("[copy-check] process {} complete: {}/{} ({} questions)",
                payload.getProcessId(), payload.getTotalMarksAwarded(),
                payload.getTotalMaxMarks(), payload.getQuestionsEvaluated());
    }

    @Transactional
    public void onFailed(CopyCheckCallbackDto.Failed payload) {
        AiEvaluationProcess process = processRepository.findById(payload.getProcessId()).orElse(null);
        if (process == null) return;
        // A user-initiated stop sets status=CANCELLED first; ai_service then
        // reports the aborted job as failed("Cancelled by user"). Do NOT clobber
        // that deliberate CANCELLED state with FAILED — the teacher stopped it on
        // purpose, and support must be able to tell real pipeline failures apart
        // from user stops.
        if ("CANCELLED".equalsIgnoreCase(process.getStatus())) {
            cancellationService.clearFlag(payload.getProcessId());
            log.info("[copy-check] ignoring failed callback for already-cancelled process {}",
                    payload.getProcessId());
            return;
        }
        process.setStatus(AiEvaluationStatusEnum.FAILED.name());
        process.setErrorMessage(payload.getErrorMessage());
        process.setCompletedAt(new Date());
        processRepository.save(process);
        cancellationService.clearFlag(payload.getProcessId());
        log.warn("[copy-check] process {} failed: {}", payload.getProcessId(), payload.getErrorMessage());
    }

    /** A process that has been reaped by the sweeper (FAILED) or the user (CANCELLED). */
    private static boolean isReaped(String status) {
        return "FAILED".equalsIgnoreCase(status) || "CANCELLED".equalsIgnoreCase(status);
    }
}
