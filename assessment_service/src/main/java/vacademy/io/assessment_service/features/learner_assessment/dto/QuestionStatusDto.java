package vacademy.io.assessment_service.features.learner_assessment.dto;

public interface QuestionStatusDto {
    String getQuestionId();
    Long getCorrectAttempt();
    Long getIncorrectAttempt();
    Long getPartialCorrectAttempt();
}
