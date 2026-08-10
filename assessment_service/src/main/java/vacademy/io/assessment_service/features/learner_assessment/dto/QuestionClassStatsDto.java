package vacademy.io.assessment_service.features.learner_assessment.dto;

/**
 * Per-question class-wide aggregate for one assessment, projected from
 * {@code question_wise_marks} (see
 * {@code QuestionWiseMarksRepository.findQuestionClassStatsForAssessment}).
 *
 * <p>{@code maxMarks} is the highest mark any participant achieved on the
 * question — used by the v2 report as a data-driven stand-in for the
 * question's total marks (the marking-scheme total is not readily available
 * on this read path).
 */
public interface QuestionClassStatsDto {
    String getQuestionId();

    Long getTotalCount();

    Long getCorrectCount();

    Double getMaxMarks();
}
