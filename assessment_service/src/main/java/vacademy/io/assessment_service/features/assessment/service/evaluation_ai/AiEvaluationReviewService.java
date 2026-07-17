package vacademy.io.assessment_service.features.assessment.service.evaluation_ai;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import vacademy.io.assessment_service.features.assessment.entity.AiEvaluationProcess;
import vacademy.io.assessment_service.features.assessment.entity.AiQuestionEvaluation;
import vacademy.io.assessment_service.features.assessment.entity.StudentAttempt;
import vacademy.io.assessment_service.features.assessment.repository.AiEvaluationProcessRepository;
import vacademy.io.assessment_service.features.assessment.repository.AiQuestionEvaluationRepository;
import vacademy.io.assessment_service.features.assessment.repository.StudentAttemptRepository;
import vacademy.io.assessment_service.features.learner_assessment.entity.QuestionWiseMarks;
import vacademy.io.assessment_service.features.learner_assessment.repository.QuestionWiseMarksRepository;
import vacademy.io.common.exceptions.ResourceNotFoundException;

import java.math.BigDecimal;
import java.util.Date;

/**
 * Teacher-in-the-loop review of AI evaluation results. Lets a reviewer override
 * a single question's marks and feedback before the result is released, and
 * keeps the attempt total, the mirrored question_wise_marks row, and provenance
 * consistent. This is the write path that turns "AI grades your students" into
 * "AI drafts, the teacher approves".
 */
@Service
@Slf4j
@RequiredArgsConstructor
public class AiEvaluationReviewService {

    private final AiEvaluationProcessRepository processRepository;
    private final AiQuestionEvaluationRepository questionEvaluationRepository;
    private final QuestionWiseMarksRepository questionWiseMarksRepository;
    private final StudentAttemptRepository studentAttemptRepository;

    @Transactional
    public void overrideQuestion(String processId, String questionId, Double marks, String feedback,
            String editorUserId) {
        AiEvaluationProcess process = processRepository.findByIdWithStudentAttempt(processId)
                .orElseThrow(() -> new ResourceNotFoundException("Evaluation process not found: " + processId));

        AiQuestionEvaluation row = questionEvaluationRepository
                .findByEvaluationProcessIdAndQuestionId(processId, questionId)
                .orElseThrow(() -> new ResourceNotFoundException(
                        "Question evaluation not found for question " + questionId));

        // Clamp to [0, max]. A teacher editing a previously-FAILED question turns
        // it into a resolved, graded question.
        double max = row.getMaxMarks() != null ? row.getMaxMarks().doubleValue() : Double.MAX_VALUE;
        double clamped = marks == null ? 0.0 : Math.max(0.0, Math.min(marks, max));

        row.setMarksAwarded(BigDecimal.valueOf(clamped));
        if (feedback != null) {
            row.setFeedback(feedback);
        }
        row.setStatus("COMPLETED");
        row.setIsEdited(true);
        row.setEditedBy(editorUserId);
        row.setEditedAt(new Date());
        questionEvaluationRepository.save(row);

        // Mirror the human decision into question_wise_marks so the submissions
        // table and (once released) the learner report read the reviewed value.
        String attemptId = process.getStudentAttempt() != null ? process.getStudentAttempt().getId() : null;
        if (attemptId != null) {
            QuestionWiseMarks marksRow = questionWiseMarksRepository
                    .findByStudentAttemptIdAndQuestionId(attemptId, questionId)
                    .orElse(null);
            if (marksRow != null) {
                marksRow.setMarks(clamped);
                marksRow.setAiEvaluatedAt(new Date());
                marksRow.setMarksSource("AI_REVIEWED");
                // The teacher's edited feedback becomes the authoritative,
                // learner-visible remark for this question.
                if (feedback != null) {
                    marksRow.setEvaluatorFeedback(feedback);
                }
                questionWiseMarksRepository.save(marksRow);
            }
        }

        recomputeAttemptTotals(process);
        log.info("[copy-check] question {} of process {} overridden to {} by {}",
                questionId, processId, clamped, editorUserId);
    }

    /**
     * Recompute the attempt's total/result marks from the successfully-graded
     * (COMPLETED) question evaluations of this process. Keeps failed/unreviewed
     * questions out of the total until a teacher grades them.
     */
    private void recomputeAttemptTotals(AiEvaluationProcess process) {
        if (process.getStudentAttempt() == null) {
            return;
        }
        double total = questionEvaluationRepository
                .findByEvaluationProcessIdOrderByQuestionNumberAsc(process.getId())
                .stream()
                .filter(q -> "COMPLETED".equals(q.getStatus()) && q.getMarksAwarded() != null)
                .mapToDouble(q -> q.getMarksAwarded().doubleValue())
                .sum();
        StudentAttempt attempt = studentAttemptRepository.findById(process.getStudentAttempt().getId())
                .orElse(null);
        if (attempt != null) {
            attempt.setTotalMarks(total);
            attempt.setResultMarks(total);
            studentAttemptRepository.save(attempt);
        }
    }
}
