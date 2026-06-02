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
        Optional<AiQuestionEvaluation> row = questionEvaluationRepository
                .findByEvaluationProcessIdAndQuestionId(process.getId(), payload.getQuestionId());
        // Idempotency anchor: a retried callback hits the same row, and we
        // must not double-bump questions_completed below.
        boolean wasAlreadyCompleted = row.isPresent()
                && "COMPLETED".equals(row.get().getStatus());
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
        evalRow.setStatus("COMPLETED");
        evalRow.setCompletedAt(new Date());
        evalRow.setRubricVersion(payload.getRubricVersion());
        questionEvaluationRepository.save(evalRow);

        // Mirror into question_wise_marks so the existing FE table reads correct values.
        QuestionWiseMarks marks = questionWiseMarksRepository
                .findByStudentAttemptIdAndQuestionId(
                        process.getStudentAttempt() != null ? process.getStudentAttempt().getId() : null,
                        payload.getQuestionId())
                .orElse(null);
        if (marks != null && payload.getMarksAwarded() != null) {
            marks.setMarks(payload.getMarksAwarded());
            marks.setAiEvaluatedAt(new Date());
            try {
                marks.setAiEvaluationDetailsJson(objectMapper.writeValueAsString(payload));
            } catch (JsonProcessingException ignored) {
                // Non-fatal — feedback is also on ai_question_evaluation row.
            }
            questionWiseMarksRepository.save(marks);
        }

        if (!wasAlreadyCompleted) {
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
                attempt.setTotalMarks(payload.getTotalMarksAwarded());
                attempt.setResultMarks(payload.getTotalMarksAwarded());
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
        process.setStatus(AiEvaluationStatusEnum.FAILED.name());
        process.setErrorMessage(payload.getErrorMessage());
        process.setCompletedAt(new Date());
        processRepository.save(process);
        cancellationService.clearFlag(payload.getProcessId());
        log.warn("[copy-check] process {} failed: {}", payload.getProcessId(), payload.getErrorMessage());
    }
}
